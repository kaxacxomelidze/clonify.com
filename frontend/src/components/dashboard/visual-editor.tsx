import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Code2,
  Download,
  ExternalLink,
  Eye,
  Monitor,
  MousePointer2,
  Palette,
  Redo2,
  Save,
  Smartphone,
  Tablet,
  Undo2,
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
  fetchInteractivePreviewUrl,
  fetchPageHtml,
  importAsset,
  loadThemeEngine,
  savePage,
  setCloneTheme,
} from "@/lib/api";
import { SiteStylePanel } from "@/components/dashboard/theme-models-panel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  StudioInspector,
  type SectionTarget,
  type StudioActions,
} from "@/components/dashboard/studio/inspector";
import {
  BLOCK_MIME,
  StudioLeftPanel,
  type DropZone,
  type LeftActions,
} from "@/components/dashboard/studio/left-panel";
import { SourceView } from "@/components/dashboard/studio/source-view";
import {
  ATTR_DRAGGING,
  ATTR_DROP,
  ATTR_EDITING,
  ATTR_HIDDEN,
  ATTR_HOVER,
  ATTR_PREVIEW,
  ATTR_SELECTED,
  type PageSection,
  type SelectionInfo,
  canEditText,
  clearEditorAttrs,
  collectPalette,
  describeElement,
  ensureFontLoaded,
  fontStack,
  friendlyName,
  htmlForSave,
  insertPlainText,
  installEditorChrome,
  isEffectivelyEmpty,
  listSections,
  placeCaretAtPoint,
  pruneEmptyDescendants,
  removeWithEmptyAncestors,
  selectableTarget,
  similarElements,
  textTargetFor,
} from "@/lib/editor-dom";
import {
  ATTR_LOCK,
  ATTR_NAME,
  STUDIO_STYLE_ID,
  adoptFragment,
  clearStudioFor,
  declaredStyle,
  getDesign,
  lockedAncestor,
  modelFragment,
  readModel,
  setDesign,
  setMotion,
  setScopedStyles,
  writeModel,
  type Scope,
} from "@/lib/studio/engine";
import {
  analyzeSection,
  clearRoles,
  detectKind,
  lookFonts,
  type DesignChoice,
  type SectionKind,
} from "@/lib/studio/designs";
import type { MotionConfig } from "@/lib/studio/motion";
import { describeStudio, type StudioInfo } from "@/lib/studio/describe";
import { addAsset, addLibraryItem, type LibraryItem } from "@/lib/studio/library";
import { startRuntimeHost, type RuntimeHost } from "@/lib/studio/runtime-host";
import { startScrollReplay, type ScrollReplay } from "@/lib/studio/scroll-replay";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

type Device = "desktop" | "tablet" | "mobile";
type Mode = "edit" | "preview" | "source";
type Zoom = "fit" | 1 | 0.75 | 0.5;
/**
 * Each device's viewport. The height matters as much as the width: pages size sections
 * with vh/dvh, so the canvas must report a real screen height — never the zoomed-out
 * canvas height, which made screen-tall sections (heroes) grow far taller than in the
 * preview. Desktop uses the shape of the user's own browser window, where Live preview
 * opens.
 */
const DEVICES: Array<{
  id: Device;
  label: string;
  width: number;
  height: (width: number) => number;
  Icon: typeof Monitor;
}> = [
  {
    id: "desktop",
    label: "Desktop",
    width: 1440,
    height: (w) =>
      Math.round(
        Math.min(1100, Math.max(640, (w * window.innerHeight) / Math.max(1, window.innerWidth))),
      ),
    Icon: Monitor,
  },
  { id: "tablet", label: "Tablet", width: 820, height: () => 1180, Icon: Tablet },
  { id: "mobile", label: "Mobile", width: 390, height: () => 844, Icon: Smartphone },
];
const SCOPE_OF: Record<Device, Scope> = { desktop: "base", tablet: "tablet", mobile: "mobile" };
const DEFAULT_LAYOUT: Record<SectionKind, string> = {
  nav: "split",
  hero: "centered",
  cards: "elevated",
  cta: "banner",
  footer: "standard",
  content: "standard",
};

const MAX_HISTORY = 50;
const MAX_HISTORY_CHARS = 60_000_000;
const EDITOR_ATTR_RE = /\s(?:data-clonyfy-editor-[a-z-]+|data-cth(?![-\w]))(?:="[^"]*")?/g;
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

const TOP_BTN =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40";

