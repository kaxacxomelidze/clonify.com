/**
 * Studio engine — everything the editor adds on top of the cloned page lives in ONE
 * <style id="clonyfy-studio"> element at the end of <body>:
 *   - its `data-model` attribute holds the JSON model (per-device styles, section
 *     designs, motion), and
 *   - its text is the CSS generated from that model.
 * Because it sits inside <body>, undo snapshots (body.innerHTML), Save, and every
 * export (preview, Figma, ZIP, GitHub) carry it automatically. No scripts involved.
 */
import { designCss, type DesignChoice } from "./designs";
import { motionCss, type MotionConfig } from "./motion";

export const STUDIO_STYLE_ID = "clonyfy-studio";
export const ATTR_ID = "data-cfy";
export const ATTR_ROLE = "data-cfy-r";
export const ATTR_LOCK = "data-cfy-lock";
export const ATTR_NAME = "data-cfy-name";

export type Scope = "base" | "tablet" | "mobile";
export const SCOPE_MAX_WIDTH: Record<Exclude<Scope, "base">, number> = {
  tablet: 1024,
  mobile: 640,
};

export type StyleMap = Record<string, string>;
export type StudioModel = {
  v: 1;
  styles: Record<string, Partial<Record<Scope, StyleMap>>>;
  designs: Record<string, DesignChoice>;
  motion: Record<string, MotionConfig>;
};

const emptyModel = (): StudioModel => ({ v: 1, styles: {}, designs: {}, motion: {} });

/* ------------------------------------------------------------------ ids */

export function elementId(el: Element): string | null {
  return el.getAttribute(ATTR_ID);
}

export function ensureId(el: Element): string {
  const existing = el.getAttribute(ATTR_ID);
  if (existing) return existing;
  const doc = el.ownerDocument;
  let id = "";
  do {
    id = Math.random().toString(36).slice(2, 8);
  } while (doc.querySelector(`[${ATTR_ID}="${id}"]`));
  el.setAttribute(ATTR_ID, id);
  return id;
}

const sel = (id: string) => `[${ATTR_ID}="${id}"]`;
/** Triple attribute selector: user edits must out-rank section design rules. */
const strong = (id: string) => sel(id).repeat(3);

/* ---------------------------------------------------------------- model */

function styleNode(doc: Document): HTMLStyleElement | null {
  return doc.getElementById(STUDIO_STYLE_ID) as HTMLStyleElement | null;
}

export function readModel(doc: Document): StudioModel {
  const raw = styleNode(doc)?.getAttribute("data-model");
  if (!raw) return emptyModel();
  try {
    const parsed = JSON.parse(raw) as Partial<StudioModel>;
    return {
      v: 1,
      styles: parsed.styles && typeof parsed.styles === "object" ? parsed.styles : {},
      designs: parsed.designs && typeof parsed.designs === "object" ? parsed.designs : {},
      motion: parsed.motion && typeof parsed.motion === "object" ? parsed.motion : {},
    };
  } catch {
    return emptyModel();
  }
}

/** Drop entries whose element no longer exists (deleted / replaced via undo). */
function prune(doc: Document, model: StudioModel) {
  for (const bucket of [model.styles, model.designs, model.motion] as Array<
    Record<string, unknown>
  >) {
    for (const id of Object.keys(bucket)) {
      if (!doc.querySelector(sel(id))) delete bucket[id];
    }
  }
}

