import { useState } from "react";
import { Code2, Figma, Github, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ExportFigmaDialog } from "@/components/dashboard/export-figma-dialog";
import { GitHubPushDialog } from "@/components/dashboard/github-push-dialog";
import { ApiError, downloadZipBlob, triggerBrowserDownload } from "@/lib/api";

/**
 * Export menu for paying users (free users get the paywall instead): the code as a ZIP,
 * a Figma file (Growth and Pro) and a GitHub push.
 */
export function EditorExportDialog({
  open,
  onOpenChange,
  outDir,
  domain,
  route,
  figmaIncluded,
  onUpgradeForFigma,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outDir: string;
  domain: string;
  route: string;
  /** Starter has no Figma export: its button opens the upgrade paywall instead. */
  figmaIncluded: boolean;
  onUpgradeForFigma: () => void;
}) {
  const [zip, setZip] = useState<{ pct: number; stage: string } | null>(null);
  const [figmaOpen, setFigmaOpen] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);

  const downloadZip = async () => {
    setZip({ pct: 1, stage: "Starting export…" });
    try {
      const blob = await downloadZipBlob(outDir, (info) =>
        setZip({
          pct: Math.max(1, Math.min(100, Math.round(info.progress))),
          stage: info.stage || "Working…",
        }),
      );
      triggerBrowserDownload(blob, `${domain || "website"}.zip`);
      toast.success("Your website ZIP is downloading.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ZIP export failed. Try again.");
    } finally {
      setZip(null);
    }
  };

  const option =
    "flex w-full items-center gap-3 rounded-2xl border border-border p-4 text-left transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50";

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !zip && onOpenChange(next)}>
        <DialogContent className="dashboard-dialog max-w-md">
          <DialogTitle className="font-display text-2xl">Export your website</DialogTitle>
          <DialogDescription>Your saved changes are included in every export.</DialogDescription>
          <div className="mt-2 space-y-2.5">
            <button
              type="button"
              className={option}
              onClick={() => void downloadZip()}
              disabled={!!zip}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400 text-black">
                {zip ? <Loader2 size={18} className="animate-spin" /> : <Code2 size={18} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {zip ? `Preparing ZIP… ${zip.pct}%` : "Download code (ZIP)"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {zip ? zip.stage : "HTML, CSS, images and fonts, ready to host anywhere."}
                </span>
              </span>
            </button>
            <button
              type="button"
              className={option}
              disabled={!!zip}
              onClick={() => {
                if (!figmaIncluded) {
                  onOpenChange(false);
                  onUpgradeForFigma();
                  return;
                }
                setFigmaOpen(true);
              }}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border">
                <Figma size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  Export to Figma
                  {!figmaIncluded && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <Lock size={10} /> Growth &amp; Pro
                    </span>
                  )}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {figmaIncluded
                    ? "Editable Figma layers of your pages."
                    : "Upgrade to Growth to export ready-to-share Figma files."}
                </span>
              </span>
            </button>
            <button
              type="button"
              className={option}
              disabled={!!zip}
              onClick={() => setGithubOpen(true)}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border">
                <Github size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Push to GitHub</span>
                <span className="block text-xs text-muted-foreground">
                  Send the code to one of your repositories.
                </span>
              </span>
            </button>
          </div>
          {zip && (
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-accent"
              role="progressbar"
              aria-label="ZIP export progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={zip.pct}
            >
              <div
                className="h-full bg-emerald-400 transition-[width]"
                style={{ width: `${zip.pct}%` }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ExportFigmaDialog
        open={figmaOpen}
        onOpenChange={setFigmaOpen}
        outDir={outDir}
        initialRoute={route}
        domain={domain}
      />
      <GitHubPushDialog
        open={githubOpen}
        onOpenChange={setGithubOpen}
        outDir={outDir}
        domain={domain}
      />
    </>
  );
}
