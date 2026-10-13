/** Extra selection details for the Studio inspector (layout, sizing, position, effects). */
import {
  ATTR_LOCK,
  ATTR_NAME,
  declaredStyle,
  getMotion,
  hasDeviceOverrides,
  type Scope,
} from "./engine";
import type { MotionConfig } from "./motion";

export type Box4 = { top: number; right: number; bottom: number; left: number };

export type StudioInfo = {
  scope: Scope;
  locked: boolean;
  lockedBy: boolean;
  customName: string;
  display: string;
  flexDirection: string;
  alignItems: string;
  justifyContent: string;
  flexWrap: string;
  gap: number;
  gridColumns: number;
  width: string;
  height: string;
  maxWidth: string;
  computedWidth: number;
  computedHeight: number;
  padding: Box4;
  margin: Box4;
  position: string;
  top: string;
  left: string;
  zIndex: string;
  overflow: string;
  rotate: number;
  scale: number;
  translate: { x: number; y: number };
  blur: number;
  brightness: number;
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
  motion: MotionConfig | null;
  hasDeviceOverrides: boolean;
};

const num = (v: string) => Math.round((parseFloat(v) || 0) * 10) / 10;

function trackCount(template: string) {
  if (!template || template === "none") return 0;
  return template.trim().split(/\s+(?![^(]*\))/).length;
}

export function describeStudio(el: HTMLElement, scope: Scope): StudioInfo {
  const cs = el.ownerDocument.defaultView!.getComputedStyle(el);
  const d = (prop: string) => declaredStyle(el, scope, prop);
  const rect = el.getBoundingClientRect();
  const filter = d("filter");
  const blur = filter.match(/blur\(([\d.]+)px\)/);
  const bright = filter.match(/brightness\(([\d.]+)%?\)/);
  const tr = (d("translate") || "").trim().split(/\s+/);
  return {
    scope,
    locked: el.hasAttribute(ATTR_LOCK),
    lockedBy: !el.hasAttribute(ATTR_LOCK) && !!el.parentElement?.closest(`[${ATTR_LOCK}]`),
    customName: el.getAttribute(ATTR_NAME) || "",
    display: cs.display,
    flexDirection: cs.flexDirection,
    alignItems: cs.alignItems,
    justifyContent: cs.justifyContent,
    flexWrap: cs.flexWrap,
    gap: num(cs.columnGap === "normal" ? "0" : cs.columnGap),
    gridColumns: trackCount(cs.gridTemplateColumns),
    width: d("width"),
    height: d("height"),
    maxWidth: d("max-width"),
    computedWidth: Math.round(rect.width),
    computedHeight: Math.round(rect.height),
    padding: {
      top: num(cs.paddingTop),
      right: num(cs.paddingRight),
      bottom: num(cs.paddingBottom),
      left: num(cs.paddingLeft),
    },
    margin: {
      top: num(cs.marginTop),
      right: num(cs.marginRight),
      bottom: num(cs.marginBottom),
      left: num(cs.marginLeft),
    },
    position: cs.position,
    top: d("top"),
    left: d("left"),
    zIndex: d("z-index") || (cs.zIndex === "auto" ? "" : cs.zIndex),
    overflow: cs.overflow.split(" ")[0] || "visible",
    rotate: num((d("rotate") || "0").replace("deg", "")),
    scale: parseFloat(d("scale") || "1") || 1,
    translate: { x: num(tr[0] || "0"), y: num(tr[1] || "0") },
    blur: blur ? num(blur[1]!) : 0,
    brightness: bright ? num(bright[1]!) : 100,
    backgroundImage: cs.backgroundImage === "none" ? "" : cs.backgroundImage,
    backgroundSize: cs.backgroundSize,
    backgroundPosition: cs.backgroundPosition,
    motion: getMotion(el),
    hasDeviceOverrides: hasDeviceOverrides(el),
  };
}
