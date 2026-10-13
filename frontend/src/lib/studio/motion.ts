/**
 * Per-element motion, compiled to plain CSS (no scripts): it survives Save, the
 * script-free editor, previews and every export. Scroll triggers use CSS scroll-driven
 * animations where supported and fall back to playing on load. Reduced-motion
 * preferences switch everything off.
 */

export type MotionEffect =
  "fade" | "rise" | "scale" | "slide" | "float" | "tilt" | "pulse" | "parallax" | "blur" | "spin";
export type MotionTrigger = "load" | "hover" | "scroll";

export type MotionConfig = {
  effect: MotionEffect;
  trigger: MotionTrigger;
  duration: number;
  delay: number;
  easing: string;
  repeat: "once" | "loop";
};

export const MOTION_EFFECTS: Array<{ id: MotionEffect; name: string; note: string }> = [
  { id: "fade", name: "Fade in", note: "Opacity from 0" },
  { id: "rise", name: "Rise up", note: "Slides up while fading" },
  { id: "scale", name: "Soft scale", note: "Grows from 92%" },
  { id: "slide", name: "Slide across", note: "Enters from the left" },
  { id: "blur", name: "Blur in", note: "Sharpens into focus" },
  { id: "tilt", name: "3D tilt", note: "Tips up in perspective" },
  { id: "float", name: "Gentle float", note: "Bobs up and down" },
  { id: "pulse", name: "Pulse", note: "Breathes in scale" },
  { id: "spin", name: "Slow spin", note: "Continuous rotation" },
  { id: "parallax", name: "Scroll parallax", note: "Moves with scroll depth" },
];

export const MOTION_EASINGS: Array<{ id: string; name: string }> = [
  { id: "cubic-bezier(.22,1,.36,1)", name: "Ease out" },
  { id: "cubic-bezier(.65,0,.35,1)", name: "Ease in / out" },
  { id: "cubic-bezier(.55,0,1,.45)", name: "Ease in" },
  { id: "linear", name: "Linear" },
  { id: "ease", name: "Ease" },
  { id: "cubic-bezier(.34,1.56,.64,1)", name: "Spring" },
];

export const DEFAULT_MOTION: MotionConfig = {
  effect: "rise",
  trigger: "scroll",
  duration: 0.8,
  delay: 0,
  easing: "cubic-bezier(.22,1,.36,1)",
  repeat: "once",
};

/** Effects that are continuous by nature. */
const LOOPING = new Set<MotionEffect>(["float", "pulse", "spin"]);

const KEYFRAMES: Record<MotionEffect, string> = {
  fade: "from{opacity:0}to{opacity:1}",
  rise: "from{opacity:0;transform:translate3d(0,36px,0)}to{opacity:1;transform:none}",
  scale: "from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}",
  slide: "from{opacity:0;transform:translate3d(-48px,0,0)}to{opacity:1;transform:none}",
  blur: "from{opacity:0;filter:blur(14px)}to{opacity:1;filter:none}",
  tilt: "from{opacity:0;transform:perspective(900px) rotateX(22deg) translate3d(0,28px,0)}to{opacity:1;transform:none}",
  float: "0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-12px,0)}",
  pulse: "0%,100%{transform:scale(1)}50%{transform:scale(1.05)}",
  spin: "from{transform:rotate(0)}to{transform:rotate(360deg)}",
  parallax: "from{transform:translate3d(0,60px,0)}to{transform:translate3d(0,-60px,0)}",
};

const HOVER: Record<MotionEffect, string> = {
  fade: "opacity:.72",
  rise: "transform:translate3d(0,-6px,0)",
  scale: "transform:scale(1.04)",
  slide: "transform:translate3d(6px,0,0)",
  blur: "filter:blur(2px)",
  tilt: "transform:perspective(800px) rotateX(6deg) rotateY(-8deg)",
  float: "transform:translate3d(0,-8px,0)",
  pulse: "transform:scale(1.06)",
  spin: "transform:rotate(8deg)",
  parallax: "transform:translate3d(0,-6px,0)",
};

export function keyframesName(effect: MotionEffect) {
  return `cfy-${effect}`;
}

export function motionCss(selector: string, cfg: MotionConfig): string {
  const name = keyframesName(cfg.effect);
  const kf = `@keyframes ${name}{${KEYFRAMES[cfg.effect]}}`;
  const loop = LOOPING.has(cfg.effect) || cfg.repeat === "loop";
  const iter = loop ? "infinite" : "1";
  // Continuous effects have seamless keyframes; looped entrances play back and forth.
  const dir = LOOPING.has(cfg.effect) ? "normal" : loop ? "alternate" : "normal";
  const ease = cfg.effect === "spin" ? "linear" : cfg.easing;
  const timed = `animation:${name} ${cfg.duration}s ${ease} ${cfg.delay}s ${iter} ${dir} both!important`;
  const reduced = `@media (prefers-reduced-motion:reduce){${selector}{animation:none!important;transition:none!important}}`;

  let rules = "";
  if (cfg.trigger === "hover") {
    rules = `${selector}{transition:transform ${cfg.duration}s ${cfg.easing},opacity ${cfg.duration}s ${cfg.easing},filter ${cfg.duration}s ${cfg.easing}!important}${selector}:hover{${HOVER[cfg.effect]}!important}`;
    return kf + rules + reduced;
  }
  if (cfg.effect === "parallax") {
    rules = `@supports (animation-timeline:view()){${selector}{animation:${name} linear both!important;animation-timeline:view()!important;animation-range:cover 0% cover 100%!important}}`;
    return kf + rules + reduced;
  }
  rules = `${selector}{${timed}}`;
  if (cfg.trigger === "scroll" && !LOOPING.has(cfg.effect)) {
    rules += `@supports (animation-timeline:view()){${selector}{animation:${name} ${ease} both!important;animation-timeline:view()!important;animation-range:entry 0% cover ${Math.round(15 + cfg.duration * 20)}%!important;animation-delay:0s!important}}`;
  }
  return kf + rules + reduced;
}
