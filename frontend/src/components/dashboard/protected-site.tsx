import { useEffect, useRef, useState } from "react";
import { Check, Download, ExternalLink, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { markHelperInstalled } from "@/lib/api";
import {
  HELPER_INSTALL_URL,
  captureWithHelper,
  detectHelper,
  onHelperReady,
  type HelperProgress,
} from "@/lib/helper";

/** Published store listing configured → one-click install; otherwise a downloadable package. */
const FROM_STORE =
  /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com|microsoftedge\.microsoft\.com)\//.test(
    HELPER_INSTALL_URL,
  );

type Props = {
  site: string;
  vendor: string;
  url: string;
  jobId: string;
  token: string;
  /** Page budget of the clone (Max pages / Depth). */
  maxPages?: number;
  depth?: number;
  /** The capture was uploaded: the server is building the clone (job is running again). */
  onUploaded: () => void;
};

type Step = "detecting" | "install" | "capturing" | "error";

const STAGE_TEXT: Record<string, (p: HelperProgress) => string> = {
  permission: (p) =>
    `Allow Clonyfy Helper to read ${p.site || "the site"} in the small window (once per site).`,
  opening: () => "Opening the page in your browser…",
  challenge: (p) =>
    `${p.site || "The site"} is checking that you're human — complete it in the opened tab, the capture continues by itself.`,
  html: (p) =>
    p.pages && p.pages > 1
      ? `Reading page ${p.page ?? 1} of up to ${p.pages}…`
      : "Reading the rendered page…",
  "next-page": (p) => `Opening page ${p.page ?? 2} of up to ${p.pages ?? 2}…`,
  files: (p) =>
    `Reading files ${p.done ?? 0}/${p.total ?? 0}${p.pages && p.pages > 1 ? ` for ${p.pages} pages` : ""}…`,
  "files-done": (p) => `Read ${p.total ?? 0} files.`,
  uploading: (p) =>
    p.pages && p.pages > 1
      ? `Sending ${p.pages} pages to Clonyfy…`
      : "Sending the page to Clonyfy…",
  done: () => "Captured — building your clone.",
};

const STAGE_PROGRESS: Record<string, number> = {
  permission: 8,
  opening: 18,
  challenge: 22,
  "next-page": 30,
  html: 30,
  files: 45,
  "files-done": 85,
  uploading: 92,
  done: 100,
};

