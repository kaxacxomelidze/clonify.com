import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  LayoutDashboard,
  Loader2,
  LogOut,
  PenTool,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { BrandMark } from "@/components/site/brand";
import { HardPaywall } from "@/components/dashboard/hard-paywall";
import { CloneProgress } from "@/components/dashboard/clone-progress";
import { VisualEditor } from "@/components/dashboard/visual-editor";
import { EditorExportDialog } from "@/components/dashboard/editor-export";
import { StepDots, StepRail } from "@/components/onboarding/step-rail";
import { useAuth } from "@/hooks/use-auth";
import { useInteractivePreview } from "@/hooks/use-interactive-preview";
import { useWhopReturn } from "@/hooks/use-whop-return";
import { ApiError, fetchJobStatus, startClone, track } from "@/lib/api";

type StartSearch = { step?: "customize" | "unlocked"; outDir?: string };

export const Route = createFileRoute("/start")({
  validateSearch: (search: Record<string, unknown>): StartSearch => {
    const out: StartSearch = {};
    const step = search["step"];
    const outDir = search["outDir"];
    if (step === "customize" || step === "unlocked") out.step = step;
    if (typeof outDir === "string" && outDir && outDir.length <= 300) out.outDir = outDir;
    return out;
  },
  head: () => ({
    meta: [{ title: "Create your website — Clonyfy" }, { name: "robots", content: "noindex" }],
  }),
  component: StartPage,
});

/**
 * Guided onboarding (the client's flow): 1. paste a URL (nothing else on screen) →
 * 2. watch it rebuild (the same animation as in the app) → 3. customize theme and design →
 * 4. Export opens the paywall → 5. after payment, export unlocks with full access.
 */
type Step = "url" | "generating" | "ready" | "customize" | "unlocked";
const STEP_INDEX: Record<Step, number> = {
  url: 0,
  generating: 1,
  ready: 2,
  customize: 2,
  unlocked: 3,
};

/** Survives a reload while a clone runs or waits on the ready screen (this tab only). */
const SESSION_KEY = "clonyfy_onboarding";
type Saved = { step: "generating" | "ready"; jobId?: string; outDir?: string; domain: string };
function readSaved(): Saved | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const saved = raw ? (JSON.parse(raw) as Saved) : null;
    return saved && (saved.step === "generating" || saved.step === "ready") ? saved : null;
  } catch {
    return null;
  }
}
function writeSaved(value: Saved | null) {
  try {
    if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage is optional */
  }
}

function parseSiteUrl(raw: string): URL | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      !url.hostname.includes(".") ||
      url.username ||
      url.password
    )
      return null;
    return url;
  } catch {
    return null;
  }
}

function domainFromOutDir(outDir: string) {
  return (
    outDir
      .split(/[\\/]/)
      .pop()
      ?.replace(/-[a-f0-9]{6}$/, "")
      .replace(/-/g, ".") || "your website"
  );
}

