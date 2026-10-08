import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Monitor, Redo2, Save, Smartphone, Tablet, Undo2 } from "lucide-react";
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
  EditorInspector,
  type InspectorActions,
  type SectionAction,
} from "@/components/dashboard/editor-inspector";
import {
  ATTR_EDITING,
  ATTR_HIDDEN,
  ATTR_HOVER,
  ATTR_SELECTED,
  type PageSection,
  type SelectionInfo,
  collectPalette,
  ensureFontLoaded,
  fontStack,
  listSections,
  similarElements,
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
const EDITOR_ATTR_RE =
  /\s(?:data-clonyfy-editor-(?:hover|selected|editing)|data-cth(?![-\w]))(?:="[^"]*")?/g;

const TOOL_ACTIVE = "bg-primary text-primary-foreground hover:bg-primary";
/** Text-bearing tags that a page-wide font change should restyle. */
const PAGE_FONT_TARGETS =
  "h1,h2,h3,h4,h5,h6,p,a,span,li,button,label,blockquote,figcaption,small,strong,em,b,td,th,dt,dd,input,textarea,select";
const ICON_FONT_RE = /icon|awesome|material|symbol|glyph|dashicons/i;

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
  const [selKey, setSelKey] = useState(0);
  const [palette, setPalette] = useState<string[]>([]);
  const [sections, setSections] = useState<PageSection[]>([]);

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
        if (!cancelled)
          setThemeError(err instanceof Error ? err.message : "Could not load style models.");
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
    if (docRef.current) setPalette(collectPalette(docRef.current));
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
      setSel(describeElement(selectedRef.current, origStyleRef.current.has(selectedRef.current)));
    } else {
      setSel(null);
    }
    setSelKey((k) => k + 1);
  };

  /** Re-read the page's section list (after structural edits or layout settles). */
  const refreshLayers = () => {
    const doc = docRef.current;
    if (!doc?.body) return;
    requestAnimationFrame(() => {
      if (docRef.current === doc) setSections(listSections(doc));
    });
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
    refreshLayers();
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
    refreshLayers();
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
    refreshLayers();
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
    refreshLayers();
  };

  const selectAncestor = (levelsUp: number) => {
    commitEditing();
    let el: HTMLElement | null = selectedRef.current;
    for (let i = 0; i < levelsUp && el; i++) el = el.parentElement;
    if (!el || el.tagName === "BODY" || el.tagName === "HTML") return;
    select(el);
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  /** Hide keeps the element (and its prior inline display) so Show restores it exactly. */
  const toggleHidden = (target?: HTMLElement) => {
    commitEditing();
    const el = target ?? selectedRef.current;
    if (!el?.isConnected) return;
    pushUndo();
    if (el.hasAttribute(ATTR_HIDDEN)) {
      const prev = el.getAttribute(ATTR_HIDDEN) || "";
      el.removeAttribute(ATTR_HIDDEN);
      if (prev) el.style.setProperty("display", prev);
      else el.style.removeProperty("display");
    } else {
      el.setAttribute(ATTR_HIDDEN, el.style.getPropertyValue("display") || "");
      el.style.setProperty("display", "none", "important");
    }
    setDirty(true);
    if (el === selectedRef.current) refreshSel();
    refreshLayers();
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

  /** Copy the selected element's text style onto every element that looks the same. */
  const matchSimilar = () => {
    commitEditing();
    const el = selectedRef.current;
    const view = docRef.current?.defaultView;
    if (!el?.isConnected || !view) return;
    const others = similarElements(el).filter((x) => x !== el) as HTMLElement[];
    if (!others.length) return;
    pushUndo();
    const cs = view.getComputedStyle(el);
    const props = [
      "font-family",
      "font-size",
      "font-weight",
      "font-style",
      "line-height",
      "letter-spacing",
      "text-transform",
      "text-decoration-line",
      "text-align",
      "color",
    ];
    for (const other of others) {
      rememberStyle(other);
      for (const p of props) other.style.setProperty(p, cs.getPropertyValue(p), "important");
    }
    setDirty(true);
    refreshSel();
    toast.success(
      `Text style applied to ${others.length} similar element${others.length === 1 ? "" : "s"}.`,
    );
  };

  const setFont = (family: string | null, scope: "element" | "page") => {
    const doc = docRef.current;
    if (!doc?.body) return;
    if (family) ensureFontLoaded(doc, family);
    if (scope === "page" && family) {
      commitEditing();
      pushUndo();
      const view = doc.defaultView;
      const stack = fontStack(family);
      for (const node of [
        doc.body,
        ...Array.from(doc.body.querySelectorAll<HTMLElement>(PAGE_FONT_TARGETS)),
      ]) {
        // Leave icon fonts alone — swapping them turns glyphs into letters.
        if (view && ICON_FONT_RE.test(view.getComputedStyle(node).fontFamily)) continue;
        rememberStyle(node);
        node.style.setProperty("font-family", stack, "important");
      }
      setDirty(true);
      refreshSel();
      toast.success(`${family} now used across this page.`);
      return;
    }
    const el = selectedRef.current;
    if (!el?.isConnected) return;
    if (family) {
      applyStyle({ "font-family": fontStack(family) }, "font-family");
    } else {
      recordChange("font-family");
      rememberStyle(el);
      el.style.removeProperty("font-family");
      refreshSel();
    }
  };

  /** Plain-text elements only (no child elements), so markup is never lost. */
  const setText = (text: string) => {
    const el = selectedRef.current;
    if (!el?.isConnected || el.children.length) return;
    commitEditing();
    pushUndo();
    el.textContent = text;
    setDirty(true);
    refreshSel();
    refreshLayers();
  };

  const setLink = (rawHref: string, newTab: boolean) => {
    const el = selectedRef.current;
    const doc = docRef.current;
    const href = rawHref.trim();
    if (!el?.isConnected || !doc) return;
    if (!href) {
      toast.error("Enter a link address first.");
      return;
    }
    commitEditing();
    pushUndo();
    let link = el.closest("a");
    if (!link) {
      link = doc.createElement("a");
      el.replaceWith(link);
      link.appendChild(el);
    }
    link.setAttribute("href", href);
    if (newTab) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    } else {
      link.removeAttribute("target");
      if (link.getAttribute("rel") === "noopener noreferrer") link.removeAttribute("rel");
    }
    setDirty(true);
    refreshSel();
    toast.success("Link updated.");
  };

  const removeLink = () => {
    const el = selectedRef.current;
    const link = el?.closest("a");
    if (!el || !link) return;
    commitEditing();
    pushUndo();
    link.replaceWith(...Array.from(link.childNodes));
    refreshSel();
    setDirty(true);
  };

  const setAlt = (alt: string) => {
    const el = selectedRef.current;
    if (!el || el.tagName !== "IMG" || el.getAttribute("alt") === alt) return;
    recordChange("alt");
    el.setAttribute("alt", alt);
    refreshSel();
  };

  const sectionAction = (el: HTMLElement, action: SectionAction) => {
    if (!el.isConnected) return;
    if (action === "toggle") {
      toggleHidden(el);
      return;
    }
    commitEditing();
    select(el);
    if (action === "select") el.scrollIntoView({ block: "start", behavior: "smooth" });
    else if (action === "up" || action === "down") moveSelected(action);
    else if (action === "duplicate") duplicateSelected();
    else if (action === "delete") deleteSelected();
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
    setSections(listSections(doc));
    setPalette(collectPalette(doc));
    // Fonts and images change layout after load — re-read sections once it settles.
    setTimeout(() => {
      if (docRef.current !== doc) return;
      setSections(listSections(doc));
      setPalette(collectPalette(doc));
    }, 800);

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

  const inspectorActions: InspectorActions = {
    editText: () => selectedRef.current && startEditing(selectedRef.current),
    selectAncestor,
    duplicate: duplicateSelected,
    move: moveSelected,
    toggleHidden: () => toggleHidden(),
    remove: deleteSelected,
    deselect: () => {
      commitEditing();
      select(null);
    },
    style: applyStyle,
    matchSimilar,
    setFont,
    removeShadows: removeShadow,
    resetStyles,
    setText,
    setLink,
    removeLink,
    setAlt,
    replaceImage: () => openUpload("img"),
    replaceBackground: () => openUpload("bg"),
    removeBackground: () => applyStyle({ "background-image": "none" }, "bg-image"),
    section: sectionAction,
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_352px]">
        <div className="overflow-auto rounded-2xl border border-border bg-muted/30">
          {loading ? (
            <div className="grid h-[78vh] min-h-[520px] place-items-center text-sm text-muted-foreground">
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
                className="block h-[78vh] min-h-[520px] w-full bg-background"
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <div className="grid h-[78vh] min-h-[520px] place-items-center text-sm text-muted-foreground">
              No page HTML available.
            </div>
          )}
        </div>

        <EditorInspector
          sel={sel}
          selKey={selKey}
          selectedEl={selectedRef.current}
          editingText={editingText}
          dirty={dirty}
          uploading={busy === "asset"}
          palette={palette}
          sections={sections}
          actions={inspectorActions}
        />
      </div>
    </div>
  );
}
