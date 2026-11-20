import { Check } from "lucide-react";
import { CloneEngine } from "@/components/dashboard/clone-engine";

/** The clone run's stages, shown next to the live browser animation. */
export const CLONE_STAGES = [
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

export function cloneStageIndex(progress: number) {
  return CLONE_STAGES.reduce((active, item, index) => (progress >= item.at ? index : active), 0);
}

/**
 * The clone animation used everywhere a site is being rebuilt (dashboard and onboarding):
 * the scanning browser on the left, the progress bar and stage list on the right.
 */
export function CloneProgress({
  domain,
  progress,
  phase,
  status,
  logTail,
}: {
  domain: string;
  progress: number;
  phase: "running" | "done" | "error";
  /** The server's job status ("saving" shows its own title). */
  status?: string | undefined;
  logTail?: string[] | undefined;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const stage = cloneStageIndex(pct);
  const busy = phase === "running";
  return (
    <div className="demo-process-grid">
      <CloneEngine domain={domain} running={busy} />
      <div className="surface rounded-3xl p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-sm">
            {phase === "error"
              ? "Failed"
              : phase === "done"
                ? "Capture complete"
                : status === "saving"
                  ? "Saving to storage…"
                  : "Building your starting point"}
          </h3>
          <span className="text-sm tabular-nums">{pct}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Clone progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-1 overflow-hidden rounded-full bg-accent"
        >
          <div
            className="h-full bg-primary transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <ol className="mt-6 space-y-5">
          {CLONE_STAGES.map((item, i) => (
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
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        {logTail && logTail.length > 0 && (
          <pre className="mt-6 max-h-40 overflow-auto rounded-xl border border-border bg-background p-3 text-[11px] leading-relaxed text-muted-foreground">
            {logTail.join("\n")}
          </pre>
        )}
      </div>
    </div>
  );
}
