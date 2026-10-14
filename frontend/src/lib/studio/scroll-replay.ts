/**
 * Scroll-animation replay for the Studio canvas.
 *
 * The preview plays the scroll timeline recorded at capture time
 * (#__clonyfy_scroll_timeline__) with an in-page script. The editor's iframe runs no
 * scripts, so this module drives the same timeline from the editor, against the
 * iframe document — the canvas then looks and moves exactly like the preview.
 *
 * Saving must never bake an animation frame into the page. Every attribute this
 * module changes is recorded with its original value, and swapped step panels keep
 * their original children aside; `withOriginals()` puts the page back to its saved
 * state for serialization (save, undo snapshots, source view) and then restores the
 * live frame.
 *
 * Editing an animated element (`touch`) hands it over to the user: its scroll
 * animation is removed from the timeline (editor AND preview), so the edit is never
 * overwritten. Edits inside a step panel are written back into that step's snapshot,
 * so the panel keeps animating with the change.
 */

const TIMELINE_ID = "__clonyfy_scroll_timeline__";
const EDITOR_ATTR_RE = /\s(?:data-clonyfy-editor-[a-z-]+|data-cth(?![-\w]))(?:="[^"]*")?/g;

type Keyframe<T> = [number, T];
type TrackData = {
  id: string;
  a: number;
  n: string;
  k: Keyframe<string | null>[];
  once?: 1;
  r?: number;
  p?: number[];
};
type RegionData = { id: string; a: number; k: Keyframe<number>[] };
type Timeline = {
  v: 1;
  anchors: Array<{ id: string; mode: "el" | "doc" }>;
  tracks: TrackData[];
  regions?: RegionData[];
  html?: string[];
};

type Track = TrackData & { src: TrackData; el: Element | null; latched: boolean; lerp: boolean };
type Region = {
  data: RegionData;
  index: number;
  el: HTMLElement;
  shown: number;
  /** Original (saved) children, set aside while another step is shown. */
  stash: DocumentFragment | null;
  dirty: boolean;
};

export type StepInfo = { index: number; label: string };

export type ScrollReplay = {
  /** Serialize/inspect the page as saved, then put the live animation frame back. */
  withOriginals<T>(fn: () => T): T;
  /** The user is about to edit `el`: stop animating it (or write it into its step). */
  touch(el: Element | null): void;
  isAnimated(el: Element): boolean;
  /** Steps of a recorded step panel (`el` is the panel), or null. */
  steps(el: Element): StepInfo[] | null;
  /** Scroll the canvas to where `el` is revealed. False when `el` isn't animated. */
  reveal(el: Element): boolean;
  revealStep(panel: Element, index: number): void;
  destroy(): void;
};

