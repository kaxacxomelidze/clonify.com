/** DOM helpers for the visual editor iframe (no React). */

export const EDITOR_STYLE_ID = "clonyfy-editor-style";
export const ATTR_HOVER = "data-clonyfy-editor-hover";
export const ATTR_SELECTED = "data-clonyfy-editor-selected";
export const ATTR_EDITING = "data-clonyfy-editor-editing";

const EDITOR_CSS = `
[${ATTR_HOVER}]{outline:2px dashed rgba(91,141,239,.85)!important;outline-offset:1px!important;cursor:pointer!important}
[${ATTR_SELECTED}]{outline:2px solid #5b8def!important;outline-offset:2px!important;cursor:text!important}
[${ATTR_EDITING}]{outline:2px solid #22c55e!important;outline-offset:2px!important;cursor:text!important;-webkit-user-modify:read-write!important}
[${ATTR_EDITING}],[${ATTR_EDITING}] *{
  cursor:text!important;
  user-select:text!important;
  -webkit-user-select:text!important;
  -webkit-user-modify:read-write!important;
}
html{scroll-behavior:auto!important}
`;

const MEDIA_SELECTOR =
  "img,svg,video,picture,canvas,iframe,input,select,textarea,object,embed,audio,hr";
const NEVER_PRUNE = /^(HTML|BODY|MAIN|HEADER|FOOTER|NAV|FORM|TABLE|THEAD|TBODY|TFOOT|TR)$/;
const NOT_SELECTABLE = /^(HTML|HEAD|BODY|SCRIPT|STYLE|LINK|META|NOSCRIPT|TEMPLATE|BR)$/;
const INLINE_TEXT_TAGS =
  /^(SPAN|B|STRONG|I|EM|U|S|SMALL|MARK|CODE|SUP|SUB|A|ABBR|CITE|Q|TIME|LABEL|BR|FONT|DEL|INS|KBD)$/;

export function installEditorChrome(doc: Document) {
  doc.body?.removeAttribute("contenteditable");
  doc.getElementById(EDITOR_STYLE_ID)?.remove();
  const style = doc.createElement("style");
  style.id = EDITOR_STYLE_ID;
  style.textContent = EDITOR_CSS;
  (doc.head || doc.documentElement).appendChild(style);
}

export function clearEditorAttrs(
  root: ParentNode,
  attrs = [ATTR_HOVER, ATTR_SELECTED, ATTR_EDITING],
) {
  for (const attr of attrs) {
    root.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr));
  }
}

/** Serialize the document without editor-only attributes / styles. */
export function htmlForSave(doc: Document): string {
  const clone = doc.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelector(`#${EDITOR_STYLE_ID}`)?.remove();
  clearEditorAttrs(clone);
  clone
    .querySelectorAll("[contenteditable]")
    .forEach((el) => el.removeAttribute("contenteditable"));
  stripThemeOutput(clone);
  return "<!DOCTYPE html>\n" + clone.outerHTML;
}

/** Theme engine output is regenerated from theme.json; never persist it. */
export function stripThemeOutput(root: Element) {
  root
    .querySelectorAll(
      "#__clonyfy_theme_style__, #__clonyfy_theme_font__, #__clonyfy_theme_freeze__",
    )
    .forEach((el) => el.remove());
  root.querySelectorAll("[data-cth]").forEach((el) => el.removeAttribute("data-cth"));
  root.removeAttribute("data-cth");
  root.removeAttribute("data-cth-theme");
}

export function isSelectable(el: Element | null): el is HTMLElement {
  if (!el || el.nodeType !== 1) return false;
  return !NOT_SELECTABLE.test(el.tagName.toUpperCase());
}

/**
 * Clicks on SVG internals select the whole <svg>.
 * Uses nodeType, not `instanceof Element`: iframe nodes belong to the frame's
 * realm, so the parent window's Element constructor never matches them.
 */
export function selectableTarget(node: EventTarget | null): HTMLElement | null {
  const n = node as Node | null;
  if (!n || typeof n.nodeType !== "number") return null;
  let el: Element | null = n.nodeType === 1 ? (n as Element) : n.parentElement;
  if (!el) return null;
  const svg = el.closest("svg");
  if (svg) el = svg;
  while (el && !isSelectable(el)) el = el.parentElement;
  return (el as HTMLElement) || null;
}