export function VisualEditor({
  outDir,
  initialRoute = "/",
}: {
  outDir: string;
  initialRoute?: string;
}) {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<"img" | "bg" | "asset">("img");
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
  const modeRef = useRef<Mode>("edit");
  const scopeRef = useRef<Scope>("base");
  const dragRef = useRef<{
    el: HTMLElement;
    x: number;
    y: number;
    baseX: number;
    baseY: number;
    active: boolean;
    pointerId: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const initializedDocsRef = useRef(new WeakSet<Document>());

  const [routes, setRoutes] = useState<string[]>([]);
  const [route, setRoute] = useState(initialRoute);
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  // The first open of a page may record its scroll animations on the server (~1 min, once).
  const [slowLoad, setSlowLoad] = useState(false);
  useEffect(() => {
    setSlowLoad(false);
    if (!loading) return;
    const t = setTimeout(() => setSlowLoad(true), 5000);
    return () => clearTimeout(t);
  }, [loading]);
  const [busy, setBusy] = useState("");
  const [dirty, setDirty] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const [mode, setMode] = useState<Mode>("edit");
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [canvasSize, setCanvasSize] = useState({ w: 1200, h: 800 });
  const [sel, setSel] = useState<SelectionInfo | null>(null);
  const [studio, setStudio] = useState<StudioInfo | null>(null);
  const [section, setSection] = useState<SectionTarget | null>(null);
  const [editingText, setEditingText] = useState(false);
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  const [selKey, setSelKey] = useState(0);
  const [palette, setPalette] = useState<string[]>([]);
  const [sections, setSections] = useState<PageSection[]>([]);
  const [version, setVersion] = useState(0);
  const [pageLook, setPageLook] = useState<string | null>(null);
  const [styleOpen, setStyleOpen] = useState(false);

  const themeEngineRef = useRef<ThemeEngine | null>(null);
  const themeIdRef = useRef<string | null>(null);
  const [themeModels, setThemeModels] = useState<ThemeModel[]>([]);
  const [themeId, setThemeId] = useState<string | null>(null);
  const [themePending, setThemePending] = useState<string | null | undefined>(undefined);
  const [themeError, setThemeError] = useState("");

  const scope = SCOPE_OF[device];
  scopeRef.current = scope;
  modeRef.current = mode;

  /* ---------------------------------------------------------------- theme */

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

  /* -------------------------------------------------------------- history */

  const updateHistory = () =>
    setHistory({ undo: undoRef.current.length, redo: redoRef.current.length });
  const replayRef = useRef<ScrollReplay | null>(null);
  const hostRef = useRef<RuntimeHost | null>(null);
  /** Stop the preview scripts and the scroll replay; the page is back to its saved state. */
  const stopRuntime = () => {
    replayRef.current?.destroy();
    replayRef.current = null;
    hostRef.current?.destroy();
    hostRef.current = null;
  };
  useEffect(() => stopRuntime, []);
  /** Run fn against the page as saved (no animation frame or script change baked in). */
  const asSaved = <T,>(fn: () => T): T => {
    const host = hostRef.current;
    const replay = replayRef.current;
    const inner = host ? () => host.withOriginals(fn) : fn;
    const run = replay ? () => replay.withOriginals(inner) : inner;
    return host ? host.quiet(run) : run();
  };
  /** Like selectableTarget, but copies the preview scripts made (marquee loops) select their host. */
  const pickTarget = (node: EventTarget | null) => {
    let el = selectableTarget(node);
    while (el && hostRef.current?.isRuntimeNode(el)) el = selectableTarget(el.parentElement);
    return el;
  };
  /** The user is about to edit `el`: animations and preview scripts leave it alone. */
  const handOver = (el: Element | null) => {
    replayRef.current?.touch(el);
    hostRef.current?.own(el);
  };
  const snapshot = (doc: Document) => asSaved(() => doc.body.innerHTML.replace(EDITOR_ATTR_RE, ""));
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
    handOver(selectedRef.current);
  };
  /** Coalesce rapid changes of the same control (sliders, color pickers) into one step. */
  const recordChange = (key: string) => {
    const now = Date.now();
    const last = lastChangeRef.current;
    const el = selectedRef.current;
    if (!last || last.key !== key || last.el !== el || now - last.at > 1500) pushUndo();
    else handOver(el);
    lastChangeRef.current = { key, at: now, el };
    setDirty(true);
  };

  /* ------------------------------------------------------------ selection */

  const sectionFor = (el: HTMLElement | null): SectionTarget | null => {
    const doc = docRef.current;
    if (!el || !doc) return null;
    const list = listSections(doc);
    const idx = list.findIndex((s) => s.el === el || s.el.contains(el));
    if (idx < 0) return null;
    const s = list[idx]!;
    return {
      kind: detectKind(s.el, idx, list.length),
      choice: getDesign(s.el),
      name: s.el.getAttribute(ATTR_NAME) || s.name,
      isSelf: s.el === el,
    };
  };
  const sectionElFor = (el: HTMLElement | null) => {
    const doc = docRef.current;
    if (!el || !doc) return null;
    return listSections(doc).find((s) => s.el === el || s.el.contains(el))?.el || null;
  };

  const refreshSel = () => {
    const el = selectedRef.current;
    if (!el || !el.isConnected) {
      selectedRef.current = null;
      setSel(null);
      setStudio(null);
      setSection(null);
      return;
    }
    setSel(describeElement(el, origStyleRef.current.has(el)));
    setStudio(describeStudio(el, scopeRef.current));
    setSection(sectionFor(el));
  };

  const select = (el: HTMLElement | null) => {
    selectedRef.current?.removeAttribute(ATTR_SELECTED);
    selectedRef.current = el && el.isConnected ? el : null;
    if (selectedRef.current) {
      selectedRef.current.removeAttribute(ATTR_HOVER);
      selectedRef.current.setAttribute(ATTR_SELECTED, "");
    }
    refreshSel();
    setSelKey((k) => k + 1);
  };

  const refreshLayers = () => {
    const doc = docRef.current;
    if (!doc?.body) return;
    requestAnimationFrame(() => {
      if (docRef.current !== doc) return;
      setSections(listSections(doc));
      setVersion((v) => v + 1);
    });
  };

  const restore = (bodyHtml: string) => {
    const doc = docRef.current;
    if (!doc?.body) return;
    editingRef.current = null;
    setEditingText(false);
    stopRuntime();
    doc.body.innerHTML = bodyHtml;
    clearEditorAttrs(doc.body);
    applyThemeToDoc();
    startRuntime(doc);
    selectedRef.current = null;
    hoverRef.current = null;
    setSel(null);
    setStudio(null);
    setSection(null);
    lastChangeRef.current = null;
    setDirty(true);
    refreshLayers();
  };

  /**
   * Make the canvas behave like the preview: run Clonyfy's preview scripts (canvas
   * frames, marquees, entrance animations…) and play the recorded scroll animation.
   */
  const swapRefreshRef = useRef(0);
  const startRuntime = (doc: Document) => {
    stopRuntime();
    const host = startRuntimeHost(doc);
    hostRef.current = host;
    replayRef.current = startScrollReplay(doc, {
      ...(host ? { quiet: host.quiet } : {}),
      onRegionSwap: (panel) => {
        // The step panel's children were replaced: drop a stale selection, re-tag
        // designed sections (designs address parts by role), refresh the layer list.
        if (selectedRef.current && !selectedRef.current.isConnected) select(null);
        const list = listSections(doc);
        list.forEach((s, i) => {
          if (!s.el.contains(panel)) return;
          const choice = getDesign(s.el);
          if (choice) analyzeSection(s.el, detectKind(s.el, i, list.length));
        });
        cancelAnimationFrame(swapRefreshRef.current);
        swapRefreshRef.current = requestAnimationFrame(() => setVersion((v) => v + 1));
      },
    });
  };

  const isLocked = (el: HTMLElement | null) => !!el && !!lockedAncestor(el);
  const guardLocked = (el: HTMLElement | null) => {
    if (!isLocked(el)) return false;
    toast.message("This layer is locked — unlock it to make changes.");
    return true;
  };

  /* --------------------------------------------------------- text editing */

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
      toast.message("Text removed together with its styling.");
      refreshLayers();
    } else {
      refreshSel();
    }
    setDirty(true);
  };

  const startEditing = (el: HTMLElement, point?: { x: number; y: number }) => {
    const doc = docRef.current;
    if (!doc || guardLocked(el)) return;
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
    placeCaretAtPoint(doc, point?.x ?? -1, point?.y ?? -1, target);
    setEditingText(true);
  };

  /* -------------------------------------------------------------- actions */

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
    if (!el?.isConnected || guardLocked(el)) return;
    pushUndo();
    select(null);
    removeWithEmptyAncestors(el);
    const doc = docRef.current;
    if (doc) writeModel(doc, readModel(doc)); // drop styles of removed layers
    setDirty(true);
    refreshLayers();
  };

  const duplicateSelected = () => {
    commitEditing();
    const el = selectedRef.current;
    if (!el?.isConnected || guardLocked(el)) return;
    pushUndo();
    const copy = el.cloneNode(true) as HTMLElement;
    clearEditorAttrs(copy);
    copy.removeAttribute(ATTR_SELECTED);
    copy.removeAttribute(ATTR_HOVER);
    el.after(copy);
    adoptFragment([copy], null); // the copy gets its own ids, designs and motion
    select(copy);
    setDirty(true);
    refreshLayers();
  };

  const moveSelected = (dir: "up" | "down") => {
    commitEditing();
    const el = selectedRef.current;
    if (!el?.isConnected || guardLocked(el)) return;
    const sibling = dir === "up" ? el.previousElementSibling : el.nextElementSibling;
    if (!sibling || sibling.id === STUDIO_STYLE_ID) return;
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

  const toggleHidden = () => {
    commitEditing();
    const el = selectedRef.current;
    if (!el?.isConnected || guardLocked(el)) return;
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
    refreshSel();
    refreshLayers();
  };

  const toggleLock = () => {
    const el = selectedRef.current;
    if (!el?.isConnected) return;
    commitEditing();
    pushUndo();
    if (el.hasAttribute(ATTR_LOCK)) el.removeAttribute(ATTR_LOCK);
    else el.setAttribute(ATTR_LOCK, "1");
    setDirty(true);
    refreshSel();
    refreshLayers();
  };

  const rename = (name: string) => {
    const el = selectedRef.current;
    if (!el?.isConnected) return;
    pushUndo();
    if (name.trim()) el.setAttribute(ATTR_NAME, name.trim().slice(0, 60));
    else el.removeAttribute(ATTR_NAME);
    setDirty(true);
    refreshSel();
    refreshLayers();
  };

  const rememberStyle = (el: Element) => {
    if (!origStyleRef.current.has(el)) origStyleRef.current.set(el, el.getAttribute("style"));
  };

  /** Style edit for the current device scope (desktop = base, cascades to all). */
  const applyStyle = (props: Record<string, string>, key: string) => {
    const el = selectedRef.current;
    if (!el?.isConnected || guardLocked(el)) return;
    recordChange(key);
    rememberStyle(el);
    setScopedStyles(el, scopeRef.current, props);
    refreshSel();
  };

  const removeShadow = () => {
    const el = selectedRef.current;
    const view = docRef.current?.defaultView;
    if (!el?.isConnected || !view || guardLocked(el)) return;
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
    if (!el?.isConnected || guardLocked(el)) return;
    pushUndo();
    if (origStyleRef.current.has(el)) {
      const orig = origStyleRef.current.get(el) ?? null;
      if (orig === null) el.removeAttribute("style");
      else el.setAttribute("style", orig);
      origStyleRef.current.delete(el);
    }
    clearStudioFor(el);
    refreshSel();
    setDirty(true);
  };

  const matchSimilar = () => {
    commitEditing();
    const el = selectedRef.current;
    const view = docRef.current?.defaultView;
    if (!el?.isConnected || !view) return;
    const others = similarElements(el).filter(
      (x) => x !== el && !isLocked(x as HTMLElement),
    ) as HTMLElement[];
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

  const setFont = (family: string | null, fontScope: "element" | "page") => {
    const doc = docRef.current;
    if (!doc?.body) return;
    if (family) ensureFontLoaded(doc, family);
    if (fontScope === "page" && family) {
      commitEditing();
      pushUndo();
      const view = doc.defaultView;
      const stack = fontStack(family);
      for (const node of [
        doc.body,
        ...Array.from(doc.body.querySelectorAll<HTMLElement>(PAGE_FONT_TARGETS)),
      ]) {
        if (view && ICON_FONT_RE.test(view.getComputedStyle(node).fontFamily)) continue;
        rememberStyle(node);
        node.style.setProperty("font-family", stack, "important");
      }
      setDirty(true);
      refreshSel();
      toast.success(`${family} now used across this page.`);
      return;
    }
    applyStyle({ "font-family": family ? fontStack(family) : "" }, "font-family");
  };

  const setText = (text: string) => {
    const el = selectedRef.current;
    if (!el?.isConnected || el.children.length || guardLocked(el)) return;
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
    if (!el?.isConnected || !doc || guardLocked(el)) return;
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
    if (!el || !link || guardLocked(el)) return;
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

  /* ------------------------------------------------------ designs/motion */

  const designSection = (el: HTMLElement, choice: DesignChoice) => {
    const doc = docRef.current;
    if (!doc) return;
    for (const f of lookFonts(choice.look)) ensureFontLoaded(doc, f);
    analyzeSection(el, choice.kind);
    setDesign(el, choice);
  };

  const applyDesign = (choice: DesignChoice | null) => {
    commitEditing();
    const target = sectionElFor(selectedRef.current);
    if (!target || guardLocked(target)) return;
    pushUndo();
    if (choice) designSection(target, choice);
    else {
      clearRoles(target);
      setDesign(target, null);
    }
    setDirty(true);
    refreshSel();
  };

  const applyLookToPage = (lookId: string) => {
    const doc = docRef.current;
    if (!doc) return;
    commitEditing();
    pushUndo();
    const list = listSections(doc);
    list.forEach((s, i) => {
      if (isLocked(s.el)) return;
      const kind = detectKind(s.el, i, list.length);
      const layout = getDesign(s.el)?.layout || DEFAULT_LAYOUT[kind];
      designSection(s.el, { kind, look: lookId, layout });
    });
    setPageLook(lookId);
    setDirty(true);
    refreshSel();
    toast.success(`Applied to ${list.length} sections. Undo to compare.`);
  };

  const clearPageDesigns = () => {
    const doc = docRef.current;
    if (!doc) return;
    commitEditing();
    pushUndo();
    const model = readModel(doc);
    for (const id of Object.keys(model.designs)) {
      const el = doc.querySelector(`[data-cfy="${id}"]`);
      if (el) clearRoles(el);
    }
    model.designs = {};
    writeModel(doc, model);
    setPageLook(null);
    setDirty(true);
    refreshSel();
  };

  const applyMotion = (cfg: MotionConfig | null) => {
    const el = selectedRef.current;
    if (!el?.isConnected || guardLocked(el)) return;
    recordChange("motion");
    setMotion(el, cfg);
    refreshSel();
    if (cfg) replayMotion();
  };

  const replayMotion = () => {
    const el = selectedRef.current;
    if (!el) return;
    const prev = el.style.getPropertyValue("animation");
    const prio = el.style.getPropertyPriority("animation");
    el.style.setProperty("animation", "none", "important");
    void el.offsetWidth;
    if (prev) el.style.setProperty("animation", prev, prio);
    else el.style.removeProperty("animation");
  };

  /* --------------------------------------------------------------- insert */

  const insertNodes = (html: string, target: HTMLElement | null, zone: DropZone): HTMLElement[] => {
    const doc = docRef.current;
    if (!doc?.body) return [];
    const tpl = doc.createElement("template");
    tpl.innerHTML = html.trim();
    const nodes = Array.from(tpl.content.children) as HTMLElement[];
    if (!nodes.length) return [];
    const studioStyle = doc.getElementById(STUDIO_STYLE_ID);
    if (!target) {
      if (studioStyle) studioStyle.before(...nodes);
      else doc.body.append(...nodes);
    } else if (zone === "before") target.before(...nodes);
    else if (zone === "inside") target.append(...nodes);
    else target.after(...nodes);
    return nodes;
  };

  const insertBlock = (
    html: string,
    asSection: boolean,
    dropTarget?: HTMLElement | null,
    dropZone?: DropZone,
  ) => {
    const doc = docRef.current;
    if (!doc) return;
    commitEditing();
    let target: HTMLElement | null = dropTarget ?? null;
    let zone: DropZone = dropZone ?? "after";
    if (!dropTarget) {
      const selected = selectedRef.current;
      // Nothing selected: use the section currently in view on the canvas — never the
      // end of <body>, which sits outside every section (often below the footer).
      const view = doc.defaultView;
      const centerEl = view
        ? pickTarget(doc.elementFromPoint(view.innerWidth / 2, view.innerHeight / 2))
        : null;
      const inView = sectionElFor(centerEl) || listSections(doc).at(-1)?.el || null;
      if (asSection) {
        target = sectionElFor(selected) || inView;
        zone = "after";
      } else if (selected) {
        target = selected;
        zone = "after";
      } else {
        // Right after the block the user is looking at (not the end of a tall section).
        let anchor: HTMLElement | null = centerEl;
        while (
          anchor &&
          anchor !== inView &&
          /^inline/.test(view?.getComputedStyle(anchor).display || "") &&
          anchor.parentElement
        ) {
          anchor = anchor.parentElement;
        }
        const usable =
          anchor && inView && anchor !== inView && inView.contains(anchor) && !isLocked(anchor);
        target = usable ? anchor : inView;
        zone = usable ? "after" : "inside";
      }
    }
    if (target && isLocked(target)) zone = "after";
    pushUndo();
    handOver(target);
    const nodes = insertNodes(html, target, zone);
    if (!nodes.length) return;
    if (asSection && pageLook) {
      const list = listSections(doc);
      const idx = list.findIndex((s) => s.el === nodes[0]);
      if (idx >= 0) {
        const kind = detectKind(nodes[0]!, idx, list.length);
        designSection(nodes[0]!, { kind, look: pageLook, layout: DEFAULT_LAYOUT[kind] });
      }
    }
    select(nodes[0]!);
    nodes[0]!.scrollIntoView({ block: "nearest", behavior: "smooth" });
    setDirty(true);
    refreshLayers();
  };

  const insertLibrary = (item: LibraryItem) => {
    commitEditing();
    const target = selectedRef.current
      ? sectionElFor(selectedRef.current) || selectedRef.current
      : null;
    pushUndo();
    const nodes = insertNodes(item.html, target, "after");
    if (!nodes.length) return;
    adoptFragment(nodes, item.model);
    select(nodes[0]!);
    nodes[0]!.scrollIntoView({ block: "nearest", behavior: "smooth" });
    setDirty(true);
    refreshLayers();
    toast.success(`Inserted “${item.name}”.`);
  };

  const saveToLibrary = () => {
    const el = selectedRef.current;
    if (!el?.isConnected) return;
    const clone = el.cloneNode(true) as HTMLElement;
    clearEditorAttrs(clone);
    for (const a of [ATTR_SELECTED, ATTR_HOVER, ATTR_EDITING, ATTR_DROP, ATTR_DRAGGING])
      clone.removeAttribute(a);
    const name = el.getAttribute(ATTR_NAME) || friendlyName(el);
    const ok = addLibraryItem({
      name,
      kind: sel?.kindLabel || "Component",
      html: clone.outerHTML,
      model: modelFragment(el),
    });
    if (ok) toast.success(`“${name}” saved to your library.`);
    else toast.error("Library is full or browser storage is blocked.");
    setVersion((v) => v + 1);
  };

  const moveLayer = (el: HTMLElement, target: HTMLElement, zone: DropZone) => {
    if (guardLocked(el) || el.contains(target)) return;
    commitEditing();
    pushUndo();
    handOver(el);
    handOver(target);
    if (zone === "before") target.before(el);
    else if (zone === "inside") target.append(el);
    else target.after(el);
    select(el);
    setDirty(true);
    refreshLayers();
  };

  /* --------------------------------------------------------------- assets */

  const openUpload = (target: "img" | "bg" | "asset") => {
    uploadTargetRef.current = target;
    fileRef.current?.click();
  };

  const placeImage = (src: string, mode: "image" | "background") => {
    const el = selectedRef.current;
    if (mode === "background") {
      if (!el?.isConnected) {
        toast.message("Select an element to use this as its background.");
        return;
      }
      applyStyle(
        {
          "background-image": `url("${src}")`,
          "background-size": "cover",
          "background-position": "center",
        },
        "bg-image",
      );
      return;
    }
    if (el?.tagName === "IMG") {
      if (guardLocked(el)) return;
      pushUndo();
      el.setAttribute("src", src);
      for (const attr of ["srcset", "sizes", "data-src", "data-srcset", "data-lazy-src"])
        el.removeAttribute(attr);
      el.setAttribute("loading", "eager");
      if (el.parentElement?.tagName === "PICTURE")
        el.parentElement.querySelectorAll("source").forEach((s) => s.remove());
      setDirty(true);
      refreshSel();
      return;
    }
    insertBlock(
      `<img src="${src.replace(/"/g, "&quot;")}" alt="" style="display:block;max-width:100%;height:auto;border-radius:12px">`,
      false,
    );
  };

  const onUpload = async (file: File | null) => {
    if (!file) return;
    const target = uploadTargetRef.current;
    if (target !== "asset" && !selectedRef.current?.isConnected) {
      toast.error("Select an image or element first.");
      return;
    }
    setBusy("asset");
    try {
      await ensureApiAwake({ attempts: 3, timeoutMs: 10_000 }).catch(() => {});
      const dataUrl = await fileToDataUrl(file);
      const uploaded = await importAsset(outDir, dataUrl, file.name);
      const src = uploaded.previewUrl || uploaded.path;
      addAsset(outDir, { src, name: file.name });
      setVersion((v) => v + 1);
      if (target === "asset") toast.success("Image added to your assets.");
      else placeImage(src, target === "img" ? "image" : "background");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not import image.");
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /* ------------------------------------------------------------- keyboard */

  const nudge = (dx: number, dy: number) => {
    const el = selectedRef.current;
    if (!el?.isConnected || guardLocked(el)) return;
    const [x, y] = (declaredStyle(el, scopeRef.current, "translate") || "0px 0px")
      .split(/\s+/)
      .map((v) => parseFloat(v) || 0);
    applyStyle({ translate: `${(x ?? 0) + dx}px ${(y ?? 0) + dy}px` }, "nudge");
  };

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
    if (mod && key === "s") {
      e.preventDefault();
      void onSave();
      return;
    }
    if (modeRef.current !== "edit" || !selectedRef.current) return;
    const step = e.shiftKey ? 10 : 1;
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      if (e.key === "ArrowLeft") nudge(-step, 0);
      if (e.key === "ArrowRight") nudge(step, 0);
      if (e.key === "ArrowUp") nudge(0, -step);
      if (e.key === "ArrowDown") nudge(0, step);
      return;
    }
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
      (canEditText(selectedRef.current) || textTargetFor(selectedRef.current))
    ) {
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

  // Latest handlers for listeners installed once per iframe load.
  const insertBlockRef = useRef(insertBlock);
  insertBlockRef.current = insertBlock;
  const applyStyleRef = useRef(applyStyle);
  applyStyleRef.current = applyStyle;

  /* --------------------------------------------------------------- iframe */

  const onFrameLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body || !doc.body.childElementCount || initializedDocsRef.current.has(doc)) return;
    initializedDocsRef.current.add(doc); // listeners are installed exactly once per document
    docRef.current = doc;
    installEditorChrome(doc);
    startRuntime(doc);
    applyThemeToDoc();
    if (modeRef.current === "preview") doc.documentElement.setAttribute(ATTR_PREVIEW, "");
    selectedRef.current = null;
    hoverRef.current = null;
    editingRef.current = null;
    origStyleRef.current = new WeakMap();
    undoRef.current = [];
    redoRef.current = [];
    lastChangeRef.current = null;
    setSel(null);
    setStudio(null);
    setSection(null);
    setEditingText(false);
    updateHistory();
    setSections(listSections(doc));
    setPalette(collectPalette(doc));
    setVersion((v) => v + 1);
    // Re-run the model once so studio CSS is current and fonts for saved designs load.
    const model = readModel(doc);
    for (const choice of Object.values(model.designs))
      for (const f of lookFonts(choice.look)) ensureFontLoaded(doc, f);
    setTimeout(() => {
      if (docRef.current !== doc) return;
      setSections(listSections(doc));
      setPalette(collectPalette(doc));
      setVersion((v) => v + 1);
    }, 900);

    const editing = () => modeRef.current === "edit";

    doc.addEventListener(
      "mouseover",
      (e) => {
        if (!editing() || dragRef.current?.active) return;
        if (editingRef.current?.el.contains(e.target as Node)) return;
        const el = pickTarget(e.target);
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
        e.preventDefault(); // never navigate inside the editor
        if (!editing()) return;
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          e.stopPropagation();
          return;
        }
        const ed = editingRef.current;
        if (ed && ed.el.contains(e.target as Node)) return;
        e.stopPropagation();
        const target = pickTarget(e.target);
        if (
          target &&
          target === selectedRef.current &&
          !isLocked(target) &&
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
        if (!editing()) return;
        const el = pickTarget(e.target);
        if (!el || editingRef.current?.el.contains(el)) return;
        startEditing(el, { x: e.clientX, y: e.clientY });
      },
      true,
    );

    // Drag the selected element to move it (translate; device-scoped like any style).
    doc.addEventListener(
      "pointerdown",
      (e) => {
        if (!editing() || e.button !== 0 || editingRef.current) return;
        const target = pickTarget(e.target);
        const sel = selectedRef.current;
        if (!sel || !target || !(target === sel || sel.contains(target)) || isLocked(sel)) return;
        // Stops the browser's own link/image drag and text selection from competing
        // with the move (click and double-click still fire).
        e.preventDefault();
        const [bx, by] = (declaredStyle(sel, scopeRef.current, "translate") || "0px 0px")
          .split(/\s+/)
          .map((v) => parseFloat(v) || 0);
        dragRef.current = {
          el: sel,
          x: e.clientX,
          y: e.clientY,
          baseX: bx ?? 0,
          baseY: by ?? 0,
          active: false,
          pointerId: e.pointerId,
        };
      },
      true,
    );
    doc.addEventListener(
      "pointermove",
      (e) => {
        const d = dragRef.current;
        if (!d) return;
        let dx = e.clientX - d.x;
        let dy = e.clientY - d.y;
        if (!d.active) {
          if (Math.hypot(dx, dy) < 4) return;
          d.active = true;
          pushUndo();
          rememberStyle(d.el);
          d.el.setAttribute(ATTR_DRAGGING, "");
          hoverRef.current?.removeAttribute(ATTR_HOVER);
        }
        e.preventDefault();
        doc.getSelection()?.removeAllRanges();
        if (e.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0;
          else dx = 0;
        }
        setScopedStyles(d.el, scopeRef.current, {
          translate: `${Math.round(d.baseX + dx)}px ${Math.round(d.baseY + dy)}px`,
        });
      },
      true,
    );
    const endDrag = () => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d?.active) return;
      d.el.removeAttribute(ATTR_DRAGGING);
      suppressClickRef.current = true;
      setTimeout(() => (suppressClickRef.current = false), 0);
      setDirty(true);
      refreshSel();
    };
    doc.addEventListener("pointerup", endDrag, true);
    doc.addEventListener("pointercancel", endDrag, true);
    // Pointer left the canvas mid-drag: finish the move where it is.
    doc.documentElement.addEventListener("pointerleave", endDrag);

    // Blocks dragged in from the Add panel.
    let dropTarget: HTMLElement | null = null;
    let dropZone: DropZone = "after";
    const clearDrop = () => {
      dropTarget?.removeAttribute(ATTR_DROP);
      dropTarget = null;
    };
    doc.addEventListener("dragover", (e) => {
      if (!e.dataTransfer?.types.includes(BLOCK_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      let el = pickTarget(doc.elementFromPoint(e.clientX, e.clientY));
      const asSection = e.dataTransfer.types.includes("text/x-clonyfy-section");
      if (el && asSection) el = sectionElFor(el) || el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const y = (e.clientY - r.top) / Math.max(1, r.height);
      const container =
        !asSection &&
        /^(DIV|SECTION|MAIN|ARTICLE|ASIDE|HEADER|FOOTER|NAV|UL|OL|FORM)$/.test(el.tagName) &&
        r.height > 60;
      const zone: DropZone = y < 0.3 ? "before" : y > 0.7 || !container ? "after" : "inside";
      if (el !== dropTarget || zone !== dropZone) {
        clearDrop();
        dropTarget = el;
        dropZone = zone;
        el.setAttribute(ATTR_DROP, zone);
      }
    });
    doc.addEventListener("dragleave", (e) => {
      if (!(e.relatedTarget as Node | null)) clearDrop();
    });
    doc.addEventListener("drop", (e) => {
      const raw = e.dataTransfer?.getData(BLOCK_MIME);
      if (!raw) return;
      e.preventDefault();
      const target = dropTarget;
      const zone = dropZone;
      clearDrop();
      try {
        const { html, section } = JSON.parse(raw) as { html: string; section: boolean };
        insertBlockRef.current(html, section, target, zone);
      } catch {
        /* malformed payload */
      }
    });

    doc.addEventListener("keydown", (e) => handleKeyRef.current(e, true), true);
    doc.addEventListener(
      "focusout",
      (e) => {
        const ed = editingRef.current;
        if (!ed || e.target !== ed.el) return;
        const next = e.relatedTarget as Node | null;
        if (next && ed.el.contains(next)) return;
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

  // The iframe's load event can fire before React attaches onLoad (fast srcdoc
  // loads), which left the editor disconnected. Attach to any loaded document
  // that hasn't been initialised yet.
  const onFrameLoadRef = useRef(onFrameLoad);
  onFrameLoadRef.current = onFrameLoad;
  useEffect(() => {
    if (!html) return;
    const timer = window.setInterval(() => {
      const d = iframeRef.current?.contentDocument;
      if (
        d?.readyState === "complete" &&
        d.body?.childElementCount &&
        !initializedDocsRef.current.has(d)
      ) {
        onFrameLoadRef.current();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [html]);

  /* ---------------------------------------------------------------- modes */

  const switchMode = (next: Mode) => {
    commitEditing();
    const doc = docRef.current;
    if (next !== "edit") {
      hoverRef.current?.removeAttribute(ATTR_HOVER);
      hoverRef.current = null;
    }
    if (doc) {
      if (next === "preview") doc.documentElement.setAttribute(ATTR_PREVIEW, "");
      else doc.documentElement.removeAttribute(ATTR_PREVIEW);
    }
    setMode(next);
  };

  // Device change → selection details reflect the new scope.
  useEffect(() => {
    if (selectedRef.current) refreshSel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device]);

  const getSource = useCallback((which: "selection" | "page") => {
    const doc = docRef.current;
    if (!doc?.body) return "";
    const raw = asSaved(() =>
      which === "selection" && selectedRef.current
        ? selectedRef.current.outerHTML
        : doc.body.innerHTML,
    );
    return raw.replace(EDITOR_ATTR_RE, "").replace(/\scontenteditable="true"/g, "");
  }, []);

  const applySource = (which: "selection" | "page", code: string) => {
    const doc = docRef.current;
    if (!doc?.body) return;
    commitEditing();
    pushUndo();
    if (which === "page") {
      stopRuntime();
      doc.body.innerHTML = code;
      clearEditorAttrs(doc.body);
      applyThemeToDoc();
      startRuntime(doc);
      select(null);
    } else {
      const el = selectedRef.current;
      if (!el) return;
      const tpl = doc.createElement("template");
      tpl.innerHTML = code.trim();
      const nodes = Array.from(tpl.content.childNodes);
      if (!nodes.length) {
        toast.error("The code is empty — nothing to apply.");
        undoRef.current.pop();
        updateHistory();
        return;
      }
      el.replaceWith(...nodes);
      const first = nodes.find((n) => n.nodeType === 1) as HTMLElement | undefined;
      select(first || null);
    }
    writeModel(doc, readModel(doc));
    setDirty(true);
    refreshLayers();
    toast.success("Source applied.");
  };

  /* ----------------------------------------------------------- page load */

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
            if (err instanceof ApiError && err.status === 429) toast.error(err.message);
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
        const normalized = (list.length ? list : ["/"]).filter(
          (r) => !/\.html?$/i.test(r) || !list.includes(r.replace(/\.html?$/i, "")),
        );
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
      return false;
    }
    setBusy("save");
    try {
      await ensureApiAwake({ attempts: 3, timeoutMs: 10_000 }).catch(() => {});
      await savePage(
        outDir,
        route,
        asSaved(() => htmlForSave(doc)),
      );
      setDirty(false);
      toast.success("Page saved.");
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed.");
      return false;
    } finally {
      setBusy("");
    }
  };

  const openLivePreview = async () => {
    if (dirty && !(await onSave())) return;
    const tab = window.open("about:blank", "_blank");
    try {
      const { url } = await fetchInteractivePreviewUrl(outDir, route);
      if (tab) tab.location.href = url;
      else window.open(url, "_blank", "noopener");
    } catch (err) {
      tab?.close();
      toast.error(err instanceof ApiError ? err.message : "Could not open the preview.");
    }
  };

  const exportHtml = () => {
    const doc = docRef.current;
    if (!doc) return;
    const blob = new Blob([asSaved(() => htmlForSave(doc))], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const name =
      (route === "/" ? "index" : route.replace(/^\/+|\/+$/g, "").replace(/[^\w-]+/g, "-")) ||
      "page";
    a.download = `${name}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  /* -------------------------------------------------------------- canvas */

  useLayoutEffect(() => {
    const node = canvasRef.current;
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setCanvasSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const deviceSpec = DEVICES.find((d) => d.id === device)!;
  const deviceWidth = deviceSpec.width;
  const screenHeight = deviceSpec.height(deviceWidth);
  // Desktop shows a taller frame so the canvas below it isn't left empty.
  const frameHeight = device === "desktop" ? Math.round(screenHeight * 1.4) : screenHeight;
  // Fit sizes by the device screen: canvas padding (48), title bar (28) and bottom bar room (56).
  const scale =
    zoom === "fit"
      ? Math.min(
          1,
          Math.max(
            0.2,
            Math.min((canvasSize.w - 48) / deviceWidth, (canvasSize.h - 108) / screenHeight),
          ),
        )
      : zoom;
  let host = "clone";
  try {
    host =
      outDir
        .split(/[\\/]/)
        .pop()
        ?.replace(/-[a-f0-9]{6}$/, "")
        .replace(/-/g, ".") || "clone";
  } catch {
    /* keep default */
  }

  /* ------------------------------------------------------------- actions */

  const studioActions: StudioActions = {
    editText: () => selectedRef.current && startEditing(selectedRef.current),
    selectAncestor,
    selectSection: () => {
      const s = sectionElFor(selectedRef.current);
      if (s) select(s);
    },
    duplicate: duplicateSelected,
    move: moveSelected,
    toggleHidden,
    toggleLock,
    remove: deleteSelected,
    deselect: () => {
      commitEditing();
      select(null);
    },
    saveToLibrary,
    rename,
    style: applyStyle,
    setFont,
    matchSimilar,
    removeShadows: removeShadow,
    resetStyles,
    setText,
    setLink,
    removeLink,
    setAlt,
    replaceImage: () => openUpload("img"),
    replaceBackground: () => openUpload("bg"),
    removeBackground: () => applyStyle({ "background-image": "none" }, "bg-image"),
    applyDesign,
    applyLookToPage,
    clearPageDesigns,
    setMotion: applyMotion,
    replayMotion,
  };

  const leftActions: LeftActions = {
    select: (el) => {
      commitEditing();
      if (modeRef.current !== "edit") switchMode("edit");
      // Animated layers: scroll to where the animation reveals them (as in the preview).
      if (!replayRef.current?.reveal(el))
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      select(el.isConnected ? el : null);
    },
    revealStep: (panel, index) => {
      commitEditing();
      if (modeRef.current !== "edit") switchMode("edit");
      replayRef.current?.revealStep(panel, index);
      select(panel.isConnected ? panel : null);
    },
    isRuntimeNode: (el) => !!hostRef.current?.isRuntimeNode(el),
    animation: (el) => {
      const r = replayRef.current;
      if (!r) return null;
      return { animated: r.isAnimated(el), steps: r.steps(el) };
    },
    moveLayer,
    insertBlock: (h, s) => insertBlock(h, s),
    insertLibrary,
    uploadAsset: () => openUpload("asset"),
    useAsset: placeImage,
    insertSvg: (svg) => insertBlock(svg, false),
  };

  /* ---------------------------------------------------------------- view */

  return (
    <div className="flex h-[calc(100vh-1rem)] min-h-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-background">
      {/* Top bar */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline px-3 py-2">
        <Link to="/dashboard/library" className={TOP_BTN} title="Back to library">
          <ArrowLeft size={14} />
        </Link>
        <div className="mr-2 min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="rounded-md bg-emerald-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
              Studio
            </span>
            <span className="truncate">{host}</span>
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className={`h-1.5 w-1.5 rounded-full ${dirty ? "bg-amber-400" : "bg-emerald-400"}`}
            />
            {busy === "save" ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}
          </p>
        </div>
        <select
          className="h-8 max-w-[180px] rounded-lg border border-border bg-background px-2 text-xs"
          value={route}
          onChange={(e) => void onRouteChange(e.target.value)}
          disabled={loading || !!busy}
          aria-label="Page"
        >
          {routes.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <div
          className="mx-auto flex items-center gap-0.5 rounded-xl border border-border p-0.5"
          role="group"
          aria-label="Device"
        >
          {DEVICES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDevice(id)}
              aria-pressed={device === id}
              className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs transition-colors ${device === id ? "bg-accent text-foreground shadow-[inset_0_0_0_1px_var(--border)]" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={TOP_BTN}
          onClick={undo}
          disabled={loading || !history.undo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          className={TOP_BTN}
          onClick={redo}
          disabled={loading || !history.redo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 size={14} />
        </button>
        <button
          type="button"
          className={TOP_BTN}
          onClick={() => setStyleOpen(true)}
          disabled={loading || !html}
        >
          <Palette size={14} /> Site style
        </button>
        <button
          type="button"
          className={TOP_BTN}
          onClick={() => void openLivePreview()}
          disabled={loading || !html}
        >
          <ExternalLink size={14} /> Live preview
        </button>
        <button type="button" className={TOP_BTN} onClick={exportHtml} disabled={loading || !html}>
          <Download size={14} /> Export HTML
        </button>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-400 px-3 text-xs font-semibold text-black transition-colors hover:bg-emerald-300 disabled:opacity-50"
          onClick={() => void onSave()}
          disabled={loading || busy === "save"}
        >
          <Save size={14} /> {busy === "save" ? "Saving…" : "Save"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onUpload(e.target.files?.[0] || null)}
        />
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_340px]">
        <div className="min-h-0 border-r border-hairline">
          <StudioLeftPanel
            doc={docRef.current}
            sections={sections}
            selected={selectedRef.current}
            version={version + selKey}
            outDir={outDir}
            uploading={busy === "asset"}
            actions={leftActions}
          />
        </div>

        {/* Canvas */}
        <div className="flex min-h-0 flex-col bg-[#101010]">
          <div className="flex shrink-0 items-center gap-2 border-b border-hairline px-3 py-1.5 text-[11px]">
            <div className="flex rounded-lg border border-border p-0.5">
              {(
                [
                  ["edit", "Edit", MousePointer2],
                  ["preview", "Preview", Eye],
                  ["source", "Source", Code2],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => switchMode(id)}
                  className={`flex h-6 items-center gap-1 rounded-md px-2.5 transition-colors ${mode === id ? "bg-emerald-400 font-semibold text-black" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
            <span className="text-muted-foreground">
              {DEVICES.find((d) => d.id === device)!.label} · {deviceWidth}px ·{" "}
              {Math.round(scale * 100)}%
            </span>
            <span className="text-muted-foreground">· {sections.length} sections</span>
            <select
              className="ml-auto h-6 rounded-md border border-border bg-background px-1.5 text-[11px]"
              value={String(zoom)}
              onChange={(e) =>
                setZoom(e.target.value === "fit" ? "fit" : (Number(e.target.value) as Zoom))
              }
              aria-label="Zoom"
            >
              <option value="fit">Fit</option>
              <option value="1">100%</option>
              <option value="0.75">75%</option>
              <option value="0.5">50%</option>
            </select>
          </div>

          <div ref={canvasRef} className="relative min-h-0 flex-1 overflow-auto">
            {loading && (
              <div
                className={`z-20 grid place-items-center text-sm text-muted-foreground ${html ? "absolute inset-0 bg-black/60 backdrop-blur-sm" : "h-full"}`}
              >
                <div className="max-w-sm text-center">
                  <p>Loading editor…</p>
                  {slowLoad && (
                    <p className="mt-2 text-xs opacity-80">
                      First time opening this page: recording its scroll animations so the canvas
                      matches the preview. This takes up to a minute and only happens once.
                    </p>
                  )}
                </div>
              </div>
            )}
            {/* The canvas stays mounted while a page reloads, so the editor never loses its document. */}
            {!html && loading ? null : html ? (
              <div className="flex min-h-full justify-center p-6 pb-14">
                <div
                  className="shrink-0 self-start overflow-hidden rounded-xl border border-white/10 bg-white shadow-2xl shadow-black/50 transition-[width] duration-200"
                  style={{ width: deviceWidth * scale }}
                >
                  <div className="flex h-7 items-center gap-1.5 border-b border-black/10 bg-[#f4f4f5] px-3">
                    <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
                    <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
                    <span className="h-2 w-2 rounded-full bg-[#28c840]" />
                    <span className="mx-auto truncate rounded-md bg-white px-3 py-0.5 text-[10px] text-zinc-500">
                      {host}
                      {route === "/" ? "" : route}
                    </span>
                  </div>
                  <div
                    style={{
                      width: deviceWidth * scale,
                      height: frameHeight * scale,
                      overflow: "hidden",
                    }}
                  >
                    <iframe
                      ref={iframeRef}
                      title={`Edit ${route}`}
                      srcDoc={html}
                      onLoad={onFrameLoad}
                      sandbox="allow-same-origin"
                      className="block border-0 bg-white"
                      style={{
                        width: deviceWidth,
                        height: frameHeight,
                        transform: `scale(${scale})`,
                        transformOrigin: "0 0",
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                No page HTML available.
              </div>
            )}
            {mode === "source" && !loading && html && (
              <div className="absolute inset-0 z-10">
                <SourceView
                  getSource={getSource}
                  canSelection={!!sel}
                  version={version + selKey}
                  onApply={applySource}
                />
              </div>
            )}
            {mode !== "source" && !loading && html && (
              <div className="pointer-events-none sticky bottom-3 flex justify-center">
                <span className="rounded-full border border-white/10 bg-black/80 px-3 py-1 text-[11px] text-white/70 backdrop-blur">
                  {mode === "edit"
                    ? "Click to select · Double-click to write · Drag to move · Arrow keys nudge"
                    : "Preview — hover effects and animations are live. Switch to Edit to change things."}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 border-l border-hairline">
          <StudioInspector
            sel={mode === "edit" ? sel : null}
            studio={mode === "edit" ? studio : null}
            selKey={selKey}
            section={section}
            pageLook={pageLook}
            scope={scope}
            editingText={editingText}
            dirty={dirty}
            uploading={busy === "asset"}
            palette={palette}
            actions={studioActions}
          />
        </div>
      </div>

      <Sheet open={styleOpen} onOpenChange={setStyleOpen}>
        <SheetContent side="top" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Site style</SheetTitle>
            <SheetDescription>
              One click restyles every page of this clone (editor, ZIP, Figma, GitHub).
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <SiteStylePanel
              models={themeModels}
              activeId={themeId}
              pendingId={themePending}
              disabled={loading || !html}
              loadError={themeError}
              onApply={(id) => void onApplyTheme(id)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
