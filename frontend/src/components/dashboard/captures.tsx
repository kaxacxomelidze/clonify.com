import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Download,
  ExternalLink,
  Eye,
  Figma,
  Github,
  Link2,
  Pencil,
  Search,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { CloneJob, CloneStatus } from "./data";
import { ExportFigmaDialog } from "./export-figma-dialog";
import { GitHubPushDialog } from "./github-push-dialog";
import {
  ApiError,
  createShareLink,
  deleteOutput,
  downloadZipBlob,
  getApiBaseUrl,
  pagePreviewUrl,
  previewClone,
  stopClone,
  triggerBrowserDownload,
} from "@/lib/api";

export const STATUS_LABELS: Record<CloneStatus, string> = {
  done: "Complete",
  running: "Running",
  queued: "Queued",
  error: "Failed",
};

export function downloadCaptureReport(jobs: CloneJob[]) {
  const rows = [
    ["Domain", "Status", "Pages", "Assets", "API routes", "Elapsed", "Started"],
    ...jobs.map((job) => [
      job.domain,
      STATUS_LABELS[job.status],
      job.pages,
      job.assets,
      job.routes,
      job.elapsed,
      job.startedAt,
    ]),
  ];
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "clonyfy-captures.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CaptureStatus({ status }: { status: CloneStatus }) {
  return (
    <span className="capture-status" data-status={status}>
      <svg
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className={status === "running" ? "capture-spinner" : ""}
      >
        {status === "done" ? (
          <path
            d="m3.5 8 3 3 6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : status === "error" ? (
          <path
            d="M5 5l6 6M11 5l-6 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        ) : (
          <>
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" opacity=".25" strokeWidth="1.5" />
            <path
              d={status === "running" ? "M8 2.5A5.5 5.5 0 0 1 13.5 8" : "M8 5v3l2 1"}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
      {STATUS_LABELS[status]}
    </span>
  );
}

function absoluteApiUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = getApiBaseUrl().replace(/\/$/, "");
  return `${base}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

export function CaptureDetails({
  job,
  onClose,
  onDeleted,
}: {
  job: CloneJob | null;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const [busy, setBusy] = useState("");
  const [zipProgress, setZipProgress] = useState<{ pct: number; stage: string } | null>(null);
  const [iframeError, setIframeError] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [figmaOpen, setFigmaOpen] = useState(false);
  const canPreview = !!job?.outDir && job.status === "done";
  const previewSrc = canPreview && job?.outDir ? pagePreviewUrl(job.outDir) : "";

  const paidGateMessage = (err: unknown, feature: string) => {
    if (err instanceof ApiError && err.status === 403) {
      return err.message || `${feature} requires a paid plan. Upgrade in Subscription.`;
    }
    return err instanceof ApiError ? err.message : `${feature} failed.`;
  };

  const stopRunningClone = async () => {
    if (!job) return;
    if (!window.confirm(`Stop cloning ${job.domain}? Pages captured so far will be kept.`)) return;
    setBusy("stop");
    try {
      await stopClone(job.id);
      toast.success("Stopping clone — saving the pages captured so far.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not stop the clone.");
    } finally {
      setBusy("");
    }
  };

  const openPreview = async () => {
    if (!job?.outDir) {
      toast.error("Preview is available after the clone finishes.");
      return;
    }
    setBusy("preview");
    try {
      const data = await previewClone(job.outDir);
      const url = data.url?.startsWith("http") ? data.url : pagePreviewUrl(job.outDir);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Could not open preview. The Backend may still be waking or files were not persisted.",
      );
    } finally {
      setBusy("");
    }
  };

  const downloadZip = async () => {
    if (!job?.outDir) {
      toast.error("ZIP export is available after the clone finishes.");
      return;
    }
    setBusy("zip");
    setZipProgress({ pct: 1, stage: "Starting export…" });
    try {
      const blob = await downloadZipBlob(job.outDir, (info) => {
        setZipProgress({
          pct: Math.max(1, Math.min(100, Math.round(info.progress))),
          stage: info.stage || "Working…",
        });
      });
      triggerBrowserDownload(blob, `${job.domain || "clone"}.zip`);
      setZipProgress({ pct: 100, stage: "Complete" });
      toast.success("ZIP downloaded.");
    } catch (err) {
      toast.error(paidGateMessage(err, "ZIP export"));
    } finally {
      setBusy("");
      setZipProgress(null);
    }
  };

  const share = async () => {
    if (!job?.outDir) {
      toast.error("Share is available after the clone finishes.");
      return;
    }
    setBusy("share");
    try {
      const data = await createShareLink(job.outDir);
      const url = absoluteApiUrl(data.url);
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create share link.");
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    if (!job?.outDir) {
      toast.error("Nothing to delete yet.");
      return;
    }
    if (!window.confirm(`Delete clone for ${job.domain}?`)) return;
    setBusy("delete");
    try {
      await deleteOutput(job.outDir);
      toast.success("Clone deleted.");
      onDeleted?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete clone.");
    } finally {
      setBusy("");
    }
  };

  return (
    <Dialog
      open={!!job}
      onOpenChange={(open) => {
        if (!open) {
          setIframeError(false);
          onClose();
        }
      }}
    >
      <DialogContent className="dashboard-dialog" data-lenis-prevent>
        {job && (
          <>
            <p className="eyebrow">Capture details</p>
            <DialogTitle className="break-all pr-4 font-display text-2xl leading-tight">
              {job.domain}
            </DialogTitle>
            <DialogDescription>
              Inspect the capture, open a live preview, or export the project ZIP.
            </DialogDescription>
            <CaptureStatus status={job.status} />
            <dl className="capture-detail-grid">
              {[
                ["Pages", job.pages],
                ["Assets", job.assets],
                ["API routes", job.routes],
                ["Elapsed", job.elapsed],
                ["Started", job.startedAt],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {canPreview ? (
              <div className="overflow-hidden rounded-2xl border border-border">
                {iframeError ? (
                  <div className="flex h-[320px] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Inline preview could not load. Use Open preview to view it on the API host.
                    </p>
                    <button
                      type="button"
                      className="dashboard-button"
                      onClick={() => void openPreview()}
                      disabled={busy === "preview"}
                    >
                      <Eye size={16} />
                      Open preview
                    </button>
                  </div>
                ) : (
                  <iframe
                    title={`Preview ${job.domain}`}
                    src={previewSrc}
                    className="h-[320px] w-full bg-background"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    onError={() => setIframeError(true)}
                    onLoad={(event) => {
                      try {
                        const doc = event.currentTarget.contentDocument;
                        const text = doc?.body?.innerText || "";
                        if (/no clone loaded|not authenticated|not found|internal server error|missing from disk/i.test(text)) {
                          setIframeError(true);
                        }
                      } catch {
                        /* cross-origin — treat as loaded if no hard error event */
                      }
                    }}
                  />
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {job.status === "running"
                  ? "Clone is still running. Preview and export unlock when it finishes."
                  : job.status === "error"
                    ? "This capture failed or its files are missing from storage. Start a new clone to get a previewable output."
                    : "Preview and export will appear once this capture has an output folder."}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {job.status === "running" && (
                <button
                  type="button"
                  className="dashboard-button"
                  onClick={() => void stopRunningClone()}
                  disabled={busy === "stop"}
                >
                  <Square size={16} />
                  {busy === "stop" ? "Stopping…" : "Stop clone"}
                </button>
              )}
              <button
                type="button"
                className="dashboard-button"
                onClick={() => void openPreview()}
                disabled={!job.outDir || busy === "preview"}
              >
                <Eye size={16} />
                {busy === "preview" ? "Opening…" : "Open preview"}
              </button>
              {job.outDir && job.status === "done" && (
                <Link
                  to="/dashboard/editor"
                  search={{ outDir: job.outDir, route: "/" }}
                  className="dashboard-button"
                >
                  <Pencil size={16} />
                  Edit pages
                </Link>
              )}
              <button
                type="button"
                className="dashboard-button bg-primary text-primary-foreground"
                onClick={() => void downloadZip()}
                disabled={!job.outDir || busy === "zip"}
              >
                <Download size={16} />
                {busy === "zip"
                  ? `ZIP ${zipProgress?.pct ?? 0}%`
                  : "Download ZIP"}
              </button>
              {busy === "zip" && zipProgress && (
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
                disabled={!job.outDir || job.status !== "done"}
              >
                <Figma size={16} />
                Export to Figma
              </button>
              <button
                type="button"
                className="dashboard-button"
                onClick={() => setGithubOpen(true)}
                disabled={!job.outDir || job.status !== "done"}
              >
                <Github size={16} />
                Push to GitHub
              </button>
              <button
                type="button"
                className="dashboard-button"
                onClick={() => void share()}
                disabled={!job.outDir || busy === "share"}
              >
                <Link2 size={16} />
                {busy === "share" ? "Creating…" : "Copy share link"}
              </button>
              <a
                className="dashboard-button"
                href={
                  job.domain.includes("://")
                    ? job.domain
                    : `https://${job.domain.replace(/^\/+/, "")}`
                }
                target="_blank"
                rel="noreferrer"
              >
                Visit source <ExternalLink size={16} />
              </a>
              <button type="button" className="dashboard-button" onClick={() => downloadCaptureReport([job])}>
                <Download size={16} />
                Download summary
              </button>
              <button
                type="button"
                className="dashboard-button"
                onClick={() => void remove()}
                disabled={!job.outDir || busy === "delete"}
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </>
        )}
      </DialogContent>
      {job?.outDir && (
        <>
          <GitHubPushDialog
            open={githubOpen}
            onOpenChange={setGithubOpen}
            outDir={job.outDir}
            domain={job.domain}
          />
          <ExportFigmaDialog
            open={figmaOpen}
            onOpenChange={setFigmaOpen}
            outDir={job.outDir}
            domain={job.domain}
          />
        </>
      )}
    </Dialog>
  );
}