function visibleText(el: Element) {
  return (el.textContent || "").replace(/[\s\u00a0\u200b-\u200d\ufeff]/g, "");
}

/** No readable text and no media — nothing left for the user to see except styling. */
export function isEffectivelyEmpty(el: Element) {
  if (el.matches(MEDIA_SELECTOR) || el.querySelector(MEDIA_SELECTOR)) return false;
  return visibleText(el) === "";
}

function hasOwnVisual(el: Element) {
  const view = el.ownerDocument.defaultView;
  if (!view) return false;
  const cs = view.getComputedStyle(el);
  return !!cs.backgroundImage && cs.backgroundImage !== "none";
}

/**
 * Remove an element and any wrapper that only existed to hold it
 * (so its shadow / background / padding disappears with the content).
 */
export function removeWithEmptyAncestors(el: Element) {
  let parent = el.parentElement;
  el.remove();
  for (let depth = 0; parent && depth < 6; depth++) {
    if (NEVER_PRUNE.test(parent.tagName.toUpperCase())) break;
    if (!isEffectivelyEmpty(parent) || hasOwnVisual(parent)) break;
    const next: HTMLElement | null = parent.parentElement;
    parent.remove();
    parent = next;
  }
}

/** Drop empty inline wrappers left behind after deleting part of a text block. */
export function pruneEmptyDescendants(root: Element) {
  const all = Array.from(root.querySelectorAll("*")).reverse();
  for (const el of all) {
    if (el.tagName === "BR") continue;
    if (!el.isConnected) continue;
    if (isEffectivelyEmpty(el) && !hasOwnVisual(el)) el.remove();
  }
}

export function canEditText(el: Element) {
  if (el.matches(MEDIA_SELECTOR) || el.closest("svg")) return false;
  if (visibleText(el) === "") return false;
  const hasDirectText = Array.from(el.childNodes).some(
    (n) => n.nodeType === 3 && (n.textContent || "").trim() !== "",
  );
  if (hasDirectText) return true;
  // Wrapper of inline formatting only (e.g. <a><span>Label</span></a>).
  return Array.from(el.querySelectorAll("*")).every((c) =>
    INLINE_TEXT_TAGS.test(c.tagName.toUpperCase()),
  );
}

/** Nearest element (self or descendant under the pointer) that holds editable text. */
export function textTargetFor(el: HTMLElement): HTMLElement | null {
  if (canEditText(el)) return el;
  const text = Array.from(el.querySelectorAll<HTMLElement>("*")).find((c) => canEditText(c));
  return text || null;
}

export function placeCaretAtPoint(doc: Document, x: number, y: number, fallback: HTMLElement) {
  const sel = doc.getSelection();
  if (!sel) return;
  let range: Range | null = null;
  const anyDoc = doc as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (anyDoc.caretRangeFromPoint) range = anyDoc.caretRangeFromPoint(x, y);
  else if (anyDoc.caretPositionFromPoint) {
    const pos = anyDoc.caretPositionFromPoint(x, y);
    if (pos) {
      range = doc.createRange();
      range.setStart(pos.offsetNode, pos.offset);
    }
  }
  if (!range || !fallback.contains(range.startContainer)) {
    range = doc.createRange();
    range.selectNodeContents(fallback);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

export function insertPlainText(doc: Document, text: string) {
  if (doc.execCommand && doc.execCommand("insertText", false, text)) return;
  const sel = doc.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = doc.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function toHex(color: string) {
  const m = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/i);
  if (!m) return { hex: "#000000", transparent: true };
  const alpha = m[4] === undefined ? 1 : Number(m[4]);
  const hex = "#" + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("");
  return { hex, transparent: alpha === 0 };
}

export type ElementKind =
  | "heading"
  | "text"
  | "link"
  | "button"
  | "image"
  | "icon"
  | "media"
  | "list"
  | "field"
  | "section"
  | "container";

const KIND_LABEL: Record<ElementKind, string> = {
  heading: "Heading",
  text: "Text",
  link: "Link",
  button: "Button",
  image: "Image",
  icon: "Icon",
  media: "Media",
  list: "List",
  field: "Form field",
  section: "Section",
  container: "Container",
};

export function elementKind(el: Element): ElementKind {
  const tag = el.tagName.toUpperCase();
  if (/^H[1-6]$/.test(tag)) return "heading";
  if (tag === "IMG" || tag === "PICTURE") return "image";
  if (tag === "SVG") return "icon";
  if (/^(VIDEO|CANVAS|IFRAME|AUDIO|OBJECT|EMBED)$/.test(tag)) return "media";
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag)) return "field";
  if (tag === "BUTTON" || el.getAttribute("role") === "button") return "button";
  if (tag === "A") {
    const cls = String(el.getAttribute("class") || "");
    return /\b(btn|button|cta)\b/i.test(cls) ? "button" : "link";
  }
  if (/^(UL|OL|DL)$/.test(tag)) return "list";
  if (/^(SECTION|HEADER|FOOTER|NAV|MAIN|ARTICLE|ASIDE)$/.test(tag)) return "section";
  if (canEditText(el)) return "text";
  return "container";
}

