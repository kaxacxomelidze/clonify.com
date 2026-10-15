/**
 * Talks to the Clonyfy Helper browser extension (extension/bridge.js) with
 * window.postMessage. The helper captures protected sites in the user's own browser.
 */
import { getApiBaseUrl } from "@/lib/api";

const APP = "clonyfy-app";
const HELPER = "clonyfy-helper";

/** Where the helper is installed from: the store listing (set VITE_HELPER_INSTALL_URL once published). */
export const HELPER_INSTALL_URL: string =
  (import.meta.env["VITE_HELPER_INSTALL_URL"] as string | undefined) || "/clonyfy-helper.zip";

export type HelperStage =
  | "permission"
  | "opening"
  | "challenge"
  | "html"
  | "files"
  | "files-done"
  | "uploading"
  | "done"
  | "error";

export type HelperProgress = {
  stage: HelperStage;
  site?: string;
  done?: number;
  total?: number;
  css?: number;
  js?: number;
  assets?: number;
  files?: number;
  read?: number;
  message?: string;
};

type HelperMessage = {
  source?: string;
  type?: string;
  requestId?: string;
  version?: string;
} & Partial<HelperProgress>;

let knownVersion: string | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    const msg = event.data as HelperMessage;
    if (event.source !== window || msg?.source !== HELPER) return;
    if ((msg.type === "helper_ready" || msg.type === "pong") && msg.version)
      knownVersion = msg.version;
  });
}

/** Is the helper installed in this browser? Resolves with its version, or null. */
export function detectHelper(timeoutMs = 700): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (knownVersion) return Promise.resolve(knownVersion);
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const msg = event.data as HelperMessage;
      if (event.source !== window || msg?.source !== HELPER) return;
      if ((msg.type === "pong" || msg.type === "helper_ready") && msg.version) {
        knownVersion = msg.version;
        window.removeEventListener("message", onMessage);
        resolve(msg.version);
      }
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ source: APP, type: "ping" }, window.location.origin);
    window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve(knownVersion);
    }, timeoutMs);
  });
}

/** Calls back once the helper shows up (e.g. right after the user installs it). */
export function onHelperReady(callback: (version: string) => void): () => void {
  const onMessage = (event: MessageEvent) => {
    const msg = event.data as HelperMessage;
    if (event.source !== window || msg?.source !== HELPER) return;
    if ((msg.type === "helper_ready" || msg.type === "pong") && msg.version) callback(msg.version);
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}

/**
 * Capture `url` in the user's browser and upload it to the blocked clone job. Progress
 * comes through `onProgress`; resolves when the upload is accepted.
 */
export function captureWithHelper(
  input: { url: string; jobId: string; token: string },
  onProgress: (p: HelperProgress) => void,
): { promise: Promise<HelperProgress>; cancel: () => void } {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let onMessage: ((event: MessageEvent) => void) | null = null;
  const promise = new Promise<HelperProgress>((resolve, reject) => {
    onMessage = (event: MessageEvent) => {
      const msg = event.data as HelperMessage;
      if (event.source !== window || msg?.source !== HELPER || msg.type !== "progress") return;
      if (msg.requestId !== requestId || !msg.stage) return;
      const progress = msg as HelperProgress;
      onProgress(progress);
      if (msg.stage === "done") {
        cleanup();
        resolve(progress);
      } else if (msg.stage === "error") {
        cleanup();
        reject(new Error(msg.message || "The helper could not capture the page."));
      }
    };
    window.addEventListener("message", onMessage);
    window.postMessage(
      {
        source: APP,
        type: "capture",
        requestId,
        url: input.url,
        jobId: input.jobId,
        token: input.token,
        apiBase: getApiBaseUrl(),
      },
      window.location.origin,
    );
  });
  const cleanup = () => {
    if (onMessage) window.removeEventListener("message", onMessage);
    onMessage = null;
  };
  return { promise, cancel: cleanup };
}
