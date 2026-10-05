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
  return "<!DOCTYPE html>\n" + clone.outerHTML;
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

export type SelectionInfo = {
  tag: string;
  path: string[];
  label: string;
  isImage: boolean;
  isSvg: boolean;
  canEditText: boolean;
  href: string | null;
  alt: string;
  hasBackgroundImage: boolean;
  color: string;
  backgroundColor: string;
  backgroundTransparent: boolean;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  textAlign: string;
  hasShadow: boolean;
  hasInlineEdits: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  hasParent: boolean;
};

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
  return {
    tag: el.tagName.toLowerCase(),
    path,
    label: text.slice(0, 80),
    isImage: el.tagName === "IMG",
    isSvg: el.tagName.toLowerCase() === "svg",
    canEditText: canEditText(el) || !!textTargetFor(el),
    href: link ? link.getAttribute("href") || "" : null,
    alt: el.tagName === "IMG" ? el.getAttribute("alt") || "" : "",
    hasBackgroundImage: !!cs.backgroundImage && cs.backgroundImage !== "none",
    color: toHex(cs.color).hex,
    backgroundColor: bg.hex,
    backgroundTransparent: bg.transparent,
    fontSize: Math.round(parseFloat(cs.fontSize) || 16),
    bold: (parseInt(cs.fontWeight, 10) || 400) >= 600,
    italic: cs.fontStyle === "italic",
    textAlign: cs.textAlign,
    hasShadow:
      (!!cs.textShadow && cs.textShadow !== "none") ||
      (!!cs.boxShadow && cs.boxShadow !== "none") ||
      shadowFilter,
    hasInlineEdits,
    canMoveUp: !!el.previousElementSibling,
    canMoveDown: !!el.nextElementSibling,
    hasParent:
      !!el.parentElement &&
      el.parentElement.tagName !== "BODY" &&
      el.parentElement.tagName !== "HTML",
  };
}