/** Human label for an element: landmark name, heading text, aria-label, or class hint. */
export function friendlyName(el: Element): string {
  const tag = el.tagName.toUpperCase();
  const landmark: Record<string, string> = {
    HEADER: "Header",
    NAV: "Navigation",
    FOOTER: "Footer",
    MAIN: "Main",
    ASIDE: "Sidebar",
    FORM: "Form",
  };
  if (landmark[tag]) return landmark[tag];
  const aria = el.getAttribute("aria-label");
  if (aria?.trim()) return aria.trim().slice(0, 48);
  const heading = el.matches("h1,h2,h3,h4") ? el : el.querySelector("h1,h2,h3,h4");
  const headingText = (heading?.textContent || "").replace(/\s+/g, " ").trim();
  if (headingText) return headingText.slice(0, 48);
  const cls = String(el.getAttribute("class") || "")
    .split(/\s+/)
    .map((c) => c.replace(/__[A-Za-z0-9_-]{4,}$/, "").replace(/[_-][a-z0-9]{5,}$/i, ""))
    .find(
      (c) =>
        /^[a-z][\w-]{2,}$/i.test(c) && !/^(w|h|p|m|flex|grid|col|row|container|wrapper)$/i.test(c),
    );
  if (cls) {
    const words = cls
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .trim();
    return words.charAt(0).toUpperCase() + words.slice(1, 48);
  }
  return KIND_LABEL[elementKind(el)];
}

export type SelectionInfo = {
  tag: string;
  kind: ElementKind;
  kindLabel: string;
  name: string;
  path: string[];
  label: string;
  isImage: boolean;
  isSvg: boolean;
  canEditText: boolean;
  /** Text when the element holds plain text only (safe to edit in a textarea). */
  plainText: string | null;
  href: string | null;
  linkNewTab: boolean;
  alt: string;
  imageSrc: string;
  objectFit: string;
  hasBackgroundImage: boolean;
  color: string;
  backgroundColor: string;
  backgroundTransparent: boolean;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  textTransform: string;
  underline: boolean;
  bold: boolean;
  italic: boolean;
  textAlign: string;
  opacity: number;
  padding: { top: number; right: number; bottom: number; left: number };
  margin: { top: number; bottom: number };
  radius: number;
  borderWidth: number;
  borderColor: string;
  boxShadow: string;
  hasShadow: boolean;
  hidden: boolean;
  hasInlineEdits: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  hasParent: boolean;
  similarCount: number;
};

export const ATTR_HIDDEN = "data-clonyfy-hidden";

const px = (v: string) => Math.round((parseFloat(v) || 0) * 10) / 10;

/** Elements that look like this one (same tag + same class list) — for "apply to all similar". */
export function similarElements(el: Element): Element[] {
  const doc = el.ownerDocument;
  const cls = String(el.getAttribute("class") || "").trim();
  const tag = el.tagName.toLowerCase();
  let list: Element[];
  try {
    list = cls
      ? Array.from(doc.getElementsByClassName(cls)).filter((x) => x.tagName.toLowerCase() === tag)
      : Array.from(doc.getElementsByTagName(tag)).filter((x) => !x.getAttribute("class"));
  } catch {
    list = [el];
  }
  return list.filter((x) => String(x.getAttribute("class") || "").trim() === cls);
}

