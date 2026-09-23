import { useEffect, useState } from "react";
import { ExternalLink, Figma, Monitor, Globe2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  ApiError,
  copyFigmaSceneToClipboard,
  downloadFigmaSvgBlob,
  downloadFigmaZipBlob,
  fetchClonePages,
  fetchFigmaScene,
  fetchPublicConfig,
  triggerBrowserDownload,
  type FigmaScene,
} from "@/lib/api";

/**
 * Original Clonyfy Figma export modal:
 * - Desktop: Backend builds Scene Graph → clipboard → user runs Clonyfy Import in Figma Desktop
 * - Web: Download SVG → drag onto Figma canvas
 *
 * Note: "Export for Figma Desktop" is NOT a local clipboard-only action — the Backend must
 * render the page with Playwright first (same class of work as SVG export).
 */
export function ExportFigmaDialog({
  open,
  onOpenChange,
  outDir,
  initialRoute = "/",
  domain,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outDir: string;
  initialRoute?: string;
  domain?: string;
}) {
  const [routes, setRoutes] = useState<string[]>([initialRoute || "/"]);
  const [route, setRoute] = useState(initialRoute || "/");
  const [pluginUrl, setPluginUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [pages, cfg] = await Promise.all([
          fetchClonePages(outDir).catch(() => [] as string[]),
          fetchPublicConfig().catch(() => ({ figma_community_plugin_url: "" })),
        ]);
        if (cancelled) return;
        const list = pages.length ? pages : ["/"];
        setRoutes(list);
        setRoute(list.includes(initialRoute) ? initialRoute : list[0] || "/");
        setPluginUrl(String(cfg.figma_community_plugin_url || "").trim());
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, outDir, initialRoute]);

  const paidGate = (err: unknown) => {
    if (err instanceof ApiError && err.status === 403) {
      return err.message || "Figma export requires a paid plan. Upgrade in Subscription.";
    }
    if (err instanceof ApiError && err.message) return err.message;
    return "Figma export failed.";
  };

  const sceneFileName = () =>
    `${(domain || "clone").replace(/[^\w.-]+/g, "_")}-figma-scene.json`;

  const deliverScene = async (scene: FigmaScene, warning?: string) => {
    try {
      await copyFigmaSceneToClipboard(scene);
      setHint(
        "Scene copied. Next: open Figma Desktop → Plugins → Clonyfy Import (auto-imports from clipboard). We cannot open the plugin for you.",
      );
      toast.success("Scene copied. Run Clonyfy Import in Figma Desktop.");
      if (warning) toast.message(warning);
    } catch (clipErr) {
      const reason = clipErr instanceof Error ? clipErr.message : "";
      const blob = new Blob([JSON.stringify({ ...scene, kind: "clonyfy-figma-scene", version: 1 }, null, 2)], {
        type: "application/json",
      });
      triggerBrowserDownload(blob, sceneFileName());
      if (reason === "SCENE_TOO_LARGE_FOR_CLIPBOARD") {
        setHint(
          "Scene was too large for the clipboard. JSON downloaded — in Figma Desktop open Clonyfy Import and paste or use Import.",
        );
        toast.message("Scene JSON downloaded (too large for clipboard).");
      } else {
        setHint(
          "Clipboard was blocked. JSON downloaded — paste it into Clonyfy Import in Figma Desktop.",
        );
        toast.message("Clipboard blocked — scene JSON downloaded instead.");
      }
      if (warning) toast.message(warning);
    }
  };

  const exportDesktop = async () => {
    setBusy("desktop");
    setHint("Building Scene Graph on the Backend (can take up to ~2 minutes on free hosts)…");
    try {
      const { scene, warning } = await fetchFigmaScene(outDir, route);
      if (!scene?.nodes || !Array.isArray(scene.nodes) || scene.nodes.length === 0) {
        throw new ApiError("Empty scene — nothing to import. Re-run the clone or try another page.", 422);
      }
      await deliverScene(scene, warning);
    } catch (err) {
      toast.error(paidGate(err));
      setHint(
        err instanceof ApiError
          ? err.message
          : "Desktop export failed while building the scene on the Backend.",
      );
    } finally {
      setBusy("");
    }
  };

  const exportSvgWeb = async () => {
    setBusy("svg");
    setHint("");
    try {
      const { blob, filename } = await downloadFigmaSvgBlob(outDir, route);
      triggerBrowserDownload(blob, filename);
      setHint("SVG downloaded. In Figma Web or Desktop, drag the file onto the canvas.");
      toast.success("SVG ready for Figma Web.");
    } catch (err) {
      toast.error(paidGate(err));
    } finally {
      setBusy("");
    }
  };

  const exportZipAll = async () => {
    setBusy("zip");
    setHint("");
    try {
      const { blob, filename, skipped, truncated, pages } = await downloadFigmaZipBlob(outDir);
      triggerBrowserDownload(blob, filename);
      if (skipped || truncated) {
        const parts = [
          pages ? `${pages} page(s) exported` : "ZIP downloaded",
          skipped ? `${skipped} page(s) failed` : "",
          truncated ? `${truncated} page(s) omitted (host limit)` : "",
        ].filter(Boolean);
        setHint(parts.join(" · "));
        toast.message(parts.join(" · "));
      } else {
        setHint("Multi-page Figma ZIP downloaded (SVG per route).");
        toast.success("Figma ZIP downloaded.");
      }
    } catch (err) {
      toast.error(paidGate(err));
    } finally {
      setBusy("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dashboard-dialog max-w-lg" data-lenis-prevent>
        <DialogTitle className="flex items-center gap-2">
          <Figma size={18} />
          Export to Figma
        </DialogTitle>
        <DialogDescription>
          Desktop import needs two steps: Clonyfy builds a Scene Graph on the Backend, then you run
          the <strong>Clonyfy Import</strong> plugin in Figma Desktop (clipboard alone is not enough).
        </DialogDescription>

        <label className="mt-4 block text-sm">
          Page route
          <select
            className="mt-2 w-full rounded-xl border border-border bg-background p-3"
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            disabled={!!busy}
          >
            {routes.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
          <li>Install <strong>Clonyfy Import</strong> (Community link below, or Development → Import plugin).</li>
          <li>Click <strong>Export for Figma Desktop</strong> and wait until it says copied / downloaded.</li>
          <li>In <strong>Figma Desktop</strong>: Plugins → Clonyfy Import (or Run last plugin).</li>
        </ol>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            className="dashboard-button w-full justify-start bg-primary text-primary-foreground"
            disabled={!!busy}
            onClick={() => void exportDesktop()}
          >
            <Monitor size={16} />
            {busy === "desktop" ? "Building scene on Backend…" : "Export for Figma Desktop"}
          </button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Builds editable layers, then copies JSON for the Clonyfy Import plugin. This does not open
            Figma by itself.
          </p>

          <button
            type="button"
            className="dashboard-button w-full justify-start"
            disabled={!!busy}
            onClick={() => void exportSvgWeb()}
          >
            <Globe2 size={16} />
            {busy === "svg" ? "Exporting SVG…" : "Download SVG for Figma Web"}
          </button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Download an SVG and drag it onto the Figma canvas (works in Figma Web without the
            plugin). Large sites may take up to ~1 minute on free hosts.
          </p>

          <button
            type="button"
            className="dashboard-button w-full justify-start"
            disabled={!!busy}
            onClick={() => void exportZipAll()}
          >
            <Figma size={16} />
            {busy === "zip" ? "Preparing ZIP…" : "Download Figma ZIP (all pages)"}
          </button>
        </div>

        {hint ? <p className="mt-4 text-sm text-muted-foreground">{hint}</p> : null}

        {pluginUrl ? (
          <a
            className="dashboard-button mt-4 w-full justify-start"
            href={pluginUrl}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} />
            Install Clonyfy Import
          </a>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            Developers: Figma Desktop → Plugins → Development → Import plugin from{" "}
            <code>Backend/figma-plugin/manifest.json</code>.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
