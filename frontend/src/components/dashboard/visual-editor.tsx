import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Copy,
  CornerLeftUp,
  Eraser,
  ImagePlus,
  Italic,
  Link2,
  Monitor,
  MousePointerClick,
  PaintBucket,
  Redo2,
  RotateCcw,
  Save,
  Smartphone,
  Tablet,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  Trash2,
  Type,
  Undo2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import {
  ApiError,
  type ThemeEngine,
  type ThemeModel,
  consumeUsage,
  ensureApiAwake,
  fetchClonePages,
  fetchCloneTheme,
  fetchPageHtml,
  importAsset,
  loadThemeEngine,
  savePage,
  setCloneTheme,
} from "@/lib/api";
import { SiteStylePanel } from "@/components/dashboard/theme-models-panel";
import {
  ATTR_EDITING,
  ATTR_HOVER,
  ATTR_SELECTED,
  type SelectionInfo,
  canEditText,
  clearEditorAttrs,
  describeElement,
  htmlForSave,
  insertPlainText,
  installEditorChrome,
  isEffectivelyEmpty,
  placeCaretAtPoint,
  pruneEmptyDescendants,
  removeWithEmptyAncestors,
  selectableTarget,
  textTargetFor,
} from "@/lib/editor-dom";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

type Device = "desktop" | "tablet" | "mobile";
const DEVICES: Array<{ id: Device; label: string; width: string; Icon: typeof Monitor }> = [
  { id: "desktop", label: "Desktop", width: "100%", Icon: Monitor },
  { id: "tablet", label: "Tablet", width: "820px", Icon: Tablet },
  { id: "mobile", label: "Mobile", width: "390px", Icon: Smartphone },
];

const MAX_HISTORY = 40;
const MAX_HISTORY_CHARS = 60_000_000;
const EDITOR_ATTR_RE = /\s(?:data-clonyfy-editor-(?:hover|selected|editing)|data-cth(?![-\w]))(?:="[^"]*")?/g;

const TOOL =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-2.5 py-2 text-xs transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40";
const TOOL_ACTIVE = "bg-primary text-primary-foreground hover:bg-primary";

function isTypingTarget(el: Element | null) {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (el as HTMLElement).isContentEditable
  );
}