export function startScrollReplay(
  doc: Document,
  opts: {
    onRegionSwap?: (panel: HTMLElement) => void;
    /** Runs this module's DOM changes outside the runtime host's change record. */
    quiet?: <T>(fn: () => T) => T;
  } = {},
): ScrollReplay | null {
  const node = doc.getElementById(TIMELINE_ID);
  const win = doc.defaultView;
  if (!node || !win || !doc.body) return null;
  let data: Timeline;
  try {
    data = JSON.parse(node.textContent || "") as Timeline;
  } catch {
    return null;
  }
  if (!data || ((!data.tracks || !data.tracks.length) && (!data.regions || !data.regions.length)))
    return null;
  data.tracks ||= [];
  data.regions ||= [];
  data.html ||= [];
  const quiet = opts.quiet ?? (<T>(fn: () => T) => fn());

  /* --------------------------------------------------------- originals */

  // element → attribute → original value (null = attribute absent)
  const originals = new Map<Element, Map<string, string | null>>();
  const setAttr = (el: Element, name: string, value: string | null) => {
    let rec = originals.get(el);
    if (!rec) originals.set(el, (rec = new Map()));
    if (!rec.has(name)) rec.set(name, el.getAttribute(name));
    if (value === null) el.removeAttribute(name);
    else el.setAttribute(name, value);
  };
  const forget = (el: Element) => {
    const rec = originals.get(el);
    if (!rec) return;
    for (const [name, value] of rec) {
      if (value === null) el.removeAttribute(name);
      else el.setAttribute(name, value);
    }
    originals.delete(el);
  };

  const persist = () => {
    node.textContent = JSON.stringify(data).replace(/</g, "\\u003c");
  };

  // The capture froze animated elements in a visible state and remembered their
  // starting state (data-clonyfy-prev-*). Restore the start state, like the preview.
  const total = doc.getElementsByTagName("*").length || 1;
  const restoreStart = (el: Element) => {
    if (el.hasAttribute("data-clonyfy-prev-style")) {
      const s = el.getAttribute("data-clonyfy-prev-style");
      setAttr(el, "style", s || null);
      setAttr(el, "data-clonyfy-prev-style", null);
    }
    if (el.hasAttribute("data-clonyfy-prev-class")) {
      const c = el.getAttribute("data-clonyfy-prev-class");
      setAttr(el, "class", c || null);
      setAttr(el, "data-clonyfy-prev-class", null);
    }
  };
  quiet(() => {
    for (const root of Array.from(doc.querySelectorAll("[data-clonyfy-st],[data-clonyfy-sr]"))) {
      if (root === doc.documentElement || root === doc.body) continue;
      if (root.getElementsByTagName("*").length > total * 0.25) continue;
      restoreStart(root);
      root
        .querySelectorAll("[data-clonyfy-prev-style],[data-clonyfy-prev-class]")
        .forEach(restoreStart);
    }
  });

  /* ------------------------------------------------------------ model */

  const anchors = data.anchors.map((a) => ({
    mode: a.mode,
    el: a.mode === "el" ? doc.querySelector(`[data-clonyfy-sa="${a.id}"]`) : null,
  }));
  const regions: Array<Region | null> = data.regions.map((r, index) => {
    const el = doc.querySelector<HTMLElement>(`[data-clonyfy-sr="${r.id}"]`);
    if (!el || !r.k?.length || !anchors[r.a]) return null;
    return { data: r, index, el, shown: -1, stash: null, dirty: false };
  });
  let tracks: Track[] = [];
  const buildTracks = () => {
    tracks = data.tracks
      .map((t) => {
        const inRegion = typeof t.r === "number" && !!t.p;
        const el = inRegion ? null : doc.querySelector(`[data-clonyfy-st="${t.id}"]`);
        return {
          ...t,
          src: t,
          el,
          latched: false,
          lerp: t.n !== "class" && !/^(data-|aria-)/.test(t.n),
        };
      })
      .filter(
        (t) =>
          (t.el || (typeof t.r === "number" && regions[t.r])) && t.k?.length >= 2 && anchors[t.a],
      );
  };
  buildTracks();

  const resolvePath = (root: Element, p: number[]) => {
    let x: Element | undefined = root;
    for (const i of p) x = x?.children[i];
    return x || null;
  };
  const targetOf = (t: Track): Element | null => {
    if (typeof t.r !== "number" || !t.p) return t.el;
    const owner = regions[t.r];
    return owner ? resolvePath(owner.el, t.p) : null;
  };

  /* ---------------------------------------------------------- playback */

  const NUM = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
  const mix = (a: string | null, b: string | null, f: number) => {
    if (a === null || b === null || a === b) return a;
    const na = a.match(NUM);
    const nb = b.match(NUM);
    if (!na || !nb || na.length !== nb.length) return a;
    const sa = a.split(NUM);
    const sb = b.split(NUM);
    if (sa.join("\u0000") !== sb.join("\u0000")) return a;
    let out = sa[0] ?? "";
    for (let i = 0; i < na.length; i++) {
      const x = parseFloat(na[i]!);
      const y = parseFloat(nb[i]!);
      out += String(Math.round((x + (y - x) * f) * 10000) / 10000) + (sa[i + 1] ?? "");
    }
    return out;
  };
  const valueAt = (t: Track, p: number) => {
    const k = t.k;
    if (p <= k[0]![0]) return k[0]![1];
    const last = k.length - 1;
    if (p >= k[last]![0]) return k[last]![1];
    let lo = 0;
    let hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (k[mid]![0] <= p) lo = mid;
      else hi = mid;
    }
    if (!t.lerp) return k[lo]![1];
    const span = k[hi]![0] - k[lo]![0];
    return mix(k[lo]![1], k[hi]![1], span > 0 ? (p - k[lo]![0]) / span : 0);
  };
  const stepAt = (k: Keyframe<number>[], p: number) => {
    let idx = k[0]![1];
    for (const [at, i] of k) if (at <= p) idx = i;
    return idx;
  };
  const metrics = () => ({
    vh: win.innerHeight,
    docH: Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight || 0),
  });
  const progressOf = (a: number) => {
    const anchor = anchors[a];
    const { vh, docH } = metrics();
    if (!anchor || anchor.mode === "doc" || !anchor.el)
      return Math.max(0, Math.min(1, win.scrollY / Math.max(1, docH - vh)));
    const rect = anchor.el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (vh - rect.top) / Math.max(1, vh + rect.height)));
  };

  const cleanHtml = (el: HTMLElement) => el.innerHTML.replace(EDITOR_ATTR_RE, "");
  /** Store the edited step back into its snapshot; the edited children become the saved ones. */
  const flush = (region: Region) => {
    if (!region.dirty || region.shown < 0) return;
    data.html![region.shown] = cleanHtml(region.el);
    persist();
    region.stash = null; // current children are now the saved version
    region.dirty = false;
  };
  const swap = (region: Region, idx: number) => {
    if (region.shown === idx) return;
    const html = data.html![idx];
    if (typeof html !== "string") return;
    if (region.shown >= 0 && region.dirty) {
      flush(region);
      region.stash = doc.createDocumentFragment();
      region.stash.append(...Array.from(region.el.childNodes));
    } else if (!region.stash) {
      region.stash = doc.createDocumentFragment();
      region.stash.append(...Array.from(region.el.childNodes));
    } else {
      region.el.replaceChildren();
    }
    region.el.innerHTML = html;
    region.shown = idx;
    opts.onRegionSwap?.(region.el);
  };

  let queued = 0;
  let destroyed = false;
  let suspended = false;
  const apply = () => {
    queued = 0;
    if (destroyed || suspended) return;
    quiet(applyFrame);
  };
  const applyFrame = () => {
    const prog = anchors.map((_, i) => progressOf(i));
    for (const region of regions) {
      if (region) swap(region, stepAt(region.data.k, prog[region.data.a] ?? 0));
    }
    for (const t of tracks) {
      const p = prog[t.a] ?? 0;
      let v: string | null;
      if (t.once) {
        const end = t.k[t.k.length - 1]!;
        if (!t.latched && p >= end[0]) t.latched = true;
        v = t.latched ? end[1] : t.k[0]![1];
      } else v = valueAt(t, p);
      const target = targetOf(t);
      if (!target || target.getAttribute(t.n) === v) continue;
      try {
        // Inside a step panel the snapshot itself is the saved state — no record needed.
        if (typeof t.r === "number") {
          if (v === null) target.removeAttribute(t.n);
          else target.setAttribute(t.n, v);
        } else setAttr(target, t.n, v);
      } catch {
        /* invalid attribute value */
      }
    }
  };
  const schedule = () => {
    if (!queued && !destroyed) queued = requestAnimationFrame(apply);
  };
  win.addEventListener("scroll", schedule, { passive: true });
  win.addEventListener("resize", schedule);
  apply();

  /* ------------------------------------------------------------- API */

  const withOriginals = <T>(fn: () => T): T => {
    if (destroyed) return fn();
    suspended = true;
    const swapped: Array<{ region: Region; live: DocumentFragment }> = [];
    const live = new Map<Element, Map<string, string | null>>();
    try {
      for (const region of regions) {
        if (!region) continue;
        flush(region);
        if (!region.stash) continue; // showing the saved children already
        const current = doc.createDocumentFragment();
        current.append(...Array.from(region.el.childNodes));
        region.el.append(...Array.from(region.stash.childNodes));
        swapped.push({ region, live: current });
      }
      for (const [el, rec] of originals) {
        const now = new Map<string, string | null>();
        for (const [name, value] of rec) {
          now.set(name, el.getAttribute(name));
          if (value === null) el.removeAttribute(name);
          else el.setAttribute(name, value);
        }
        live.set(el, now);
      }
      return fn();
    } finally {
      for (const [el, now] of live) {
        for (const [name, value] of now) {
          if (value === null) el.removeAttribute(name);
          else el.setAttribute(name, value);
        }
      }
      for (const { region, live: current } of swapped) {
        region.stash!.append(...Array.from(region.el.childNodes));
        region.el.append(...Array.from(current.childNodes));
      }
      suspended = false;
    }
  };

  const regionOf = (el: Element) =>
    regions.find((r) => r && (r.el === el || r.el.contains(el))) || null;

  const touch = (el: Element | null) => quiet(() => touchNow(el));
  const touchNow = (el: Element | null) => {
    if (!el || destroyed || !el.isConnected) return;
    let changed = false;
    // Animated elements at or inside `el` stop animating — in the editor and preview.
    const removed = new Set<TrackData>();
    for (const t of tracks) {
      const target = targetOf(t);
      if (!target || !(target === el || el.contains(target))) continue;
      removed.add(t.src);
      if (typeof t.r !== "number") {
        forget(target); // back to the saved (visible) state
        target.removeAttribute("data-clonyfy-prev-style");
        target.removeAttribute("data-clonyfy-prev-class");
        if (!tracks.some((o) => o !== t && o.el === target && !removed.has(o)))
          target.removeAttribute("data-clonyfy-st");
      }
      changed = true;
    }
    if (removed.size) {
      data.tracks = data.tracks.filter((d) => !removed.has(d));
      buildTracks();
    }
    // Edits inside a step panel go into the step being shown.
    const region = regionOf(el);
    if (region && region.el !== el) {
      region.dirty = true;
      changed = true;
    } else if (region && region.el === el) {
      // The whole panel is being restyled/moved: keep it on the current step.
      flush(region);
      region.dirty = true;
      changed = true;
    }
    if (changed) persist();
  };

  const isAnimated = (el: Element) =>
    !!regionOf(el) ||
    tracks.some((t) => {
      const target = targetOf(t);
      return !!target && (target === el || el.contains(target));
    });

  const scrollToProgress = (a: number, p: number) => {
    const anchor = anchors[a];
    const { vh, docH } = metrics();
    let y: number;
    if (!anchor || anchor.mode === "doc" || !anchor.el) y = p * Math.max(0, docH - vh);
    else {
      const rect = anchor.el.getBoundingClientRect();
      y = rect.top + win.scrollY - vh + p * (vh + rect.height);
    }
    win.scrollTo(0, Math.max(0, Math.min(docH - vh, Math.round(y))));
    apply();
  };

  const steps = (el: Element): StepInfo[] | null => {
    const region = regions.find((r) => r?.el === el);
    if (!region) return null;
    const order = [...new Set(region.data.k.map(([, idx]) => idx))];
    // Text pieces of each snapshot; a step is named by the first piece no other step shows.
    const pieces = order.map((idx) => {
      const tpl = doc.createElement("template");
      tpl.innerHTML = data.html![idx] || "";
      const walker = doc.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
      const out: string[] = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = (n.textContent || "").replace(/\s+/g, " ").trim();
        if (t.length > 1) out.push(t);
      }
      return { idx, out, heading: tpl.content.querySelector("h1,h2,h3,h4")?.textContent || "" };
    });
    const out: StepInfo[] = [];
    for (const p of pieces) {
      if (!p.out.length) continue; // empty "before" state
      const unique = p.out.find((t) => pieces.every((o) => o === p || !o.out.includes(t)));
      const label = (unique || p.heading || p.out[0]!).replace(/\s+/g, " ").trim();
      out.push({ index: p.idx, label: label.slice(0, 40) });
    }
    return out.length > 1 ? out : null;
  };

  const revealStep = (panel: Element, index: number) => {
    const region = regions.find((r) => r?.el === panel);
    if (!region) return;
    const k = region.data.k;
    const at = k.findIndex(([, i]) => i === index);
    if (at < 0) return;
    const from = k[at]![0];
    const to = k[at + 1]?.[0] ?? Math.min(1, from + 0.04);
    scrollToProgress(region.data.a, from + (to - from) * 0.5);
  };

  const reveal = (el: Element) => {
    const region = regionOf(el);
    if (region) {
      if (region.shown >= 0) revealStep(region.el, region.shown);
      return true;
    }
    // The animation of `el` (or of its nearest animated ancestor) at its end state.
    for (let x: Element | null = el; x && x !== doc.body; x = x.parentElement) {
      const own = tracks.filter((t) => targetOf(t) === x);
      if (!own.length) continue;
      const t = own.reduce((best, cur) =>
        cur.k[cur.k.length - 1]![0] > best.k[best.k.length - 1]![0] ? cur : best,
      );
      const end = t.k[t.k.length - 1]![0];
      scrollToProgress(t.a, Math.min(1, end + 0.01));
      return true;
    }
    return false;
  };

  return {
    withOriginals,
    touch,
    isAnimated,
    steps,
    reveal,
    revealStep,
    destroy() {
      destroyed = true;
      if (queued) cancelAnimationFrame(queued);
      win.removeEventListener("scroll", schedule);
      win.removeEventListener("resize", schedule);
    },
  };
}
