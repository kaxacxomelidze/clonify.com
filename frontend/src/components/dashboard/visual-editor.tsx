import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Save } from "lucide-react";
import { toast } from "sonner";
import {
  ApiError,
  consumeUsage,
  fetchClonePages,
  fetchPageHtml,
  importAsset,
  savePage,
} from "@/lib/api";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function VisualEditor({
  outDir,
  initialRoute = "/",
}: {
  outDir: string;
  initialRoute?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedImgRef = useRef<HTMLImageElement | null>(null);
  const [routes, setRoutes] = useState<string[]>([]);
  const [route, setRoute] = useState(initialRoute);
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [dirty, setDirty] = useState(false);

  const load = useCallback(
    async (nextRoute: string) => {
      setLoading(true);
      try {
        const pageHtml = await fetchPageHtml(outDir, nextRoute, "editor");
        setHtml(pageHtml);
        setDirty(false);
        try {
          await consumeUsage("edit", outDir);
        } catch (err) {
          if (err instanceof ApiError && err.status === 429) {
            toast.error(err.message);
          }
        }
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not load page for editing.");
        setHtml("");
      } finally {
        setLoading(false);
      }
    },
    [outDir],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchClonePages(outDir);
        if (cancelled) return;
        const normalized = list.length ? list : ["/"];
        setRoutes(normalized);
        const start = normalized.includes(initialRoute) ? initialRoute : normalized[0] || "/";
        setRoute(start);
        await load(start);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.message : "Could not list clone pages.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [outDir, initialRoute, load]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !html) return;
    const onLoad = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;
      doc.body?.querySelectorAll("img").forEach((img) => {
        img.classList.add("clonyfy-edit-target");
        img.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          selectedImgRef.current = img;
          toast.message("Image selected — use Replace image to swap it.");
        });
      });
      doc.addEventListener("input", () => setDirty(true));
    };
    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [html]);

  const onRouteChange = async (next: string) => {
    if (dirty && !window.confirm("Discard unsaved edits on this page?")) return;
    setRoute(next);
    await load(next);
  };

  const onSave = async () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.documentElement) {
      toast.error("Editor is not ready.");
      return;
    }
    setBusy("save");
    try {
      const outer = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
      await savePage(outDir, route, outer);
      setDirty(false);
      toast.success("Page saved.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy("");
    }
  };

  const onReplaceImage = async (file: File | null) => {
    if (!file) return;
    const img = selectedImgRef.current;
    if (!img) {
      toast.error("Click an image in the preview first.");
      return;
    }
    setBusy("asset");
    try {
      const dataUrl = await fileToDataUrl(file);
      const uploaded = await importAsset(outDir, dataUrl, file.name);
      img.setAttribute("src", uploaded.previewUrl || uploaded.path);
      img.removeAttribute("srcset");
      setDirty(true);
      toast.success("Image replaced — save to keep the change.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not import image.");
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[12rem] flex-1 text-sm">
          Page route
          <select
            className="mt-2 w-full rounded-xl border border-border bg-background p-3"
            value={route}
            onChange={(e) => void onRouteChange(e.target.value)}
            disabled={loading || !!busy}
          >
            {routes.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="dashboard-button"
          onClick={() => fileRef.current?.click()}
          disabled={loading || !!busy}
        >
          <ImagePlus size={16} />
          Replace image
        </button>
        <button
          type="button"
          className="dashboard-button bg-primary text-primary-foreground"
          onClick={() => void onSave()}
          disabled={loading || busy === "save"}
        >
          <Save size={16} />
          {busy === "save" ? "Saving…" : dirty ? "Save changes" : "Save"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onReplaceImage(e.target.files?.[0] || null)}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Click text to edit. Click an image, then Replace image. Save writes to the Backend via
        /api/save-page.
      </p>
      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        {loading ? (
          <div className="grid h-[70vh] place-items-center text-sm text-muted-foreground">
            Loading editor…
          </div>
        ) : html ? (
          <iframe
            ref={iframeRef}
            title={`Edit ${route}`}
            srcDoc={html}
            className="h-[70vh] w-full bg-background"
            sandbox="allow-same-origin"
          />
        ) : (
          <div className="grid h-[70vh] place-items-center text-sm text-muted-foreground">
            No page HTML available.
          </div>
        )}
      </div>
    </div>
  );
}