export function ProtectedSiteCard({
  site,
  vendor,
  url,
  jobId,
  token,
  maxPages = 1,
  depth = 1,
  onUploaded,
}: Props) {
  const { user, refresh } = useAuth();
  const [step, setStep] = useState<Step>("detecting");
  const [progress, setProgress] = useState<HelperProgress | null>(null);
  const [error, setError] = useState("");
  const started = useRef(false);

  // Installed in this browser? Then skip the card and capture right away.
  useEffect(() => {
    let cancelled = false;
    void detectHelper().then((version) => {
      if (cancelled) return;
      setStep(version ? "capturing" : "install");
    });
    // Appears while the card is open (the user just installed it) → continue automatically.
    const stop = onHelperReady(() => setStep((s) => (s === "install" ? "capturing" : s)));
    const poll = window.setInterval(() => {
      void detectHelper(400).then((v) => v && setStep((s) => (s === "install" ? "capturing" : s)));
    }, 2500);
    return () => {
      cancelled = true;
      stop();
      window.clearInterval(poll);
    };
  }, []);

  // Install-once flag on the account: the card never shows again for this user.
  useEffect(() => {
    if (step !== "capturing" || user?.helperInstalled) return;
    void markHelperInstalled()
      .then(() => refresh())
      .catch(() => {});
  }, [step, user?.helperInstalled, refresh]);

  useEffect(() => {
    if (step !== "capturing" || started.current) return;
    started.current = true;
    setError("");
    setProgress({ stage: "permission", site });
    const run = captureWithHelper({ url, jobId, token, maxPages, depth }, setProgress);
    run.promise
      .then(() => onUploaded())
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "The helper could not capture the page.");
        setStep("error");
      });
    return () => run.cancel();
  }, [step, url, jobId, token, site, maxPages, depth, onUploaded]);

  const pct = progress ? (STAGE_PROGRESS[progress.stage] ?? 10) : 4;
  // Pages fill 18–45%, files 45–85%.
  const pagePct =
    (progress?.stage === "html" || progress?.stage === "next-page") && progress.pages
      ? 18 + Math.round((((progress.page ?? 1) - 1) / progress.pages) * 27)
      : null;
  const filesPct =
    progress?.stage === "files" && progress.total
      ? 45 + Math.round(((progress.done ?? 0) / progress.total) * 40)
      : (pagePct ?? pct);
  const reached = (stage: string) =>
    progress ? (STAGE_PROGRESS[progress.stage] ?? 0) >= STAGE_PROGRESS[stage]! : false;
  const chips: Array<[string, boolean]> = [
    ["HTML", reached("files")],
    ["CSS", reached("files-done")],
    ["JavaScript", reached("files-done")],
    ["Assets", reached("uploading")],
  ];

  return (
    <section className="surface rounded-3xl p-5 md:p-8" aria-live="polite">
      <p className="eyebrow flex items-center gap-2">
        <ShieldCheck size={14} /> Protected site
      </p>

      {step === "detecting" && (
        <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 size={18} className="animate-spin" /> Checking for Clonyfy Helper…
        </div>
      )}

      {step === "install" && (
        <div className="mt-4 max-w-2xl">
          <h2 className="text-2xl font-semibold">{site} blocks automated browsers</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            It's protected by {vendor}, so our servers can't open it. Clonyfy Helper clones it from
            your own browser instead, where you already see the site. Install it once — next time
            protected sites clone with one click.
          </p>
          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex gap-2">
              <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> Copies only the
              public page: layout, styles, scripts, images, fonts
            </li>
            <li className="flex gap-2">
              <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> Never your cookies,
              logins or personal data — and nothing runs in the background
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={HELPER_INSTALL_URL}
              target={FROM_STORE ? "_blank" : undefined}
              rel="noreferrer"
              download={FROM_STORE ? undefined : "clonyfy-helper.zip"}
              className="dashboard-button bg-primary text-primary-foreground"
            >
              {FROM_STORE ? <ExternalLink size={16} /> : <Download size={16} />}
              {FROM_STORE ? "Add Clonyfy Helper to your browser" : "Download Clonyfy Helper"}
            </a>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Waiting for the helper — the clone
              continues automatically once it's installed.
            </span>
          </div>
          {!FROM_STORE && (
            <ol className="mt-5 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
              <li>Unzip the download.</li>
              <li>
                Open <code>chrome://extensions</code> (or <code>edge://extensions</code>) and turn
                on Developer mode.
              </li>
              <li>Click "Load unpacked" and choose the unzipped folder, then come back here.</li>
            </ol>
          )}
        </div>
      )}

      {step === "capturing" && (
        <div className="mt-4 max-w-2xl">
          <h2 className="text-2xl font-semibold">Cloning {site}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {progress ? (STAGE_TEXT[progress.stage]?.(progress) ?? "Working…") : "Starting…"}
          </p>
          <div
            className="mt-5 h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={filesPct}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${filesPct}%` }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map(([label, ok]) => (
              <span
                key={label}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                  ok
                    ? "border-foreground/40 text-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {label} {ok ? <Check size={12} /> : null}
              </span>
            ))}
          </div>
        </div>
      )}

      {step === "error" && (
        <div className="mt-4 max-w-2xl">
          <h2 className="text-2xl font-semibold">Couldn't capture {site}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            className="dashboard-button mt-5 bg-primary text-primary-foreground"
            onClick={() => {
              started.current = false;
              setProgress(null);
              setStep("capturing");
            }}
          >
            <RotateCcw size={16} /> Try again
          </button>
        </div>
      )}
    </section>
  );
}