const decl = (map: StyleMap | undefined) =>
  Object.entries(map || {})
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}:${v}!important`)
    .join(";");

export function buildCss(model: StudioModel): string {
  const parts: string[] = [];
  for (const [id, choice] of Object.entries(model.designs)) parts.push(designCss(id, choice));
  const base: string[] = [];
  const tablet: string[] = [];
  const mobile: string[] = [];
  for (const [id, scopes] of Object.entries(model.styles)) {
    if (scopes.base && Object.keys(scopes.base).length)
      base.push(`${strong(id)}{${decl(scopes.base)}}`);
    if (scopes.tablet && Object.keys(scopes.tablet).length)
      tablet.push(`${strong(id)}{${decl(scopes.tablet)}}`);
    if (scopes.mobile && Object.keys(scopes.mobile).length)
      mobile.push(`${strong(id)}{${decl(scopes.mobile)}}`);
  }
  parts.push(...base);
  if (tablet.length)
    parts.push(`@media (max-width:${SCOPE_MAX_WIDTH.tablet}px){${tablet.join("")}}`);
  if (mobile.length)
    parts.push(`@media (max-width:${SCOPE_MAX_WIDTH.mobile}px){${mobile.join("")}}`);
  for (const [id, cfg] of Object.entries(model.motion)) parts.push(motionCss(sel(id), cfg));
  return parts.join("\n");
}

export function writeModel(doc: Document, model: StudioModel) {
  prune(doc, model);
  let node = styleNode(doc);
  const empty =
    !Object.keys(model.styles).length &&
    !Object.keys(model.designs).length &&
    !Object.keys(model.motion).length;
  if (empty) {
    node?.remove();
    return;
  }
  if (!node) {
    node = doc.createElement("style");
    node.id = STUDIO_STYLE_ID;
  }
  // Always last in <body> so studio rules win source-order ties.
  if (node.parentElement !== doc.body || node !== doc.body.lastElementChild)
    doc.body.appendChild(node);
  node.setAttribute("data-model", JSON.stringify(model));
  node.textContent = buildCss(model);
}

/* ------------------------------------------------------- scoped styles */

/**
 * Set (or clear with "") CSS properties on an element for a device scope.
 * Base edits stay inline (as before) unless the property also has device
 * overrides — inline !important would beat any media query, so such properties
 * move into the studio stylesheet.
 */
export function setScopedStyles(el: HTMLElement, scope: Scope, props: StyleMap) {
  const doc = el.ownerDocument;
  const model = readModel(doc);
  const id = ensureId(el);
  const hadEntry = !!model.styles[id];
  const entry = (model.styles[id] ||= {});
  let touchedModel = false;

  for (const [prop, value] of Object.entries(props)) {
    const hasOverrides = !!(entry.tablet?.[prop] || entry.mobile?.[prop]);
    if (scope === "base" && !hasOverrides && entry.base?.[prop] === undefined) {
      if (value === "") el.style.removeProperty(prop);
      else el.style.setProperty(prop, value, "important");
      continue;
    }
    touchedModel = true;
    // The inline value becomes the base rule, so device rules can override it.
    const inline = el.style.getPropertyValue(prop);
    if (inline) {
      (entry.base ||= {})[prop] = inline;
      el.style.removeProperty(prop);
    }
    const bucket = (entry[scope] ||= {});
    if (value === "") delete bucket[prop];
    else bucket[prop] = value;
  }

  for (const s of ["base", "tablet", "mobile"] as Scope[]) {
    if (entry[s] && !Object.keys(entry[s]!).length) delete entry[s];
  }
  if (!Object.keys(entry).length) delete model.styles[id];
  // Plain inline edits (the common case, e.g. every step of a drag) leave the
  // stylesheet alone; it is rewritten only when the model actually changed.
  if (touchedModel || (hadEntry && model.styles[id] === undefined)) writeModel(doc, model);
}

/** Declared value of a property for a scope (device rule → base rule → inline). */
export function declaredStyle(el: HTMLElement, scope: Scope, prop: string): string {
  const id = elementId(el);
  const entry = id ? readModel(el.ownerDocument).styles[id] : undefined;
  if (scope === "mobile" && entry?.mobile?.[prop]) return entry.mobile[prop]!;
  if (scope !== "base" && entry?.tablet?.[prop]) return entry.tablet[prop]!;
  return entry?.base?.[prop] || el.style.getPropertyValue(prop) || "";
}

export function hasDeviceOverrides(el: HTMLElement): boolean {
  const id = elementId(el);
  if (!id) return false;
  const entry = readModel(el.ownerDocument).styles[id];
  return !!(entry?.tablet || entry?.mobile);
}

/** Remove every studio style, design and motion for an element (not its subtree). */
export function clearStudioFor(el: HTMLElement) {
  const id = elementId(el);
  if (!id) return;
  const doc = el.ownerDocument;
  const model = readModel(doc);
  delete model.styles[id];
  delete model.motion[id];
  writeModel(doc, model);
}

/* ------------------------------------------------------- design / motion */

export function setDesign(section: HTMLElement, choice: DesignChoice | null) {
  const doc = section.ownerDocument;
  const model = readModel(doc);
  const id = ensureId(section);
  if (choice) model.designs[id] = choice;
  else delete model.designs[id];
  writeModel(doc, model);
}

export function getDesign(section: HTMLElement): DesignChoice | null {
  const id = elementId(section);
  return id ? readModel(section.ownerDocument).designs[id] || null : null;
}

export function setMotion(el: HTMLElement, cfg: MotionConfig | null) {
  const doc = el.ownerDocument;
  const model = readModel(doc);
  const id = ensureId(el);
  if (cfg) model.motion[id] = cfg;
  else delete model.motion[id];
  writeModel(doc, model);
}

export function getMotion(el: HTMLElement): MotionConfig | null {
  const id = elementId(el);
  return id ? readModel(el.ownerDocument).motion[id] || null : null;
}

/* ------------------------------------------------------------- fragments */

/** Model entries that belong to elements inside `root` (for Library copies). */
export function modelFragment(root: HTMLElement): StudioModel {
  const model = readModel(root.ownerDocument);
  const ids = new Set<string>();
  for (const el of [root, ...Array.from(root.querySelectorAll(`[${ATTR_ID}]`))]) {
    const id = el.getAttribute(ATTR_ID);
    if (id) ids.add(id);
  }
  const pick = <T>(bucket: Record<string, T>) =>
    Object.fromEntries(Object.entries(bucket).filter(([id]) => ids.has(id)));
  return {
    v: 1,
    styles: pick(model.styles),
    designs: pick(model.designs),
    motion: pick(model.motion),
  };
}

/**
 * Give every studio id inside freshly inserted nodes a new unique id, and merge the
 * matching model entries (from a Library item or a duplicate) under the new ids.
 */
export function adoptFragment(nodes: HTMLElement[], fragment: StudioModel | null) {
  const doc = nodes[0]?.ownerDocument;
  if (!doc) return;
  const model = readModel(doc);
  for (const node of nodes) {
    for (const el of [node, ...Array.from(node.querySelectorAll(`[${ATTR_ID}]`))]) {
      const oldId = el.getAttribute(ATTR_ID);
      if (!oldId) continue;
      el.removeAttribute(ATTR_ID);
      const newId = ensureId(el);
      const src = fragment || model;
      const style = src.styles[oldId];
      const design = src.designs[oldId];
      const motion = src.motion[oldId];
      if (style)
        model.styles[newId] = JSON.parse(JSON.stringify(style)) as StudioModel["styles"][string];
      if (design) model.designs[newId] = { ...design };
      if (motion) model.motion[newId] = { ...motion };
    }
  }
  writeModel(doc, model);
}

/* ---------------------------------------------------------------- lock */

export function lockedAncestor(el: Element | null): HTMLElement | null {
  return (el?.closest(`[${ATTR_LOCK}]`) as HTMLElement | null) || null;
}
