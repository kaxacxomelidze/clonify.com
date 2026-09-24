import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  Download,
  Figma,
  Github,
  Globe,
  Pencil,
  Play,
  RotateCcw,
} from "lucide-react";
import { CapturePipeline } from "@/components/dashboard/pipeline";
import { ScanningBrowser } from "@/components/dashboard/demo-preview";
import { ExportFigmaDialog } from "@/components/dashboard/export-figma-dialog";
import { GitHubPushDialog } from "@/components/dashboard/github-push-dialog";
import { useDashboardWorkspace } from "@/components/dashboard/workspace";
import type { CloneJob } from "@/components/dashboard/data";
import {
  ApiError,
  downloadZipBlob,
  pagePreviewUrl,
  triggerBrowserDownload,
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Clone a website — Clonyfy dashboard" },
      {
        name: "description",
        content: "Clone a website, edit pages, export ZIP / Figma, and push to GitHub.",
      },
    ],
  }),
  component: ClonePage,
});

const STAGES = [
  { title: "Connect to source", detail: "Resolve the URL and prepare a browser session.", at: 0 },
  {
    title: "Explore every page",
    detail: "Scroll through sections and discover linked pages.",
    at: 12,
  },
  {
    title: "Collect the assets",
    detail: "Gather images, type, styles and responsive details.",
    at: 40,
  },
  {
    title: "Build the starting point",
    detail: "Write captured HTML and persist for preview.",
    at: 64,
  },
  {
    title: "Prepare your workspace",
    detail: "Finalize storage so editor and exports unlock.",
    at: 84,
  },
];

type Run = {
  id: string;
  domain: string;
  pages: number;
  depth: number;
  respectRobots: boolean;
  fullSite?: boolean;
  outDir?: string;
  assets?: number;
  routes?: number;
  startedAt?: string;
  status?: string;
};