function StartPage() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const whop = useWhopReturn();
  const paid = !!user && String(user.plan || "free").toLowerCase() !== "free";

  const [step, setStep] = useState<Step | null>(null);
  const [url, setUrl] = useState("");
  const [domain, setDomain] = useState("");
  const [jobId, setJobId] = useState("");
  const [outDir, setOutDir] = useState("");
  const [progress, setProgress] = useState(0);
  const [jobStatus, setJobStatus] = useState("");
  const [error, setError] = useState("");
  const [paywall, setPaywall] = useState<{ source: string; returnPath?: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const initialized = useRef(false);
  const { src: previewSrc } = useInteractivePreview(outDir || undefined, step === "ready");

  // Where to start: signed-out → login; paid → the app (unless just back from paying);
  // otherwise the step in the URL, then a clone running in this tab, then step 1.
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    if (initialized.current) return;
    initialized.current = true;
    const backFromPayment = whop !== "none";
    if (backFromPayment || (search.step === "unlocked" && paid)) {
      setOutDir(search.outDir || "");
      setDomain(search.outDir ? domainFromOutDir(search.outDir) : "");
      setStep("unlocked");
      return;
    }
    if (paid) {
      void navigate({ to: "/dashboard", replace: true });
      return;
    }
    track("onboarding_started");
    if ((search.step === "customize" || search.step === "unlocked") && search.outDir) {
      setOutDir(search.outDir);
      setDomain(domainFromOutDir(search.outDir));
      setStep("customize");
      return;
    }
    const saved = readSaved();
    if (saved?.step === "generating" && saved.jobId) {
      setDomain(saved.domain);
      setJobId(saved.jobId);
      if (saved.outDir) setOutDir(saved.outDir);
      setProgress(5);
      setStep("generating");
      return;
    }
    if (saved?.step === "ready" && saved.outDir) {
      setDomain(saved.domain);
      setOutDir(saved.outDir);
      setStep("ready");
      return;
    }
    // A URL pasted on the landing page before signing up.
    try {
      const pending = sessionStorage.getItem("clonyfy_pending_clone_url");
      if (pending) {
        setUrl(pending);
        sessionStorage.removeItem("clonyfy_pending_clone_url");
      }
    } catch {
      /* ignore */
    }
    setStep("url");
  }, [loading, isAuthenticated, paid, whop, search.step, search.outDir, navigate]);

  // Browser back/forward between the ready screen and the editor.
  useEffect(() => {
    if (!initialized.current || step === null || step === "unlocked") return;
    if (search.step === "customize" && search.outDir) {
      setOutDir(search.outDir);
      setStep("customize");
    } else if (!search.step && step === "customize") {
      setStep(outDir ? "ready" : "url");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.step, search.outDir]);

  async function generate(event: FormEvent) {
    event.preventDefault();
    const target = parseSiteUrl(url);
    if (!target) {
      setError("Enter a website address, like example.com.");
      return;
    }
    const host = target.hostname.replace(/^www\./, "");
    setError("");
    setDomain(host);
    setOutDir("");
    setJobStatus("running");
    setProgress(3);
    setStep("generating");
    try {
      const job = await startClone({ url: target.href, maxPages: 8, depth: 2 });
      setJobId(job.id);
      if (job.outDir) setOutDir(job.outDir);
      writeSaved({
        step: "generating",
        jobId: job.id,
        domain: host,
        ...(job.outDir ? { outDir: job.outDir } : {}),
      });
    } catch (err) {
      setStep("url");
      const message = err instanceof ApiError ? err.message : "Couldn't start. Please try again.";
      setError(message);
      // Free clones for this month are used up: the plans are the way forward.
      if (err instanceof ApiError && (err.status === 429 || err.status === 402)) {
        setPaywall({ source: "onboarding_limit" });
      }
    }
  }

  // Poll the clone; the bar also drifts forward so it never looks stuck.
  useEffect(() => {
    if (step !== "generating" || !jobId) return;
    let cancelled = false;
    const drift = window.setInterval(() => {
      setProgress((p) => (p < 88 ? p + Math.max(0.3, (88 - p) * 0.035) : p));
    }, 400);
    const poll = async () => {
      try {
        const job = await fetchJobStatus(jobId);
        if (cancelled) return;
        const status = String(job.status || "");
        const pages = Number(job.pages) || 0;
        setJobStatus(status);
        if (job.outDir) setOutDir(job.outDir);
        const pct =
          status === "done"
            ? 100
            : status === "saving"
              ? 95
              : Math.min(90, Math.round((pages / 8) * 85) + 5);
        setProgress((p) => Math.max(p, pct));
        if (status === "done") {
          window.clearInterval(timer);
          window.clearInterval(drift);
          const dir = job.outDir || outDir;
          writeSaved(dir ? { step: "ready", outDir: dir, domain } : null);
          window.setTimeout(() => !cancelled && setStep("ready"), 700);
        } else if (status === "error" || status === "needs_helper") {
          window.clearInterval(timer);
          window.clearInterval(drift);
          writeSaved(null);
          setStep("url");
          setError(
            status === "needs_helper"
              ? "That site blocks automated visitors. Try a different URL to continue."
              : "The rebuild didn't finish. Try another URL.",
          );
        }
      } catch {
        /* keep polling */
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearInterval(drift);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, jobId]);

  function goCustomize() {
    if (!outDir) return;
    setStep("customize");
    void navigate({ to: "/start", search: { step: "customize", outDir } });
  }

  /** Step 4: Export → paywall. After paying, Whop brings the user back to step 5. */
  function onExport() {
    track("onboarding_completed", { domain });
    setPaywall({
      source: "onboarding_export",
      returnPath: `/start?step=unlocked&outDir=${encodeURIComponent(outDir)}`,
    });
  }

  async function signOut() {
    await logout().catch(() => {});
    writeSaved(null);
    void navigate({ to: "/" });
  }

  const paywallModal = paywall && (
    <HardPaywall
      source={paywall.source}
      onClose={() => setPaywall(null)}
      {...(paywall.returnPath ? { returnPath: paywall.returnPath } : {})}
    />
  );

  if (step === null) {
    return <div className="min-h-dvh bg-background" aria-busy="true" />;
  }

  // Step 3: the editor gets the whole screen; the steps sit in its top strip.
  if (step === "customize" && outDir) {
    return (
      <div className="dashboard-shell flex h-dvh flex-col bg-background text-foreground">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-hairline px-3 sm:px-4">
          <BrandMark className="h-6 w-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <StepDots current={STEP_INDEX.customize} />
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut size={14} /> <span className="hidden sm:inline">Log out</span>
          </button>
        </header>
        <div className="min-h-0 flex-1">
          <VisualEditor outDir={outDir} variant="onboarding" onExport={onExport} />
        </div>
        {paywallModal}
      </div>
    );
  }

  const current = STEP_INDEX[step];

  return (
    <main className="dashboard-shell relative min-h-dvh bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <span className="flex items-center gap-2">
          <BrandMark className="h-7 w-7" />
          <span className="text-sm font-medium">Clonyfy</span>
        </span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut size={14} /> Log out
        </button>
      </header>

      <div className="px-5 sm:px-8 lg:hidden">
        <StepDots current={current} />
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 pb-20 pt-6 sm:px-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-14 lg:pt-10">
        <aside className="hidden lg:block">
          <div className="sticky top-[16vh]">
            <StepRail current={current} />
          </div>
        </aside>

        <section className="min-w-0">
          {step === "url" && (
            <div className="mx-auto flex max-w-2xl flex-col items-center pt-[6vh] text-center lg:pt-[10vh]">
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Step 1 — paste a website
              </span>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Clone any website
                <br />
                <span className="text-muted-foreground">in seconds with AI.</span>
              </h1>
              <p className="mt-4 max-w-md text-sm text-muted-foreground">
                Paste a URL. Clonyfy rebuilds it into a website you can customize and export.
              </p>
              <form onSubmit={generate} className="mt-9 w-full">
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-accent/30 p-2 pl-5 focus-within:border-foreground/40">
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    inputMode="url"
                    autoFocus
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="https://stripe.com"
                    aria-label="Website URL to clone"
                    className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    type="submit"
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                  >
                    Generate <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
              {error && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          )}

          {step === "generating" && (
            <div className="@container">
              <div className="mb-6 text-center lg:text-left">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Rebuilding {domain || "your website"}…
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Capturing pages, assets and layout. This usually takes under a minute.
                </p>
              </div>
              <CloneProgress
                domain={domain || "your website"}
                progress={progress}
                phase="running"
                status={jobStatus}
              />
            </div>
          )}

          {step === "ready" && (
            <div>
              <div className="text-center">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Your clone of {domain} is ready.
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Now make it yours: change the text, images, colors and fonts.
                </p>
              </div>
              <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-accent/20">
                <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-foreground/20" />
                  <span className="h-2.5 w-2.5 rounded-full bg-foreground/20" />
                  <span className="h-2.5 w-2.5 rounded-full bg-foreground/20" />
                  <span className="ml-2 truncate text-xs text-muted-foreground">{domain}</span>
                </div>
                {previewSrc ? (
                  <iframe
                    title="Your cloned website"
                    src={previewSrc}
                    className="h-[58vh] w-full bg-white"
                    sandbox="allow-scripts allow-same-origin"
                  />
                ) : (
                  <div className="grid h-[58vh] place-items-center text-sm text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}
              </div>
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={goCustomize}
                  disabled={!outDir}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <PenTool className="h-4 w-4" /> Customize Website
                </button>
              </div>
            </div>
          )}

          {step === "unlocked" && (
            <UnlockedStep
              paid={paid}
              whop={whop}
              domain={domain}
              hasClone={!!outDir}
              onExport={() => setExportOpen(true)}
            />
          )}
        </section>
      </div>

      {paywallModal}
      {paid && outDir && (
        <EditorExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          outDir={outDir}
          domain={domain}
          route="/"
          figmaIncluded={String(user?.plan).toLowerCase() !== "starter"}
          onUpgradeForFigma={() =>
            void navigate({ to: "/checkout", search: { plan: "growth" } as never })
          }
        />
      )}
    </main>
  );
}

/** Step 5: payment done → export unlocked + full access to the platform. */
function UnlockedStep({
  paid,
  whop,
  domain,
  hasClone,
  onExport,
}: {
  paid: boolean;
  whop: ReturnType<typeof useWhopReturn>;
  domain: string;
  hasClone: boolean;
  onExport: () => void;
}) {
  if (!paid) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center pt-[8vh] text-center">
        {whop === "pending" ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Payment received</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Whop is still confirming it. This usually takes less than a minute.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-medium hover:bg-accent"
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </>
        ) : (
          <>
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            <h1 className="mt-6 text-2xl font-semibold tracking-tight">
              Payment received — unlocking your account…
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">One moment, please.</p>
          </>
        )}
      </div>
    );
  }
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center pt-[6vh] text-center">
      <CheckCircle2 className="h-12 w-12 text-emerald-400" />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        Export is unlocked.
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {hasClone
          ? `Your plan is active. Export ${domain || "your website"} now — and the whole Clonyfy platform is yours.`
          : "Your plan is active and the whole Clonyfy platform is yours."}
      </p>
      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        {hasClone && (
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            <Download className="h-4 w-4" /> Export my website
          </button>
        )}
        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-7 py-3.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          <LayoutDashboard className="h-4 w-4" /> Go to my dashboard
        </Link>
      </div>
    </div>
  );
}