export function VisualEditor({
  outDir,
  initialRoute = "/",
}: {
  outDir: string;
  initialRoute?: string;
}) {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<"img" | "bg">("img");
  const loadGenRef = useRef(0);
  const editQuotaChargedRef = useRef(false);

  const docRef = useRef<Document | null>(null);
  const selectedRef = useRef<HTMLElement | null>(null);
  const hoverRef = useRef<HTMLElement | null>(null);
  const editingRef = useRef<{ el: HTMLElement; before: string } | null>(null);
  const undoRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);
  const lastChangeRef = useRef<{ key: string; at: number; el: Element | null } | null>(null);
  const origStyleRef = useRef<WeakMap<Element, string | null>>(new WeakMap());

  const [routes, setRoutes] = useState<string[]>([]);
  const [route, setRoute] = useState(initialRoute);
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [dirty, setDirty] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const [sel, setSel] = useState<SelectionInfo | null>(null);
  const [editingText, setEditingText] = useState(false);
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  const [hrefDraft, setHrefDraft] = useState("");
  const [altDraft, setAltDraft] = useState("");
  const [fontSizeDraft, setFontSizeDraft] = useState("");

  const themeEngineRef = useRef<ThemeEngine | null>(null);
  const themeIdRef = useRef<string | null>(null);
  const [themeModels, setThemeModels] = useState<ThemeModel[]>([]);
  const [themeId, setThemeId] = useState<string | null>(null);
  const [themePending, setThemePending] = useState<string | null | undefined>(undefined);
  const [themeError, setThemeError] = useState("");

  const applyThemeToDoc = () => {
    const doc = docRef.current;
    const engine = themeEngineRef.current;
    if (!doc?.documentElement || !engine) return;
    try {
      engine.apply(doc, themeIdRef.current);
    } catch (err) {
      console.warn("[theme] apply failed", err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setThemeError("");
    (async () => {
      try {
        const [engine, current] = await Promise.all([
          loadThemeEngine(),
          fetchCloneTheme(outDir).catch(() => ({ themeId: null })),
        ]);
        if (cancelled) return;
        themeEngineRef.current = engine;
        themeIdRef.current = current.themeId;
        setThemeModels(engine.models);
        setThemeId(current.themeId);
        applyThemeToDoc();
      } catch (err) {
        if (!cancelled) setThemeError(err instanceof Error ? err.message : "Could not load style models.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outDir]);

  const onApplyTheme = async (nextId: string | null) => {
    commitEditing();
    const prevId = themeIdRef.current;
    if (nextId === prevId) return;
    themeIdRef.current = nextId;
    setThemeId(nextId);
    setThemePending(nextId);
    applyThemeToDoc();
    try {
      await ensureApiAwake({ attempts: 3, timeoutMs: 10_000 }).catch(() => {});
      const result = await setCloneTheme(outDir, nextId);
      const name = themeModels.find((m) => m.id === nextId)?.name;
      toast.success(
        name
          ? `${name} style applied to ${result.pages} page${result.pages === 1 ? "" : "s"}.`
          : `Original style restored on ${result.pages} page${result.pages === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      themeIdRef.current = prevId;
      setThemeId(prevId);
      applyThemeToDoc();
      toast.error(err instanceof ApiError ? err.message : "Could not apply the style.");
    } finally {
      setThemePending(undefined);
    }
  };

  const syncRouteInUrl = useCallback(
    (nextRoute: string) => {
      void navigate({
        to: "/dashboard/editor",
        search: { outDir, route: nextRoute },
        replace: true,
      });
    },
    [navigate, outDir],
  );

  /* ------------------------------------------------------------ history */

  const updateHistory = () =>
    setHistory({ undo: undoRef.current.length, redo: redoRef.current.length });

  const snapshot = (doc: Document) => doc.body.innerHTML.replace(EDITOR_ATTR_RE, "");

  const trimHistory = (stack: string[]) => {
    let total = stack.reduce((n, s) => n + s.length, 0);
    while (stack.length > MAX_HISTORY || (stack.length > 1 && total > MAX_HISTORY_CHARS)) {
      total -= stack.shift()!.length;
    }
  };

  const pushUndo = () => {
    const doc = docRef.current;
    if (!doc?.body) return;
    undoRef.current.push(snapshot(doc));
    trimHistory(undoRef.current);
    redoRef.current = [];
    lastChangeRef.current = null;
    updateHistory();
  };

  /** Coalesce rapid changes of the same control (e.g. dragging a color picker). */
  const recordChange = (key: string) => {
    const now = Date.now();
    const last = lastChangeRef.current;
    const el = selectedRef.current;
    if (!last || last.key !== key || last.el !== el || now - last.at > 1500) {
      pushUndo();
    }
    lastChangeRef.current = { key, at: now, el };
    setDirty(true);
  };

  /* ---------------------------------------------------------- selection */

  const refreshSel = () => {
    const el = selectedRef.current;
    if (!el || !el.isConnected) {
      selectedRef.current = null;
      setSel(null);
      return;
    }
    setSel(describeElement(el, origStyleRef.current.has(el)));
  };

  const select = (el: HTMLElement | null) => {
    selectedRef.current?.removeAttribute(ATTR_SELECTED);
    selectedRef.current = el && el.isConnected ? el : null;
    if (selectedRef.current) {
      selectedRef.current.removeAttribute(ATTR_HOVER);
      selectedRef.current.setAttribute(ATTR_SELECTED, "");
      const info = describeElement(
        selectedRef.current,
        origStyleRef.current.has(selectedRef.current),
      );
      setSel(info);
      setHrefDraft(info.href ?? "");
      setAltDraft(info.alt);
      setFontSizeDraft(String(info.fontSize));
    } else {
      setSel(null);
    }
  };

  const restore = (bodyHtml: string) => {
    const doc = docRef.current;
    if (!doc?.body) return;
    editingRef.current = null;
    setEditingText(false);
    doc.body.innerHTML = bodyHtml;
    clearEditorAttrs(doc.body);
    applyThemeToDoc();
    selectedRef.current = null;
    hoverRef.current = null;
    setSel(null);
    lastChangeRef.current = null;
    setDirty(true);
  };

  /* ------------------------------------------------------- text editing */

  const commitEditing = () => {
    const cur = editingRef.current;
    if (!cur) return;
    editingRef.current = null;
    setEditingText(false);
    const { el, before } = cur;
    el.removeAttribute("contenteditable");
    el.removeAttribute(ATTR_EDITING);
    docRef.current?.getSelection()?.removeAllRanges();
    if (!el.isConnected) return;
    if (el.innerHTML === before) {
      undoRef.current.pop();
      updateHistory();
      return;
    }
    pruneEmptyDescendants(el);
    if (isEffectivelyEmpty(el)) {
      select(null);
      removeWithEmptyAncestors(el);
      toast.message("Text removed together with its styling (shadow, background, spacing).");
    } else {
      refreshSel();
    }
    setDirty(true);
  };

  const startEditing = (el: HTMLElement, point?: { x: number; y: number }) => {
    const doc = docRef.current;
    if (!doc) return;
    const target = canEditText(el) ? el : textTargetFor(el);
    if (!target) {
      toast.message("This element has no text to edit.");
      return;
    }
    commitEditing();
    pushUndo();
    select(target);
    editingRef.current = { el: target, before: target.innerHTML };
    target.setAttribute("contenteditable", "true");
    target.setAttribute(ATTR_EDITING, "");
    target.focus({ preventScroll: true });
    if (point) placeCaretAtPoint(doc, point.x, point.y, target);
    else placeCaretAtPoint(doc, -1, -1, target);
    setEditingText(true);
  };

  /* ------------------------------------------------------------ actions */

  const undo = () => {
    commitEditing();
    const prev = undoRef.current.pop();
    const doc = docRef.current;
    if (prev === undefined || !doc?.body) return;
    redoRef.current.push(snapshot(doc));
    restore(prev);
    updateHistory();
  };

  const redo = () => {
    commitEditing();
    const next = redoRef.current.pop();
    const doc = docRef.current;
    if (next === undefined || !doc?.body) return;
    undoRef.current.push(snapshot(doc));
    restore(next);
    updateHistory();
  };

  const deleteSelected = () => {
    commitEditing();
    const el = selectedRef.current;
    if (!el || !el.isConnected) return;
    pushUndo();
    select(null);
    removeWithEmptyAncestors(el);
    setDirty(true);
  };

  const duplicateSelected = () => {
    commitEditing();
    const el = selectedRef.current;
    if (!el?.isConnected) return;
    pushUndo();
    const copy = el.cloneNode(true) as HTMLElement;
    copy.removeAttribute(ATTR_SELECTED);
    copy.removeAttribute(ATTR_HOVER);
    clearEditorAttrs(copy);
    el.after(copy);
    select(copy);
    setDirty(true);
  };

  const moveSelected = (dir: "up" | "down") => {
    commitEditing();
    const el = selectedRef.current;
    if (!el?.isConnected) return;
    const sibling = dir === "up" ? el.previousElementSibling : el.nextElementSibling;
    if (!sibling) return;
    pushUndo();
    if (dir === "up") sibling.before(el);
    else sibling.after(el);
    el.scrollIntoView({ block: "nearest" });
    refreshSel();
    setDirty(true);
  };

  const selectParent = () => {
    commitEditing();
    const parent = selectedRef.current?.parentElement;
    if (!parent || parent.tagName === "BODY" || parent.tagName === "HTML") return;
    select(parent);
  };

  const rememberStyle = (el: Element) => {
    if (!origStyleRef.current.has(el)) origStyleRef.current.set(el, el.getAttribute("style"));
  };

  const applyStyle = (props: Record<string, string>, key: string) => {
    const el = selectedRef.current;
    if (!el?.isConnected) return;
    recordChange(key);
    rememberStyle(el);
    for (const [prop, value] of Object.entries(props))
      el.style.setProperty(prop, value, "important");
    refreshSel();
  };

  const removeShadow = () => {
    const el = selectedRef.current;
    const view = docRef.current?.defaultView;
    if (!el?.isConnected || !view) return;
    recordChange("shadow");
    for (const node of [el, ...Array.from(el.querySelectorAll<HTMLElement>("*"))]) {
      const cs = view.getComputedStyle(node);
      const text = cs.textShadow && cs.textShadow !== "none";
      const box = cs.boxShadow && cs.boxShadow !== "none";
      const filter = /drop-shadow/i.test(cs.filter || "");
      if (!text && !box && !filter) continue;
      rememberStyle(node);
      if (text) node.style.setProperty("text-shadow", "none", "important");
      if (box) node.style.setProperty("box-shadow", "none", "important");
      if (filter) node.style.setProperty("filter", "none", "important");
    }
    refreshSel();
  };

  const resetStyles = () => {
    const el = selectedRef.current;
    if (!el?.isConnected || !origStyleRef.current.has(el)) return;
    pushUndo();
    const orig = origStyleRef.current.get(el) ?? null;
    if (orig === null) el.removeAttribute("style");
    else el.setAttribute("style", orig);
    origStyleRef.current.delete(el);
    refreshSel();
    setDirty(true);
  };

  const applyFontSize = () => {
    const size = Number(fontSizeDraft);
    if (!Number.isFinite(size) || size < 6 || size > 400) {
      if (sel) setFontSizeDraft(String(sel.fontSize));
      return;
    }
    if (sel && size === sel.fontSize) return;
    applyStyle({ "font-size": `${size}px` }, "font-size");
  };

  const applyHref = () => {
    const el = selectedRef.current;
    const doc = docRef.current;
    if (!el?.isConnected || !doc) return;
    const href = hrefDraft.trim();
    const link = el.closest("a");
    if (link) {
      if (!href) return;
      recordChange("href");
      link.setAttribute("href", href);
    } else {
      if (!href) {
        toast.error("Enter a link address first.");
        return;
      }
      pushUndo();
      const a = doc.createElement("a");
      a.setAttribute("href", href);
      el.replaceWith(a);
      a.appendChild(el);
      setDirty(true);
    }
    refreshSel();
    toast.success("Link updated.");
  };

  const removeLink = () => {
    const el = selectedRef.current;
    const link = el?.closest("a");
    if (!el || !link) return;
    pushUndo();
    link.replaceWith(...Array.from(link.childNodes));
    setHrefDraft("");
    refreshSel();
    setDirty(true);
  };

  const applyAlt = () => {
    const el = selectedRef.current;
    if (!el || el.tagName !== "IMG") return;
    recordChange("alt");
    el.setAttribute("alt", altDraft);
    refreshSel();
  };

  const openUpload = (target: "img" | "bg") => {
    uploadTargetRef.current = target;
    fileRef.current?.click();
  };

  const onUpload = async (file: File | null) => {
    if (!file) return;
    const el = selectedRef.current;
    if (!el?.isConnected) {
      toast.error("Select an image or element first.");
      return;
    }
    setBusy("asset");
    try {
      await ensureApiAwake({ attempts: 3, timeoutMs: 10_000 }).catch(() => {});
      const dataUrl = await fileToDataUrl(file);
      const uploaded = await importAsset(outDir, dataUrl, file.name);
      const src = uploaded.previewUrl || uploaded.path;
      pushUndo();
      if (uploadTargetRef.current === "img" && el.tagName === "IMG") {
        el.setAttribute("src", src);
        for (const attr of ["srcset", "sizes", "data-src", "data-srcset", "data-lazy-src"])
          el.removeAttribute(attr);
        el.setAttribute("loading", "eager");
        if (el.parentElement?.tagName === "PICTURE") {
          el.parentElement.querySelectorAll("source").forEach((s) => s.remove());
        }
      } else {
        rememberStyle(el);
        el.style.setProperty("background-image", `url("${src}")`, "important");
        el.style.setProperty("background-size", "cover", "important");
        el.style.setProperty("background-position", "center", "important");
      }
      setDirty(true);
      refreshSel();
      toast.success("Image replaced — save to keep the change.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not import image.");
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /* ------------------------------------------------------------ keyboard */

  const handleKey = (e: KeyboardEvent, fromFrame: boolean) => {
    const mod = e.ctrlKey || e.metaKey;
    if (editingRef.current) {
      if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        commitEditing();
      }
      return;
    }
    if (!fromFrame && isTypingTarget(document.activeElement)) return;
    const key = e.key.toLowerCase();
    if (mod && key === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && key === "y") {
      e.preventDefault();
      redo();
      return;
    }
    if (!selectedRef.current) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteSelected();
    } else if (e.key === "Escape") {
      e.preventDefault();
      select(null);
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      startEditing(selectedRef.current);
    } else if (mod && key === "d") {
      e.preventDefault();
      duplicateSelected();
    } else if (
      fromFrame &&
      !mod &&
      !e.altKey &&
      e.key.length === 1 &&
      selectedRef.current &&
      (canEditText(selectedRef.current) || textTargetFor(selectedRef.current))
    ) {
      // Click once to select, then type — same as Figma / Docs, no double-click required.
      e.preventDefault();
      const ch = e.key;
      startEditing(selectedRef.current);
      const doc = docRef.current;
      if (doc) insertPlainText(doc, ch);
    }
  };
  const handleKeyRef = useRef(handleKey);
  handleKeyRef.current = handleKey;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handleKeyRef.current(e, false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ------------------------------------------------------------- iframe */

  const onFrameLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    docRef.current = doc;
    installEditorChrome(doc);
    applyThemeToDoc();
    selectedRef.current = null;
    hoverRef.current = null;
    editingRef.current = null;
    origStyleRef.current = new WeakMap();
    undoRef.current = [];
    redoRef.current = [];
    lastChangeRef.current = null;
    setSel(null);
    setEditingText(false);
    updateHistory();

    doc.addEventListener(
      "mouseover",
      (e) => {
        if (editingRef.current?.el.contains(e.target as Node)) return;
        const el = selectableTarget(e.target);
        if (hoverRef.current === el) return;
        hoverRef.current?.removeAttribute(ATTR_HOVER);
        hoverRef.current = el;
        if (el && el !== selectedRef.current) el.setAttribute(ATTR_HOVER, "");
      },
      true,
    );
    doc.documentElement.addEventListener("mouseleave", () => {
      hoverRef.current?.removeAttribute(ATTR_HOVER);
      hoverRef.current = null;
    });
    doc.addEventListener(
      "click",
      (e) => {
        // Never follow links / submit buttons inside the editor.
        e.preventDefault();
        const editing = editingRef.current;
        if (editing && editing.el.contains(e.target as Node)) return;
        e.stopPropagation();
        const target = selectableTarget(e.target);
        // Second click on the exact same selection enters text edit mode.
        if (
          target &&
          target === selectedRef.current &&
          (canEditText(target) || textTargetFor(target))
        ) {
          startEditing(target, { x: e.clientX, y: e.clientY });
          return;
        }
        commitEditing();
        select(target);
      },
      true,
    );
    doc.addEventListener(
      "dblclick",
      (e) => {
        e.preventDefault();
        const el = selectableTarget(e.target);
        if (!el || editingRef.current?.el.contains(el)) return;
        startEditing(el, { x: e.clientX, y: e.clientY });
      },
      true,
    );
    doc.addEventListener("keydown", (e) => handleKeyRef.current(e, true), true);
    doc.addEventListener(
      "focusout",
      (e) => {
        const editing = editingRef.current;
        if (!editing || e.target !== editing.el) return;
        const next = e.relatedTarget as Node | null;
        if (next && editing.el.contains(next)) return;
        commitEditing();
      },
      true,
    );
    doc.addEventListener(
      "paste",
      (e) => {
        if (!editingRef.current) return;
        e.preventDefault();
        insertPlainText(doc, e.clipboardData?.getData("text/plain") || "");
      },
      true,
    );
    doc.addEventListener("input", () => {
      if (editingRef.current) setDirty(true);
    });
    doc.addEventListener("submit", (e) => e.preventDefault(), true);
    doc.addEventListener("auxclick", (e) => e.preventDefault(), true);
    doc.addEventListener("dragstart", (e) => e.preventDefault(), true);
  };

  /* ---------------------------------------------------------- page load */

  const load = useCallback(
    async (nextRoute: string) => {
      const gen = ++loadGenRef.current;
      setLoading(true);
      try {
        await ensureApiAwake({ attempts: 4, timeoutMs: 12_000 }).catch(() => {});
        const pageHtml = await fetchPageHtml(outDir, nextRoute, "editor");
        if (gen !== loadGenRef.current) return;
        setHtml(pageHtml);
        setDirty(false);
        if (!editQuotaChargedRef.current) {
          editQuotaChargedRef.current = true;
          try {
            await consumeUsage("edit", outDir);
          } catch (err) {
            if (err instanceof ApiError && err.status === 429) {
              toast.error(err.message);
            }
          }
        }
      } catch (err) {
        if (gen !== loadGenRef.current) return;
        toast.error(err instanceof ApiError ? err.message : "Could not load page for editing.");
        setHtml("");
      } finally {
        if (gen === loadGenRef.current) setLoading(false);
      }
    },
    [outDir],
  );

  useEffect(() => {
    editQuotaChargedRef.current = false;
    let cancelled = false;
    (async () => {
      try {
        await ensureApiAwake({ attempts: 4, timeoutMs: 12_000 }).catch(() => {});
        const list = await fetchClonePages(outDir);
        if (cancelled) return;
        const normalized = list.length ? list : ["/"];
        setRoutes(normalized);
        const start = normalized.includes(initialRoute) ? initialRoute : normalized[0] || "/";
        setRoute(start);
        syncRouteInUrl(start);
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
      loadGenRef.current += 1;
    };
  }, [outDir, initialRoute, load, syncRouteInUrl]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const onRouteChange = async (next: string) => {
    commitEditing();
    if (dirty && !window.confirm("Discard unsaved edits on this page?")) return;
    setRoute(next);
    syncRouteInUrl(next);
    await load(next);
  };

  const onSave = async () => {
    commitEditing();
    const doc = docRef.current;
    if (!doc?.documentElement) {
      toast.error("Editor is not ready.");
      return;
    }
    setBusy("save");
    try {
      await ensureApiAwake({ attempts: 3, timeoutMs: 10_000 }).catch(() => {});
      await savePage(outDir, route, htmlForSave(doc));
      setDirty(false);
      toast.success("Page saved.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy("");
    }
  };

  const frameWidth = DEVICES.find((d) => d.id === device)?.width ?? "100%";

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
        <div
          className="flex items-center gap-1 rounded-full border border-border p-1"
          role="group"
          aria-label="Preview width"
        >
          {DEVICES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${device === id ? TOOL_ACTIVE : "hover:bg-accent"}`}
              aria-pressed={device === id}
              aria-label={`${label} width`}
              title={`${label} width`}
              onClick={() => setDevice(id)}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="dashboard-button"
          onClick={undo}
          disabled={loading || !history.undo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={16} />
          Undo
        </button>
        <button
          type="button"
          className="dashboard-button"
          onClick={redo}
          disabled={loading || !history.redo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 size={16} />
          Redo
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
          onChange={(e) => void onUpload(e.target.files?.[0] || null)}
        />
      </div>

      <SiteStylePanel
        models={themeModels}
        activeId={themeId}
        pendingId={themePending}
        disabled={loading || !html}
        loadError={themeError}
        onApply={(id) => void onApplyTheme(id)}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-auto rounded-2xl border border-border bg-muted/30">
          {loading ? (
            <div className="grid h-[72vh] place-items-center text-sm text-muted-foreground">
              Loading editor…
            </div>
          ) : html ? (
            <div
              className="mx-auto transition-[width] duration-200"
              style={{ width: frameWidth, maxWidth: "100%" }}
            >
              <iframe
                ref={iframeRef}
                title={`Edit ${route}`}
                srcDoc={html}
                onLoad={onFrameLoad}
                className="block h-[72vh] w-full bg-background"
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <div className="grid h-[72vh] place-items-center text-sm text-muted-foreground">
              No page HTML available.
            </div>
          )}
        </div>

        <aside
          className="space-y-4 rounded-2xl border border-border p-4 text-sm"
          aria-label="Element inspector"
        >
          {!sel ? (
            <div className="space-y-3 text-muted-foreground">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <MousePointerClick size={16} />
                Select an element
              </p>
              <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed">
                <li>Click any element to select it.</li>
                <li>
                  Double-click text (or press Enter) to edit it. Enter finishes, Shift+Enter adds a
                  line.
                </li>
                <li>Delete removes the element with its shadow, background and empty wrappers.</li>
                <li>Ctrl+Z / Ctrl+Shift+Z undo and redo. Ctrl+D duplicates.</li>
              </ul>
              {dirty && <p className="text-xs text-foreground">You have unsaved changes.</p>}
            </div>
          ) : (
            <>
              <div>
                <p className="eyebrow">{editingText ? "Editing text" : "Selected"}</p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  {sel.path.join(" › ")}
                </p>
                {sel.label && <p className="mt-1 line-clamp-2 text-xs">“{sel.label}”</p>}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className={TOOL}
                  onClick={() => selectedRef.current && startEditing(selectedRef.current)}
                  disabled={!sel.canEditText || editingText}
                  title="Edit text (Enter)"
                >
                  <Type size={14} /> Text
                </button>
                <button
                  type="button"
                  className={TOOL}
                  onClick={selectParent}
                  disabled={!sel.hasParent}
                  title="Select parent"
                >
                  <CornerLeftUp size={14} /> Parent
                </button>
                <button
                  type="button"
                  className={TOOL}
                  onClick={duplicateSelected}
                  title="Duplicate (Ctrl+D)"
                >
                  <Copy size={14} /> Copy
                </button>
                <button
                  type="button"
                  className={TOOL}
                  onClick={() => moveSelected("up")}
                  disabled={!sel.canMoveUp}
                  title="Move up"
                >
                  <ArrowUp size={14} /> Up
                </button>
                <button
                  type="button"
                  className={TOOL}
                  onClick={() => moveSelected("down")}
                  disabled={!sel.canMoveDown}
                  title="Move down"
                >
                  <ArrowDown size={14} /> Down
                </button>
                <button
                  type="button"
                  className={`${TOOL} text-red-500`}
                  onClick={deleteSelected}
                  title="Delete (Del)"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>

              <section className="space-y-2">
                <p className="text-xs font-medium">Style</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center justify-between gap-2 rounded-xl border border-border px-2.5 py-1.5 text-xs">
                    Text
                    <input
                      type="color"
                      value={sel.color}
                      onChange={(e) => applyStyle({ color: e.target.value }, "color")}
                      className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                      aria-label="Text color"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 rounded-xl border border-border px-2.5 py-1.5 text-xs">
                    Fill
                    <input
                      type="color"
                      value={sel.backgroundTransparent ? "#ffffff" : sel.backgroundColor}
                      onChange={(e) =>
                        applyStyle({ "background-color": e.target.value }, "background")
                      }
                      className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                      aria-label="Background color"
                    />
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex flex-1 items-center gap-2 rounded-xl border border-border px-2.5 py-1.5 text-xs">
                    Size
                    <input
                      type="number"
                      min={6}
                      max={400}
                      value={fontSizeDraft}
                      onChange={(e) => setFontSizeDraft(e.target.value)}
                      onBlur={applyFontSize}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") applyFontSize();
                      }}
                      className="w-full bg-transparent tabular-nums outline-none"
                      aria-label="Font size in pixels"
                    />
                    px
                  </label>
                  <button
                    type="button"
                    className={`${TOOL} ${sel.bold ? TOOL_ACTIVE : ""}`}
                    onClick={() => applyStyle({ "font-weight": sel.bold ? "400" : "700" }, "bold")}
                    aria-pressed={sel.bold}
                    title="Bold"
                  >
                    <Bold size={14} />
                  </button>
                  <button
                    type="button"
                    className={`${TOOL} ${sel.italic ? TOOL_ACTIVE : ""}`}
                    onClick={() =>
                      applyStyle({ "font-style": sel.italic ? "normal" : "italic" }, "italic")
                    }
                    aria-pressed={sel.italic}
                    title="Italic"
                  >
                    <Italic size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["left", TextAlignStart],
                      ["center", TextAlignCenter],
                      ["right", TextAlignEnd],
                    ] as const
                  ).map(([align, Icon]) => {
                    const active =
                      sel.textAlign === align ||
                      (align === "left" && sel.textAlign === "start") ||
                      (align === "right" && sel.textAlign === "end");
                    return (
                      <button
                        key={align}
                        type="button"
                        className={`${TOOL} ${active ? TOOL_ACTIVE : ""}`}
                        onClick={() => applyStyle({ "text-align": align }, "align")}
                        aria-pressed={active}
                        title={`Align ${align}`}
                      >
                        <Icon size={14} />
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    className={TOOL}
                    onClick={removeShadow}
                    disabled={!sel.hasShadow}
                    title="Remove text and box shadows"
                  >
                    <Eraser size={14} /> Shadow
                  </button>
                  <button
                    type="button"
                    className={TOOL}
                    onClick={() =>
                      applyStyle(
                        { "background-color": "transparent", "background-image": "none" },
                        "clear-bg",
                      )
                    }
                    disabled={sel.backgroundTransparent && !sel.hasBackgroundImage}
                    title="Clear background"
                  >
                    <PaintBucket size={14} /> Clear
                  </button>
                  <button
                    type="button"
                    className={TOOL}
                    onClick={resetStyles}
                    disabled={!sel.hasInlineEdits}
                    title="Undo all style edits on this element"
                  >
                    <RotateCcw size={14} /> Reset
                  </button>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-xs font-medium">Link</p>
                <input
                  type="text"
                  value={hrefDraft}
                  onChange={(e) => setHrefDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyHref();
                  }}
                  placeholder="/pricing or https://…"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                  aria-label="Link address"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className={TOOL} onClick={applyHref}>
                    <Link2 size={14} /> {sel.href !== null ? "Update" : "Add link"}
                  </button>
                  <button
                    type="button"
                    className={TOOL}
                    onClick={removeLink}
                    disabled={sel.href === null}
                  >
                    <Unlink size={14} /> Remove
                  </button>
                </div>
              </section>

              {(sel.isImage || sel.hasBackgroundImage || !sel.canEditText) && (
                <section className="space-y-2">
                  <p className="text-xs font-medium">Image</p>
                  {sel.isImage && (
                    <>
                      <button
                        type="button"
                        className={`${TOOL} w-full`}
                        onClick={() => openUpload("img")}
                        disabled={busy === "asset"}
                      >
                        <ImagePlus size={14} /> {busy === "asset" ? "Uploading…" : "Replace image"}
                      </button>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={altDraft}
                          onChange={(e) => setAltDraft(e.target.value)}
                          onBlur={applyAlt}
                          placeholder="Alt text"
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                          aria-label="Image alt text"
                        />
                      </div>
                    </>
                  )}
                  {!sel.isImage && !sel.isSvg && (
                    <button
                      type="button"
                      className={`${TOOL} w-full`}
                      onClick={() => openUpload("bg")}
                      disabled={busy === "asset"}
                    >
                      <ImagePlus size={14} />{" "}
                      {sel.hasBackgroundImage ? "Replace background" : "Set background image"}
                    </button>
                  )}
                </section>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