/** One table owns the columns, so every row shares exactly the same alignment. */
export function CaptureTable({
  jobs,
  caption = "Recent captures",
}: {
  jobs: CloneJob[];
  caption?: string;
}) {
  const [selected, setSelected] = useState<CloneJob | null>(null);
  return (
    <>
      <div
        className="capture-table-scroll"
        data-scroll-region
        tabIndex={0}
        role="region"
        aria-label={caption}
      >
        <table className="capture-table">
          <caption className="sr-only">{caption}</caption>
          <colgroup>
            <col />
            <col />
            <col />
            <col />
            <col className="capture-status-col" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Website</th>
              <th scope="col">Pages</th>
              <th scope="col">Assets</th>
              <th scope="col">Time</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <button type="button" className="capture-domain" onClick={() => setSelected(job)}>
                    {job.domain}
                  </button>
                </td>
                <td>{job.pages}</td>
                <td>{job.assets}</td>
                <td>{job.elapsed}</td>
                <td>
                  <CaptureStatus status={job.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CaptureDetails
        job={selected}
        onClose={() => setSelected(null)}
        onDeleted={() => setSelected(null)}
      />
    </>
  );
}

export function CaptureSearch({
  value,
  onChange,
  label = "Search captures",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <label className="dashboard-search">
      <span className="sr-only">{label}</span>
      <Search size={16} aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by domain"
        autoComplete="off"
      />
    </label>
  );
}

export function EmptyCaptures({ onReset }: { onReset?: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">No captures match this filter.</p>
      {onReset ? (
        <button type="button" className="dashboard-button mt-4" onClick={onReset}>
          Reset filters
        </button>
      ) : null}
    </div>
  );
}
