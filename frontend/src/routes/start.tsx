import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Figma, Loader2, Lock, PenTool, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/site/brand";
import { HardPaywall } from "@/components/dashboard/hard-paywall";
import { useAuth } from "@/hooks/use-auth";
import { useInteractivePreview } from "@/hooks/use-interactive-preview";
import { ApiError, fetchJobStatus, startClone, track } from "@/lib/api";

export const Route = createFileRoute("/start")({
  head: () => ({
    meta: [
      { title: "Clone your first site — Clonyfy" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StartPage,
});

type Step = "url" | "generating" | "ready";

function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function StartPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  const [domain, setDomain] = useState("");
  const [jobId, setJobId] = useState("");
  const [outDir, setOutDir] = useState("");
  const [progress, setProgress] = useState(0);
  const [pages, setPages] = useState(0);
  const [error, setError] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const { src: previewSrc } = useInteractivePreview(outDir || undefined, step === "ready");
  const timers = useRef<number[]>([]);

  // Onboarding is for free users. Signed-out → login; already paid → straight to the app.
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) void navigate({ to: "/login" });
    else if (user && String(user.plan).toLowerCase() !== "free")
      void navigate({ to: "/dashboard" });
  }, [loading, isAuthenticated, user, navigate]);

  useEffect(() => {
    track("onboarding");
    return () => timers.current.forEach((t) => window.clearInterval(t));
  }, []);

  async function generate(event: FormEvent) {
    event.preventDefault();
    const target = normalizeUrl(url);
    if (!target) return;
    setError("");
    try {
      setDomain(new URL(target).hostname.replace(/^www\./, ""));
    } catch {
      setError("That doesn't look like a valid website address.");
      return;
    }
    setStep("generating");
    setProgress(6);
    try {
      const job = await startClone({ url: target, maxPages: 8, depth: 2 });
      setJobId(job.id);
      if (job.outDir) setOutDir(job.outDir);
    } catch (err) {
      setStep("url");
      setError(err instanceof ApiError ? err.message : "Couldn't start. Please try again.");
    }
  }

  // Poll the clone job and drift the progress bar forward while it runs.
  useEffect(() => {
    if (step !== "generating" || !jobId) return;
    let cancelled = false;
    const drift = window.setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.max(0.4, (90 - p) * 0.04) : p));
    }, 400);
    const poll = window.setInterval(async () => {
      try {
        const job = await fetchJobStatus(jobId);
        if (cancelled) return;
        const status = String(job.status || "");
        if (Number(job.pages)) setPages(Number(job.pages));
        if (job.outDir) setOutDir(job.outDir);
        if (status === "done") {
          setProgress(100);
          window.clearInterval(poll);
          window.clearInterval(drift);
          window.setTimeout(() => !cancelled && setStep("ready"), 450);
        } else if (status === "error" || status === "needs_helper") {
          window.clearInterval(poll);
          window.clearInterval(drift);
          setStep("url");
          setError(
            status === "needs_helper"
              ? "That site blocks automated visitors. Try a different URL to continue."
              : "The clone didn't finish. Try another URL.",
          );
        }
      } catch {
        /* keep polling */
      }
    }, 2000);
    timers.current.push(poll, drift);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearInterval(drift);
    };
  }, [step, jobId]);

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/dashboard" aria-label="Clonyfy" className="flex items-center gap-2">
          <BrandMark className="h-7 w-7" />
          <span className="text-sm font-medium">Clonyfy</span>
        </Link>
        <Link
          to="/dashboard"
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Skip for now
        </Link>
      </header>

      {step === "url" && (
        <section className="mx-auto flex max-w-3xl flex-col items-center px-5 pb-24 pt-[12vh] text-center">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Step 1 — paste a website
          </span>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Turn any website into
            <br />
            <span className="text-muted-foreground">your own editable copy.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            Paste a URL and watch Clonyfy rebuild it in seconds. No setup, no code.
          </p>
          <form onSubmit={generate} className="mt-9 w-full max-w-2xl">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-accent/30 p-2 pl-5 focus-within:border-foreground/40">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                inputMode="url"
                autoFocus
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
        </section>
      )}

      {step === "generating" && (
        <section className="mx-auto flex max-w-2xl flex-col items-center px-5 pb-24 pt-[16vh] text-center">
          <div className="relative grid h-20 w-20 place-items-center">
            <div className="absolute inset-0 animate-ping rounded-full border border-foreground/20" />
            <BrandMark className="h-10 w-10 animate-pulse" />
          </div>
          <h2 className="mt-8 text-2xl font-semibold tracking-tight">
            Rebuilding {domain || "your site"}…
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Capturing pages, assets and layout. This usually takes under a minute.
          </p>
          <div className="mt-8 w-full max-w-md">
            <div className="h-2 w-full overflow-hidden rounded-full bg-accent">
              <div
                className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-out"
                style={{ width: `${Math.min(100, Math.round(progress))}%` }}
              />
            </div>
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              {Math.min(100, Math.round(progress))}%{pages ? ` · ${pages} pages` : ""}
            </p>
          </div>
        </section>
      )}

      {step === "ready" && (
        <section className="mx-auto max-w-5xl px-5 pb-24 pt-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              Your clone of {domain} is ready.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Customize the design, then export the code when you're happy.
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
                title="Your cloned site"
                src={previewSrc}
                className="h-[62vh] w-full bg-white"
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <div className="grid h-[62vh] place-items-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {outDir && (
              <Link
                to="/dashboard/editor"
                search={{ outDir, route: "/" } as never}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-accent"
              >
                <PenTool className="h-4 w-4" /> Customize design
              </Link>
            )}
            <button
              type="button"
              onClick={() => setShowPaywall(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              <Lock className="h-4 w-4" /> Export &amp; unlock full access
            </button>
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Figma className="h-3.5 w-3.5" /> Code &amp; ZIP export, Figma and the full platform
            unlock after you pick a plan.
          </p>
        </section>
      )}

      {showPaywall && <HardPaywall onClose={() => setShowPaywall(false)} />}
    </main>
  );
}