function ClonePage() {
  const { addJob, refreshJobs } = useDashboardWorkspace();
  const { user, usage } = useAuth();
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(8);
  const [depth, setDepth] = useState(2);
  const [respectRobots, setRespectRobots] = useState(true);
  const [maxMode, setMaxMode] = useState(false);
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [logTail, setLogTail] = useState<string[]>([]);
  const [githubOpen, setGithubOpen] = useState(false);
  const [figmaOpen, setFigmaOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState("");
  const [zipProgress, setZipProgress] = useState<{ pct: number; stage: string } | null>(null);
  const busy = phase === "running";
  const stage = STAGES.reduce((active, item, index) => (progress >= item.at ? index : active), 0);
  const fullSiteAllowed =
    user?.planLimits?.fullSiteAllowed === true || usage?.limits?.fullSiteAllowed === true;
  const useMax = fullSiteAllowed && maxMode;

  useEffect(() => {
    try {
      const pending = sessionStorage.getItem("clonyfy_pending_clone_url");
      if (pending) {
        setUrl(pending);
        sessionStorage.removeItem("clonyfy_pending_clone_url");
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!fullSiteAllowed && maxMode) setMaxMode(false);
  }, [fullSiteAllowed, maxMode]);

  useEffect(() => {
    if (phase !== "running" || !run?.id) return;
    const jobId = run.id;
    const fullSiteRun = !!run.fullSite;
    const targetPages = Math.max(1, fullSiteRun ? 50 : run.pages || maxPages);
    let cancelled = false;
    let logsFrom = 0;
    const allLogs: string[] = [];
    const poll = async () => {
      try {
        const { fetchJobStatus } = await import("@/lib/api");
        const job = await fetchJobStatus(jobId, logsFrom);
        if (cancelled) return;
        if (Array.isArray(job.logs) && job.logs.length) {
          allLogs.push(...job.logs);
          logsFrom += job.logs.length;
          setLogTail(allLogs.slice(-8));
        }
        const pages = Number(job.pages) || 0;
        const status = String(job.status || "");
        const pct =
          status === "done"
            ? 100
            : status === "error"
              ? progress
              : status === "saving"
                ? Math.max(progress, 92)
                : fullSiteRun
                  ? Math.min(90, Math.round(8 + Math.min(pages, 200) * 0.4))
                  : Math.min(90, Math.round((pages / targetPages) * 85) + 5);
        setProgress(pct);
        setRun((current) => {
          if (!current || current.id !== jobId) return current;
          const next: Run = {
            ...current,
            pages: pages || current.pages,
            assets: Number(job.assets) || current.assets || 0,
            routes: Number(job.apiRoutes) || current.routes || 0,
            status,
            fullSite: current.fullSite || !!job.fullSite,
          };
          if (job.outDir) next.outDir = job.outDir;
          if (job.startedAt) next.startedAt = job.startedAt;
          return next;
        });
        if (status === "done") {
          const doneJob: CloneJob = {
            id: jobId,
            domain: job.hostname || run.domain,
            pages: pages || run.pages,
            assets: Number(job.assets) || 0,
            routes: Number(job.apiRoutes) || 0,
            elapsed: "—",
            startedAt: job.startedAt
              ? new Date(job.startedAt).toLocaleTimeString("en-US")
              : new Date().toLocaleTimeString("en-US"),
            status: "done",
          };
          if (job.outDir) doneJob.outDir = job.outDir;
          addJob(doneJob);
          void refreshJobs();
          setPhase("done");
          setProgress(100);
          setNotice("Capture complete. Use Edit, ZIP, Figma, or GitHub below.");
          return;
        }
        if (status === "error") {
          const lastErr =
            [...allLogs].reverse().find((l) =>
              /\[ERROR\]|robots\.txt blocks|captured 0 pages|timed out|Page capture timed out|Could not start|Clone process exited/i.test(
                l,
              ),
            ) ||
            [...allLogs].reverse().find((l) => /error/i.test(l)) ||
            "Clone failed. Check the URL and try again.";
          setPhase("error");
          setError(lastErr.replace(/^\[(ERROR|WARN)\]\s*/i, ""));
          addJob({
            id: jobId,
            domain: job.hostname || run.domain,
            pages: pages || 0,
            assets: Number(job.assets) || 0,
            routes: Number(job.apiRoutes) || 0,
            elapsed: "—",
            startedAt: new Date().toLocaleTimeString("en-US"),
            status: "error",
            ...(job.outDir ? { outDir: job.outDir } : {}),
          });
          void refreshJobs();
        }
      } catch (err) {
        if (!cancelled) {
          setNotice(
            err instanceof Error
              ? `Status poll paused: ${err.message}. The Backend job may still be running.`
              : "Status poll paused. The Backend job may still be running.",
          );
        }
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // progress intentionally omitted from deps — used only for saving floor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, run?.id, run?.domain, run?.pages, run?.fullSite, maxPages, addJob, refreshJobs]);

  async function start(source = url) {
    if (busy) return;
    setError("");
    setNotice("");
    setLogTail([]);
    try {
      const parsed = new URL(
        /^https?:\/\//i.test(source.trim()) ? source.trim() : `https://${source.trim()}`,
      );
      if (
        !["https:", "http:"].includes(parsed.protocol) ||
        !parsed.hostname.includes(".") ||
        parsed.username ||
        parsed.password ||
        !/^[a-z0-9.-]+$/i.test(parsed.hostname)
      )
        throw new Error("url");
      if (
        !useMax &&
        (!Number.isInteger(maxPages) ||
          maxPages < 1 ||
          maxPages > 60 ||
          !Number.isInteger(depth) ||
          depth < 1 ||
          depth > 5)
      ) {
        setError("Choose 1–60 pages and a crawl depth of 1–5.");
        return;
      }
      setUrl(parsed.href);
      const { startClone } = await import("@/lib/api");
      const job = await startClone({
        url: parsed.href,
        maxPages: useMax ? 1 : maxPages,
        depth: useMax ? 1 : depth,
        ignoreRobots: !respectRobots,
        fullSite: useMax,
      });
      setRun({
        id: job.id,
        domain: job.hostname || parsed.host,
        // For Max, show captured count (starts at 0). Otherwise keep page budget for progress %.
        pages: useMax ? 0 : job.maxPages || maxPages,
        depth: job.depth || depth,
        respectRobots,
        fullSite: !!(job.fullSite || useMax),
        ...(job.outDir ? { outDir: job.outDir } : {}),
        ...(job.startedAt ? { startedAt: job.startedAt } : {}),
        assets: 0,
        routes: 0,
        status: "running",
      });
      setProgress(2);
      setPhase("running");
      const runningJob: CloneJob = {
        id: job.id,
        domain: job.hostname || parsed.host,
        pages: 0,
        assets: 0,
        routes: 0,
        elapsed: "0s",
        startedAt: new Date().toLocaleTimeString("en-US"),
        status: "running",
      };
      if (job.outDir) runningJob.outDir = job.outDir;
      addJob(runningJob);
      setNotice(
        useMax
          ? "Full-site Max clone started. This can take much longer than a normal capture."
          : "Clone started on the Backend. You can close this tab — the job keeps running.",
      );
    } catch (err) {
      if (err instanceof Error && err.message === "url") {
        setError("Enter a website address such as https://example.com.");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not start clone. Please try again.");
    }
  }

  const withExport = async (key: string, fn: () => Promise<void>) => {
    setExportBusy(key);
    setError("");
    try {
      await fn();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(err.message || "This export requires a paid plan.");
      } else {
        setError(err instanceof ApiError ? err.message : "Export failed.");
      }
    } finally {
      setExportBusy("");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="eyebrow">From inspiration to your next build</p>
        <h1 className="display-lg mt-3">Clone a website.</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Typical small clones (about 3–10 pages) target 2–5 minutes on the hosted Backend. Closing
          the browser does not stop the job.
        </p>
      </header>
      <form
        className="surface rounded-3xl p-5 md:p-8"
        onSubmit={(event) => {
          event.preventDefault();
          void start();
        }}
        noValidate
      >
        <label htmlFor="clone-url" className="eyebrow">
          Website URL
        </label>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="dashboard-search">
            <Globe size={16} className="shrink-0" />
            <input
              id="clone-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={busy}
              placeholder="https://example.com"
              autoComplete="url"
              aria-describedby={error ? "clone-error" : "clone-hint"}
              aria-invalid={!!error}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="dashboard-button bg-primary text-primary-foreground disabled:opacity-50"
          >
            <Play size={16} />
            {busy ? "Cloning…" : "Start clone"}
          </button>
        </div>
        <p id="clone-hint" className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Clones run on the Backend. Progress updates while you stay on this page; the job continues
          if you leave.
        </p>
        <fieldset
          disabled={busy}
          className="mt-6 flex flex-wrap items-center gap-6 disabled:opacity-60"
        >
          <legend className="sr-only">Capture settings</legend>
          <label
            className={`flex items-center gap-3 text-sm text-muted-foreground ${useMax ? "opacity-50" : ""}`}
          >
            Max pages
            <input
              aria-label="Max pages"
              type="number"
              min={1}
              max={60}
              value={maxPages}
              disabled={useMax}
              onChange={(event) => setMaxPages(Number(event.target.value))}
              className="w-20 rounded-xl border border-border bg-transparent p-3 text-foreground disabled:cursor-not-allowed"
            />
          </label>
          <label
            className={`flex items-center gap-3 text-sm text-muted-foreground ${useMax ? "opacity-50" : ""}`}
          >
            Depth
            <input
              aria-label="Depth"
              type="number"
              min={1}
              max={5}
              value={depth}
              disabled={useMax}
              onChange={(event) => setDepth(Number(event.target.value))}
              className="w-20 rounded-xl border border-border bg-transparent p-3 text-foreground disabled:cursor-not-allowed"
            />
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={respectRobots}
              onChange={(event) => setRespectRobots(event.target.checked)}
              className="h-4 w-4 accent-white"
            />
            Respect robots.txt
          </label>
          {fullSiteAllowed && (
            <label
              className="flex min-h-11 items-center gap-3 text-sm"
              title="Clone every discoverable same-origin page at maximum depth (Scale)"
            >
              <input
                type="checkbox"
                checked={maxMode}
                onChange={(event) => setMaxMode(event.target.checked)}
                className="h-4 w-4 accent-white"
                {...(useMax ? { "aria-describedby": "clone-max-hint" } : {})}
              />
              Max
            </label>
          )}
        </fieldset>
        {useMax && (
          <p id="clone-max-hint" className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Max mode clones the full site (all discoverable pages, maximum depth). Page and depth
            limits above are ignored.
          </p>
        )}
        {error && (
          <p id="clone-error" role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
        {!busy && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="mr-2 text-xs text-muted-foreground">Try a sample</span>
            {["stripe.com", "notion.com", "linear.app"].map((domain) => (
              <button
                type="button"
                key={domain}
                className="dashboard-button text-xs"
                onClick={() => void start(`https://${domain}`)}
              >
                {domain} ↗
              </button>
            ))}
          </div>
        )}
      </form>

      {phase === "idle" && <CapturePipeline />}
      {run && phase !== "idle" && (
        <section className="space-y-6" aria-label="Cloning progress">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow">
                {phase === "done"
                  ? "Ready to make yours"
                  : phase === "error"
                    ? "Clone failed"
                    : "Cloning in progress"}
              </p>
              <h2 className="mt-2 break-all font-display text-2xl">{run.domain}</h2>
            </div>
            <div className="flex gap-2">
              {busy ? (
                <button
                  className="dashboard-button"
                  onClick={() => {
                    setPhase("idle");
                    setProgress(0);
                    setNotice("Stopped watching this job. The Backend clone may still finish.");
                  }}
                >
                  Stop watching
                </button>
              ) : (
                <button className="dashboard-button" onClick={() => void start()}>
                  <RotateCcw size={16} />
                  Run again
                </button>
              )}
            </div>
          </div>
          <div className="demo-process-grid">
            <ScanningBrowser domain={run.domain} running={phase === "running"} />
            <div className="surface rounded-3xl p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h3 className="text-sm">
                  {phase === "error"
                    ? "Failed"
                    : phase === "done"
                      ? "Capture complete"
                      : run.status === "saving"
                        ? "Saving to storage…"
                        : "Building your starting point"}
                </h3>
                <span className="text-sm tabular-nums">{progress}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="Clone progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="h-1 overflow-hidden rounded-full bg-accent"
              >
                <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
              <ol className="mt-6 space-y-5">
                {STAGES.map((item, i) => (
                  <li
                    key={item.title}
                    className="flex gap-3"
                    aria-current={stage === i && busy ? "step" : undefined}
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-xs ${i < stage || phase === "done" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                    >
                      {i < stage || phase === "done" ? <Check size={14} /> : `0${i + 1}`}
                    </span>
                    <div>
                      <p className={`text-sm ${stage < i ? "text-muted-foreground" : ""}`}>
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              {logTail.length > 0 && (
                <pre className="mt-6 max-h-40 overflow-auto rounded-xl border border-border bg-background p-3 text-[11px] leading-relaxed text-muted-foreground">
                  {logTail.join("\n")}
                </pre>
              )}
            </div>
          </div>
          {(phase === "done" || phase === "running") && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Pages captured", run.pages || 0],
                ["Assets collected", run.assets || 0],
                ["API routes", run.routes || 0],
                [
                  "Capture mode",
                  run.fullSite
                    ? "Max (full site)"
                    : run.respectRobots
                      ? "Respect robots"
                      : "Ignore robots",
                ],
              ].map(([label, value]) => (
                <div key={label} className="surface rounded-2xl p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-2 text-lg tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {phase === "done" && run?.outDir && (
        <section className="surface rounded-3xl p-5 md:p-8" aria-label="Editor and exports">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Your creative workspace</p>
              <h2 className="mt-2 font-display text-2xl">Edit, export, and publish.</h2>
            </div>
            <Link to="/dashboard/library" className="dashboard-button">
              Open library ↗
            </Link>
          </div>
          <iframe
            title="Clone preview"
            src={pagePreviewUrl(run.outDir)}
            className="mb-6 h-[420px] w-full rounded-2xl border border-border bg-background"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
          <div className="flex flex-wrap gap-2">
            <Link
              to="/dashboard/editor"
              search={{ outDir: run.outDir, route: "/" }}
              className="dashboard-button bg-primary text-primary-foreground"
            >
              <Pencil size={16} />
              Open visual editor
            </Link>
            <button
              type="button"
              className="dashboard-button"
              disabled={!!exportBusy}
              onClick={() =>
                void withExport("zip", async () => {
                  setZipProgress({ pct: 1, stage: "Starting export…" });
                  try {
                    const blob = await downloadZipBlob(run.outDir!, (info) => {
                      setZipProgress({
                        pct: Math.max(1, Math.min(100, Math.round(info.progress))),
                        stage: info.stage || "Working…",
                      });
                    });
                    triggerBrowserDownload(blob, `${run.domain || "clone"}.zip`);
                    setZipProgress({ pct: 100, stage: "Complete" });
                    setNotice("ZIP downloaded.");
                  } finally {
                    setZipProgress(null);
                  }
                })
              }
            >
              <Download size={16} />
              {exportBusy === "zip"
                ? `ZIP ${zipProgress?.pct ?? 0}%`
                : "Download ZIP"}
            </button>
            {exportBusy === "zip" && zipProgress && (
              <div className="zip-export-progress w-full basis-full" aria-live="polite">
                <div className="zip-export-progress__meta">
                  <span className="zip-export-progress__stage">{zipProgress.stage}</span>
                  <span className="zip-export-progress__pct tabular-nums">{zipProgress.pct}%</span>
                </div>
                <div
                  className="zip-export-progress__track"
                  role="progressbar"
                  aria-label="ZIP export progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={zipProgress.pct}
                >
                  <div
                    className="zip-export-progress__fill"
                    style={{ width: `${zipProgress.pct}%` }}
                  />
                </div>
              </div>
            )}
            <button
              type="button"
              className="dashboard-button"
              onClick={() => setFigmaOpen(true)}
            >
              <Figma size={16} />
              Export to Figma
            </button>
            <button
              type="button"
              className="dashboard-button"
              onClick={() => setGithubOpen(true)}
            >
              <Github size={16} />
              Push to GitHub
            </button>
          </div>
          <GitHubPushDialog
            open={githubOpen}
            onOpenChange={setGithubOpen}
            outDir={run.outDir}
            domain={run.domain}
          />
          <ExportFigmaDialog
            open={figmaOpen}
            onOpenChange={setFigmaOpen}
            outDir={run.outDir}
            domain={run.domain}
          />
        </section>
      )}
      <p className="text-sm text-muted-foreground" role="status">
        {notice}
      </p>
    </div>
  );
}