export function describeElement(el: HTMLElement, hasInlineEdits: boolean): SelectionInfo {
  const view = el.ownerDocument.defaultView!;
  const cs = view.getComputedStyle(el);
  const path: string[] = [];
  for (
    let x: Element | null = el;
    x && x.tagName !== "BODY" && path.length < 5;
    x = x.parentElement
  ) {
    path.unshift(x.tagName.toLowerCase());
  }
  const link = el.closest("a");
  const bg = toHex(cs.backgroundColor);
  const shadowFilter = /drop-shadow/i.test(cs.filter || "");
  const text = (el.textContent || "").replace(/\s+/g, " ").trim();
  const fontSize = parseFloat(cs.fontSize) || 16;
  const lh =
    cs.lineHeight === "normal" ? 1.2 : (parseFloat(cs.lineHeight) || fontSize * 1.2) / fontSize;
  const kind = elementKind(el);
  const plainOnly =
    el.children.length === 0 && !el.matches(MEDIA_SELECTOR) && visibleText(el) !== "";
  return {
    tag: el.tagName.toLowerCase(),
    kind,
    kindLabel: KIND_LABEL[kind],
    name: friendlyName(el),
    path,
    label: text.slice(0, 80),
    isImage: el.tagName === "IMG",
    isSvg: el.tagName.toLowerCase() === "svg",
    canEditText: canEditText(el) || !!textTargetFor(el),
    plainText: plainOnly ? el.textContent || "" : null,
    href: link ? link.getAttribute("href") || "" : null,
    linkNewTab: link?.getAttribute("target") === "_blank",
    alt: el.tagName === "IMG" ? el.getAttribute("alt") || "" : "",
    imageSrc:
      el.tagName === "IMG"
        ? (el as HTMLImageElement).currentSrc || el.getAttribute("src") || ""
        : "",
    objectFit: cs.objectFit || "fill",
    hasBackgroundImage: !!cs.backgroundImage && cs.backgroundImage !== "none",
    color: toHex(cs.color).hex,
    backgroundColor: bg.hex,
    backgroundTransparent: bg.transparent,
    fontFamily: (cs.fontFamily.split(",")[0] || "").replace(/["']/g, "").trim(),
    fontSize: Math.round(fontSize),
    fontWeight: parseInt(cs.fontWeight, 10) || 400,
    lineHeight: Math.round(lh * 100) / 100,
    letterSpacing: cs.letterSpacing === "normal" ? 0 : px(cs.letterSpacing),
    textTransform: cs.textTransform || "none",
    underline: /underline/.test(cs.textDecorationLine || cs.textDecoration || ""),
    bold: (parseInt(cs.fontWeight, 10) || 400) >= 600,
    italic: cs.fontStyle === "italic",
    textAlign: cs.textAlign,
    opacity: Math.round((parseFloat(cs.opacity) || 0) * 100),
    padding: {
      top: px(cs.paddingTop),
      right: px(cs.paddingRight),
      bottom: px(cs.paddingBottom),
      left: px(cs.paddingLeft),
    },
    margin: { top: px(cs.marginTop), bottom: px(cs.marginBottom) },
    radius: px(cs.borderTopLeftRadius),
    borderWidth: px(cs.borderTopWidth),
    borderColor: toHex(cs.borderTopColor).hex,
    boxShadow: cs.boxShadow || "none",
    hasShadow:
      (!!cs.textShadow && cs.textShadow !== "none") ||
      (!!cs.boxShadow && cs.boxShadow !== "none") ||
      shadowFilter,
    hidden: el.hasAttribute(ATTR_HIDDEN),
    hasInlineEdits,
    canMoveUp: !!el.previousElementSibling,
    canMoveDown: !!el.nextElementSibling,
    hasParent:
      !!el.parentElement &&
      el.parentElement.tagName !== "BODY" &&
      el.parentElement.tagName !== "HTML",
    similarCount: similarElements(el).length,
  };
}

/* --------------------------------------------------------------- sections */

export type PageSection = {
  el: HTMLElement;
  name: string;
  kind: ElementKind;
  hidden: boolean;
  depth: number;
};

function isRendered(el: Element) {
  if (el.hasAttribute(ATTR_HIDDEN)) return true; // hidden by the user — still listed
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.height > 4;
}

/**
 * Top-level page blocks for the Layers list. Framework wrappers (#__next > div > …)
 * are unwrapped until a container with several rendered children is reached;
 * <main> is expanded one level so its sections appear individually.
 */
export function listSections(doc: Document): PageSection[] {
  const body = doc.body;
  if (!body) return [];
  const rendered = (parent: Element) =>
    Array.from(parent.children).filter(
      (c) =>
        isSelectable(c) && !c.matches("script,style,link,meta,noscript,template") && isRendered(c),
    ) as HTMLElement[];

  let root: Element = body;
  for (let i = 0; i < 6; i++) {
    const kids = rendered(root);
    const only = kids.length === 1 ? kids[0] : undefined;
    if (!only || /^(HEADER|NAV|FOOTER)$/.test(only.tagName)) break;
    root = only;
  }

  const out: PageSection[] = [];
  for (const el of rendered(root)) {
    const children = el.tagName === "MAIN" ? rendered(el) : [];
    if (children.length > 1) {
      for (const child of children) {
        out.push({
          el: child,
          name: friendlyName(child),
          kind: elementKind(child),
          hidden: child.hasAttribute(ATTR_HIDDEN),
          depth: 1,
        });
      }
    } else {
      out.push({
        el,
        name: friendlyName(el),
        kind: elementKind(el),
        hidden: el.hasAttribute(ATTR_HIDDEN),
        depth: 0,
      });
    }
    if (out.length >= 80) break;
  }
  return out;
}

/* ---------------------------------------------------------------- palette */

/** Most-used solid colors on the page (text + fills), for one-click swatches. */
export function collectPalette(doc: Document, limit = 12): string[] {
  const view = doc.defaultView;
  if (!view || !doc.body) return [];
  const counts = new Map<string, number>();
  const nodes = doc.body.querySelectorAll("*");
  const max = Math.min(nodes.length, 4000);
  for (let i = 0; i < max; i++) {
    const node = nodes[i];
    if (!node) continue;
    const cs = view.getComputedStyle(node);
    for (const value of [cs.color, cs.backgroundColor]) {
      const c = toHex(value);
      if (c.transparent) continue;
      counts.set(c.hex, (counts.get(c.hex) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([hex]) => hex);
}

/* ------------------------------------------------------------------ fonts */

export const FONT_LIBRARY: Array<{ group: string; families: string[] }> = [
  {
    group: "Sans serif",
    families: [
      "Inter",
      "DM Sans",
      "Manrope",
      "Plus Jakarta Sans",
      "Outfit",
      "Sora",
      "Space Grotesk",
      "Poppins",
      "Montserrat",
    ],
  },
  {
    group: "Serif",
    families: [
      "Playfair Display",
      "Fraunces",
      "Lora",
      "DM Serif Display",
      "Cormorant Garamond",
      "Libre Baskerville",
    ],
  },
  { group: "Mono", families: ["JetBrains Mono", "IBM Plex Mono", "Space Mono"] },
];

const SERIF = new Set(FONT_LIBRARY.find((g) => g.group === "Serif")?.families ?? []);
const MONO = new Set(FONT_LIBRARY.find((g) => g.group === "Mono")?.families ?? []);

export function fontStack(family: string) {
  const fallback = SERIF.has(family)
    ? "Georgia, serif"
    : MONO.has(family)
      ? "ui-monospace, monospace"
      : "system-ui, sans-serif";
  return `"${family}", ${fallback}`;
}

/** Load a Google font into the edited page; the <link> is saved with the page. */
export function ensureFontLoaded(doc: Document, family: string) {
  const id = `clonyfy-font-${family.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  if (doc.getElementById(id)) return;
  const link = doc.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap`;
  link.setAttribute("data-clonyfy-font", family);
  (doc.head || doc.documentElement).appendChild(link);
}

export const SHADOW_PRESETS: Array<{ id: string; label: string; value: string }> = [
  { id: "none", label: "None", value: "none" },
  { id: "soft", label: "Soft", value: "0 1px 2px rgba(0,0,0,.06), 0 4px 14px rgba(0,0,0,.08)" },
  { id: "medium", label: "Medium", value: "0 10px 28px -6px rgba(0,0,0,.22)" },
  { id: "lifted", label: "Lifted", value: "0 28px 56px -16px rgba(0,0,0,.38)" },
];
