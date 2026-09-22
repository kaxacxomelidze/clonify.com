/** Browser-facing Backend API base (no trailing slash). */
export function getApiBaseUrl(): string {
  const raw = String(import.meta.env["VITE_API_BASE_URL"] || "").trim().replace(/\/$/, "");
  return raw || "http://localhost:5000";
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const TOKEN_KEY = "clonyfy_auth_token";
const WAKE_COOLDOWN_MS = 90_000;
let lastWakeOkAt = 0;
let wakeInFlight: Promise<boolean> | null = null;

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

function isRemoteApiHost(): boolean {
  try {
    const host = new URL(getApiBaseUrl()).hostname;
    return host !== "localhost" && host !== "127.0.0.1";
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof ApiError) return err.status === 502 || err.status === 503 || err.status === 504;
  const name = err instanceof Error ? err.name : "";
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  return (
    name === "AbortError" ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("aborted")
  );
}

function wakeUpMessage() {
  return "The Backend is waking up (common on Render free tier). Wait a moment and try again — usually 30–90 seconds.";
}

/**
 * Ping /api/health until the Backend answers. Mitigates Render free-tier cold starts.
 * Safe to call often — cached for ~90s after a successful wake.
 */
export async function ensureApiAwake(options?: {
  attempts?: number;
  timeoutMs?: number;
  force?: boolean;
}): Promise<boolean> {
  if (!isRemoteApiHost()) {
    lastWakeOkAt = Date.now();
    return true;
  }
  const attempts = options?.attempts ?? 8;
  const timeoutMs = options?.timeoutMs ?? 12_000;
  if (!options?.force && Date.now() - lastWakeOkAt < WAKE_COOLDOWN_MS) return true;
  if (wakeInFlight) return wakeInFlight;

  wakeInFlight = (async () => {
    let lastErr: unknown = null;
    for (let i = 0; i < attempts; i++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/health`, {
          signal: controller.signal,
          credentials: "omit",
          cache: "no-store",
        });
        if (res.ok) {
          lastWakeOkAt = Date.now();
          return true;
        }
        lastErr = new ApiError(`HTTP ${res.status}`, res.status);
      } catch (err) {
        lastErr = err;
      } finally {
        clearTimeout(timer);
      }
      // Back off while Render spins up Chromium / Node.
      await sleep(Math.min(2500 + i * 1500, 8000));
    }
    if (lastErr instanceof ApiError) throw lastErr;
    throw new ApiError(wakeUpMessage(), 503, { cause: String(lastErr) });
  })().finally(() => {
    wakeInFlight = null;
  });

  return wakeInFlight;
}

/** Lightweight keep-alive while the dashboard is open (reduces free-tier sleep). */
export function startApiKeepWarm(intervalMs = 8 * 60 * 1000): () => void {
  if (typeof window === "undefined" || !isRemoteApiHost()) return () => {};
  void ensureApiAwake({ attempts: 3, timeoutMs: 15_000 }).catch(() => {});
  const id = window.setInterval(() => {
    void ensureApiAwake({ attempts: 2, timeoutMs: 10_000, force: true }).catch(() => {});
  }, intervalMs);
  return () => window.clearInterval(id);
}

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
  retries?: number;
  skipWake?: boolean;
};

export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const {
    body,
    auth = true,
    timeoutMs = 60_000,
    retries = isRemoteApiHost() ? 2 : 0,
    skipWake = false,
    headers: initHeaders,
    ...rest
  } = options;

  if (!skipWake && isRemoteApiHost()) {
    try {
      await ensureApiAwake({ attempts: 6, timeoutMs: 12_000 });
    } catch {
      // Still attempt the real request — health may be blocked while app routes work.
    }
  }

  const headers = new Headers(initHeaders || {});
  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = getAuthToken();
    if (token) headers.set("X-Auth-Token", token);
  }

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const init: RequestInit = {
        ...rest,
        headers,
        signal: rest.signal || controller.signal,
        credentials: "omit",
      };
      if (body !== undefined) init.body = JSON.stringify(body);
      const res = await fetch(`${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`, init);
      const text = await res.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      if (!res.ok) {
        const message =
          data && typeof data === "object" && data !== null && "error" in data
            ? String((data as { error: unknown }).error || `HTTP ${res.status}`)
            : res.status === 502 || res.status === 503 || res.status === 504
              ? wakeUpMessage()
              : `HTTP ${res.status}`;
        const err = new ApiError(message, res.status, data);
        if (attempt < retries && (res.status === 502 || res.status === 503 || res.status === 504)) {
          attempt++;
          await sleep(1500 * attempt);
          await ensureApiAwake({ attempts: 4, timeoutMs: 12_000, force: true }).catch(() => {});
          continue;
        }
        throw err;
      }
      lastWakeOkAt = Date.now();
      return data as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (attempt < retries && isTransientNetworkError(err)) {
        attempt++;
        await sleep(1500 * attempt);
        await ensureApiAwake({ attempts: 4, timeoutMs: 12_000, force: true }).catch(() => {});
        continue;
      }
      if (isTransientNetworkError(err)) {
        throw new ApiError(wakeUpMessage(), 503, { cause: String(err) });
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

export type PlanLimits = {
  clonesPerMonth: number | null;
  maxPages: number | null;
  fullSiteAllowed?: boolean;
  fullSiteMaxPages?: number | null;
  fullSiteDepth?: number | null;
  editsPerMonth?: number | null;
  savesPerMonth?: number | null;
  sharesPerMonth?: number | null;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  plan: string;
  planLabel?: string;
  planLimits?: PlanLimits;
  planRenewsAt?: string | null;
  billingInterval?: string | null;
  emailVerified?: boolean;
  cancelAtPeriodEnd?: boolean;
  createdAt?: string;
};

export type UsageSummary = {
  periodStart?: string;
  editsThisMonth?: number;
  savesThisMonth?: number;
  sharesThisMonth?: number;
  clonesThisMonth?: number;
  limits?: PlanLimits;
  totalClones?: number;
  totalPages?: number;
  totalAssets?: number;
  limitThisMonth?: number | null;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
  usage?: UsageSummary;
};

export async function loginRequest(email: string, password: string, remember = true) {
  await ensureApiAwake({ attempts: 10, timeoutMs: 15_000 }).catch(() => {});
  return apiFetch<AuthSession>("/api/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password, remember },
    timeoutMs: 120_000,
    retries: 3,
  });
}

export async function registerRequest(name: string, email: string, password: string) {
  await ensureApiAwake({ attempts: 10, timeoutMs: 15_000 }).catch(() => {});
  return apiFetch<AuthSession>("/api/auth/register", {
    method: "POST",
    auth: false,
    body: { name, email, password },
    timeoutMs: 120_000,
    retries: 3,
  });
}

export async function fetchMe() {
  return apiFetch<{ user: AuthUser; usage: UsageSummary }>("/api/auth/me");
}

export async function logoutRequest() {
  try {
    await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  } catch {
    /* still clear local session */
  } finally {
    setAuthToken(null);
  }
}

export function googleAuthUrl() {
  return `${getApiBaseUrl()}/api/auth/google`;
}

export type CloneJobResponse = {
  id: string;
  url: string;
  hostname?: string;
  status: string;
  logs?: string[];
  outDir?: string;
  startedAt?: string;
  pages?: number | null;
  apiRoutes?: number | null;
  assets?: number | null;
  maxPages?: number;
  depth?: number;
  ignoreRobots?: boolean;
  fullSite?: boolean;
};

export type OutputItem = {
  id?: string;
  name?: string;
  dir: string;
  targetOrigin?: string;
  capturedAt?: string;
  status?: string;
  pages?: number;
  assets?: number;
  apiRoutes?: number;
  label?: string | null;
};

export async function startClone(input: {
  url: string;
  maxPages: number;
  depth: number;
  ignoreRobots?: boolean;
}) {
  await ensureApiAwake({ attempts: 8, timeoutMs: 12_000 }).catch(() => {});
  return apiFetch<CloneJobResponse>("/api/clone", {
    method: "POST",
    body: {
      url: input.url,
      maxPages: input.maxPages,
      depth: input.depth,
      ignoreRobots: !!input.ignoreRobots,
    },
    timeoutMs: 120_000,
    retries: 2,
  });
}

export async function fetchJobStatus(id: string, logsFrom = 0) {
  return apiFetch<CloneJobResponse>(
    `/api/status?id=${encodeURIComponent(id)}&logsFrom=${logsFrom}`,
    { timeoutMs: 30_000 },
  );
}

export async function fetchOutputs(limit = 50) {
  return apiFetch<OutputItem[]>(`/api/outputs?limit=${limit}`);
}

export async function fetchDashboard() {
  return apiFetch<{
    user: AuthUser;
    usage: UsageSummary;
    recentClones: Array<{
      id: string;
      url: string;
      status: string;
      pages?: number;
      startedAt?: string;
    }>;
  }>("/api/user/dashboard");
}

export async function updateProfile(body: { name?: string; password?: string }) {
  return apiFetch<{ ok: boolean }>("/api/user/profile", { method: "PUT", body });
}

export async function fetchPlans() {
  return apiFetch<{
    plans: Record<string, { monthly: number; annual: number }>;
    limits: Record<string, PlanLimits>;
    labels: Record<string, string>;
  }>("/api/payments/plans", { auth: false });
}

export async function fetchBillingHistory() {
  return apiFetch<{ payments: Array<Record<string, unknown>> }>("/api/user/billing");
}

export async function startStripeCheckout(plan: string, interval: "monthly" | "yearly" = "monthly") {
  return apiFetch<{ url: string }>("/api/payments/stripe/checkout", {
    method: "POST",
    body: { plan, interval },
  });
}

export async function openStripePortal() {
  return apiFetch<{ url: string }>("/api/payments/stripe/portal", { method: "POST" });
}

export async function cancelSubscription() {
  return apiFetch<{ ok: boolean }>("/api/user/cancel-subscription", { method: "POST" });
}

export async function previewClone(outDir: string) {
  return apiFetch<{ ok: boolean; url: string; hosted?: boolean }>("/api/preview", {
    method: "POST",
    body: { outDir },
  });
}

export function pagePreviewUrl(outDir: string, route = "/", mode?: "editor") {
  const token = getAuthToken();
  const params = new URLSearchParams({
    outDir,
    route,
  });
  if (mode) params.set("mode", mode);
  if (token) params.set("access_token", token);
  return `${getApiBaseUrl()}/api/page?${params.toString()}`;
}

export async function fetchClonePages(outDir: string) {
  return apiFetch<string[]>(`/api/pages?outDir=${encodeURIComponent(outDir)}`);
}

export async function fetchPageHtml(outDir: string, route = "/", mode?: "editor") {
  const token = getAuthToken();
  const params = new URLSearchParams({ outDir, route });
  if (mode) params.set("mode", mode);
  const res = await fetch(`${getApiBaseUrl()}/api/page?${params.toString()}`, {
    headers: token ? { "X-Auth-Token": token } : {},
  });
  const text = await res.text();
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = JSON.parse(text) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      if (text) message = text.slice(0, 200);
    }
    throw new ApiError(message, res.status);
  }
  return text;
}

export async function savePage(outDir: string, route: string, html: string) {
  return apiFetch<{ ok: boolean; usage?: { kind: string; used: number; limit: number | null } }>(
    "/api/save-page",
    {
      method: "POST",
      body: { outDir, route, html },
      timeoutMs: 120_000,
    },
  );
}

export async function importAsset(outDir: string, dataUrl: string, filename?: string) {
  return apiFetch<{ ok: boolean; path: string; previewUrl?: string; mimeType?: string; size?: number }>(
    "/api/import-asset",
    {
      method: "POST",
      body: { outDir, dataUrl, filename },
      timeoutMs: 120_000,
    },
  );
}

export async function consumeUsage(kind: "edit" | "save" | "share", outDir?: string) {
  return apiFetch<{ ok: boolean; usage?: { kind: string; used: number; limit: number | null } }>(
    "/api/usage/consume",
    {
      method: "POST",
      body: { kind, outDir },
    },
  );
}

export function downloadFigmaSvgUrl(outDir: string, route = "/") {
  const params = new URLSearchParams({ outDir, route });
  return `${getApiBaseUrl()}/api/download-figma?${params.toString()}`;
}

export function downloadFigmaZipUrl(outDir: string) {
  const params = new URLSearchParams({ outDir });
  return `${getApiBaseUrl()}/api/download-figma-zip?${params.toString()}`;
}

async function downloadAuthedBlob(
  url: string,
  fallbackName: string,
  options?: { timeoutMs?: number },
): Promise<{ blob: Blob; filename: string }> {
  const timeoutMs = options?.timeoutMs ?? 120_000;
  await ensureApiAwake({ attempts: 4, timeoutMs: 12_000 }).catch(() => {});
  const token = getAuthToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: token ? { "X-Auth-Token": token } : {},
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
    });
    const contentType = String(res.headers.get("content-type") || "");
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as { error?: string };
      throw new ApiError(data.error || `HTTP ${res.status}`, res.status, data);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let message = `HTTP ${res.status}`;
      try {
        const parsed = text ? (JSON.parse(text) as { error?: string }) : null;
        if (parsed?.error) message = parsed.error;
      } catch {
        if (/timed out|timeout|gateway|502|503|504/i.test(text) || res.status === 502 || res.status === 503 || res.status === 504) {
          message = "Figma export timed out or the Backend restarted. Try Export for Figma Desktop, or retry once.";
        }
      }
      throw new ApiError(message, res.status);
    }
    const disposition = res.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/i);
    return { blob: await res.blob(), filename: match?.[1] || fallbackName };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(
        "Figma export took too long. Try Export for Figma Desktop, or a smaller page.",
        504,
      );
    }
    if (isTransientNetworkError(err)) {
      throw new ApiError(
        "Could not reach the Backend for Figma export. Wait for wake-up and try again.",
        503,
        { cause: String(err) },
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function downloadFigmaSvgBlob(outDir: string, route = "/") {
  return downloadAuthedBlob(downloadFigmaSvgUrl(outDir, route), "page.svg", { timeoutMs: 110_000 });
}

export async function downloadFigmaZipBlob(outDir: string) {
  return downloadAuthedBlob(downloadFigmaZipUrl(outDir), "clone-figma.zip", { timeoutMs: 180_000 });
}

export type FigmaScene = {
  kind?: string;
  version?: number;
  name?: string;
  route?: string;
  page?: Record<string, unknown>;
  nodes?: unknown[];
  [key: string]: unknown;
};

export async function fetchPublicConfig() {
  return apiFetch<{
    figma_community_plugin_url?: string;
    affiliate_enabled?: boolean;
  }>("/api/public-config", { auth: false });
}

/** Resolve Scene Graph for Figma Desktop plugin (clipboard import). */
export async function fetchFigmaScene(outDir: string, route = "/"): Promise<{
  scene: FigmaScene;
  warning?: string;
}> {
  await ensureApiAwake({ attempts: 4, timeoutMs: 12_000 }).catch(() => {});
  const token = getAuthToken();
  const params = new URLSearchParams({ outDir, route });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 110_000);
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/figma/scene?${params.toString()}`, {
      headers: token ? { "X-Auth-Token": token } : {},
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
    });
    const contentType = String(res.headers.get("content-type") || "");
    const data = (contentType.includes("application/json")
      ? await res.json()
      : null) as {
      error?: string;
      ok?: boolean;
      scene?: FigmaScene;
      warning?: string;
      kind?: string;
      downloadUrl?: string;
      mode?: string;
      parts?: Array<{ url: string; index: number }>;
    } | null;
    if (!res.ok || !data || data.error) {
      throw new ApiError(
        data?.error ||
          (res.status === 502 || res.status === 503 || res.status === 504
            ? "Figma Desktop export timed out or the Backend restarted. Try again."
            : `HTTP ${res.status}`),
        res.status,
        data,
      );
    }
    if (data.scene) return { scene: data.scene, ...(data.warning ? { warning: data.warning } : {}) };

    // Large scenes are delivered via signed Storage (same pattern as ZIP exports).
    if (data.kind === "figma-scene-ref" || data.downloadUrl || data.mode === "parts") {
      let text = "";
      if (data.mode === "parts" && Array.isArray(data.parts)) {
        const ordered = data.parts.slice().sort((a, b) => (a.index || 0) - (b.index || 0));
        const chunks: string[] = [];
        for (const part of ordered) {
          const partRes = await fetch(part.url);
          if (!partRes.ok) throw new ApiError(`Could not download scene part ${part.index + 1}`, partRes.status);
          chunks.push(await partRes.text());
        }
        text = chunks.join("");
      } else if (data.downloadUrl) {
        const fileRes = await fetch(data.downloadUrl);
        if (!fileRes.ok) throw new ApiError("Could not download Figma scene", fileRes.status);
        text = await fileRes.text();
      } else {
        throw new ApiError("Figma scene reference was incomplete", 500, data);
      }
      const parsed = JSON.parse(text) as { scene?: FigmaScene; ok?: boolean; warning?: string };
      if (!parsed.scene) throw new ApiError("Downloaded Figma scene was empty", 500, parsed);
      return {
        scene: parsed.scene,
        ...(parsed.warning || data.warning ? { warning: parsed.warning || data.warning } : {}),
      };
    }

    throw new ApiError("Figma scene export did not return a scene", 500, data);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(
        "Figma Desktop scene took too long. Try Download SVG for Figma Web, or retry once.",
        504,
      );
    }
    if (isTransientNetworkError(err)) {
      throw new ApiError(
        "Could not reach the Backend for Figma Desktop export. Wait for wake-up and try again.",
        503,
        { cause: String(err) },
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Clipboard soft limit — browsers / OS often fail silently above ~1–2MB. */
const FIGMA_CLIPBOARD_SOFT_MAX = 1_400_000;

export async function copyFigmaSceneToClipboard(scene: FigmaScene): Promise<{
  bytes: number;
  usedClipboard: boolean;
}> {
  const payload: FigmaScene = {
    ...scene,
    kind: "clonyfy-figma-scene",
    version: 1,
  };
  const text = JSON.stringify(payload);
  if (text.length > FIGMA_CLIPBOARD_SOFT_MAX) {
    throw new Error("SCENE_TOO_LARGE_FOR_CLIPBOARD");
  }
  if (!navigator.clipboard?.writeText) {
    throw new Error("CLIPBOARD_UNAVAILABLE");
  }
  await navigator.clipboard.writeText(text);
  return { bytes: text.length, usedClipboard: true };
}

export async function fetchGitHubBranches(token: string, repo: string) {
  return apiFetch<{ ok: boolean; branches: string[] }>("/api/github/branches", {
    method: "POST",
    body: { token, repo },
  });
}

export function triggerBrowserDownload(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1500);
}

export async function createShareLink(outDir: string, route = "/") {
  return apiFetch<{ shareId: string; url: string }>("/api/share/create", {
    method: "POST",
    body: { outDir, route },
  });
}

export async function deleteOutput(outDir: string) {
  return apiFetch<{ ok: boolean }>("/api/output", {
    method: "DELETE",
    body: { outDir },
  });
}

export function downloadZipUrl(outDir: string) {
  const params = new URLSearchParams({ outDir });
  return `${getApiBaseUrl()}/api/download-zip?${params.toString()}`;
}

export async function forgotPasswordRequest(email: string) {
  return apiFetch<{ ok: boolean }>("/api/auth/forgot-password", {
    method: "POST",
    auth: false,
    body: { email },
  });
}

export async function resetPasswordRequest(token: string, password: string) {
  return apiFetch<{ ok: boolean }>("/api/auth/reset-password", {
    method: "POST",
    auth: false,
    body: { token, password },
  });
}

export async function connectGitHub(token: string) {
  return apiFetch<{
    ok: boolean;
    user: { login: string; name: string; avatarUrl?: string };
    repos: Array<{
      fullName: string;
      defaultBranch: string;
      private: boolean;
      htmlUrl: string;
      pushedAt?: string;
    }>;
  }>("/api/github/connect", {
    method: "POST",
    body: { token },
  });
}

export async function pushToGitHub(input: {
  outDir: string;
  token: string;
  repo: string;
  branch?: string;
  commitMessage?: string;
  createRepo?: boolean;
}) {
  await ensureApiAwake({ attempts: 4, timeoutMs: 12_000 }).catch(() => {});
  return apiFetch<{
    ok: boolean;
    url?: string;
    commitUrl?: string;
    repoUrl?: string;
    createdRepo?: boolean;
    files?: number;
  }>("/api/github/push", {
    method: "POST",
    body: input,
    // Large clones upload many blobs in batches; allow up to 10 minutes.
    timeoutMs: 600_000,
  });
}

export async function downloadZipBlob(outDir: string): Promise<Blob> {
  const token = getAuthToken();
  const res = await fetch(downloadZipUrl(outDir), {
    headers: token ? { "X-Auth-Token": token } : {},
  });
  const contentType = String(res.headers.get("content-type") || "");
  if (contentType.includes("application/json")) {
    const data = (await res.json()) as {
      error?: string;
      downloadUrl?: string;
      mode?: string;
      parts?: Array<{ url: string; index: number }>;
    };
    if (!res.ok || data.error) throw new ApiError(data.error || `HTTP ${res.status}`, res.status, data);
    if (data.mode === "parts" && Array.isArray(data.parts)) {
      const ordered = data.parts.slice().sort((a, b) => (a.index || 0) - (b.index || 0));
      const chunks: ArrayBuffer[] = [];
      for (const part of ordered) {
        const partRes = await fetch(part.url);
        if (!partRes.ok) throw new ApiError(`Could not download part ${part.index + 1}`, partRes.status);
        chunks.push(await partRes.arrayBuffer());
      }
      return new Blob(chunks, { type: "application/zip" });
    }
    if (data.downloadUrl) {
      const zipRes = await fetch(data.downloadUrl);
      if (!zipRes.ok) throw new ApiError("Could not download export", zipRes.status);
      return zipRes.blob();
    }
    throw new ApiError("Export did not return a download URL", 500, data);
  }
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
  return res.blob();
}
