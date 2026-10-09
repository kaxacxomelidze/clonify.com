import { useEffect, useState } from "react";
import { fetchInteractivePreviewUrl, pageLivePreviewUrl } from "@/lib/api";

/**
 * Preview iframe source for a finished clone: the saved clone with the original
 * site's scripts running (buttons, menus, animations), on an isolated origin.
 * Falls back to the previous preview URL if the interactive one can't be issued.
 */
export function useInteractivePreview(outDir: string | undefined, enabled = true) {
  const [src, setSrc] = useState("");
  const [scripts, setScripts] = useState(false);

  useEffect(() => {
    if (!outDir || !enabled) {
      setSrc("");
      return;
    }
    let cancelled = false;
    setSrc("");
    fetchInteractivePreviewUrl(outDir)
      .then((data) => {
        if (cancelled) return;
        setSrc(data.url);
        setScripts(data.scripts);
      })
      .catch(() => {
        if (cancelled) return;
        setSrc(pageLivePreviewUrl(outDir));
        setScripts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [outDir, enabled]);

  return { src, scripts };
}
