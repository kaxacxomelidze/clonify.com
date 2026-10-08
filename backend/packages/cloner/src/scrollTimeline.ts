/**
 * Scroll timeline recording — keeps scroll-linked animations (pinned "sticky" stories,
 * parallax, progress-driven CSS variables, reveal-on-scroll classes) working in clones
 * whose site JS is neutralized.
 *
 * While capturing we scroll the live page top → bottom and log every attribute the
 * site's JS changes, keyed by the element's progress through the viewport. The preview
 * runtime replays those keyframes against the same progress on scroll.
 */
import type { Page } from 'playwright-core';

export const SCROLL_TIMELINE_SCRIPT_ID = '__clonyfy_scroll_timeline__';

export interface ScrollTimelineData {
  v: 1;
  /** Anchors: element progress through the viewport, or whole-document progress. */
  anchors: Array<{ id: string; mode: 'el' | 'doc' }>;
  /** Keyframes are [progress 0..1, attribute value or null for "absent"]. */
  /** `id` targets `[data-clonyfy-st]`; region tracks use `r` + child-index path `p` instead. */
  tracks: Array<{ id: string; a: number; n: string; k: Array<[number, string | null]>; once?: 1; r?: number; p?: number[] }>;
  /** Containers whose children change on scroll: keyframes index into `html`. */
  regions?: Array<{ id: string; a: number; k: Array<[number, number]> }>;
  html?: string[];
}

/** Runs in the browser — must stay self-contained (no outer references). */
async function recordInPage(opts: {
  step: number; maxSteps: number; settleMs: number; maxTracks: number; maxRegions: number; maxRegionBytes: number;
}): Promise<ScrollTimelineData | null> {
  const IGNORE_ATTR = /^(src|srcset|href|id|value|loading|decoding|sizes|data-clonyfy-.*|data-nimg|aria-(?!hidden).*|tabindex|title|alt|autocomplete)$/i;
  const SKIP_INSIDE = 'canvas,iframe,video,audio,script,style,noscript,[data-clonyfy-ui]';
  const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const vh = window.innerHeight;
  const docH = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
  if (docH <= vh + 50) return null;

  window.scrollTo(0, 0);
  await wait(350);
  await raf();

  type Track = { el: Element; name: string; initial: string | null; samples: Array<[number, string | null]>; last: string | null; lastStep: number; changes: number };
  const tracks = new Map<string, Track>();
  const keyOf = (el: Element, name: string, ids: Map<Element, number>) => {
    let id = ids.get(el);
    if (id === undefined) { id = ids.size; ids.set(el, id); }
    return `${id}|${name}`;
  };
  const elIds = new Map<Element, number>();
  let stepIndex = 0;

  // Containers whose children the site swaps while scrolling (React mounting the
  // active step's panel, etc.) — replayed as HTML snapshots in a second pass.
  const structural = new Set<Element>();
  const consider = (records: MutationRecord[]) => {
    for (const m of records) {
      if (m.type === 'childList') {
        const target = m.target as Element;
        if (target instanceof Element && !target.closest(SKIP_INSIDE)
          && target !== document.documentElement && target !== document.body && target !== document.head) {
          structural.add(target);
        }
        continue;
      }
      if (m.type !== 'attributes' || !m.attributeName) continue;
      const el = m.target as Element;
      if (!(el instanceof Element) || IGNORE_ATTR.test(m.attributeName)) continue;
      if (el.closest(SKIP_INSIDE)) continue;
      const key = keyOf(el, m.attributeName, elIds);
      if (tracks.has(key) || tracks.size >= opts.maxTracks) continue;
      // Backfill: before its first change the attribute held oldValue.
      tracks.set(key, { el, name: m.attributeName, initial: m.oldValue, samples: [[0, m.oldValue]], last: m.oldValue, lastStep: 0, changes: 0 });
    }
  };
  const mo = new MutationObserver(consider);
  mo.observe(document.documentElement, { attributes: true, subtree: true, attributeOldValue: true, childList: true });

  const ys: number[] = [];
  const sample = () => {
    consider(mo.takeRecords());
    for (const t of tracks.values()) {
      const v = t.el.getAttribute(t.name);
      if (v === t.last) continue;
      // Hold keyframe: the old value lasted until the previous step, so replay must
      // not interpolate the change across the whole unchanged stretch.
      if (stepIndex - 1 > t.lastStep) t.samples.push([stepIndex - 1, t.last]);
      t.samples.push([stepIndex, v]);
      t.last = v;
      t.lastStep = stepIndex;
      t.changes++;
    }
  };

  const total = Math.min(opts.maxSteps, Math.ceil((docH - vh) / opts.step) + 1);
  const stride = (docH - vh) / Math.max(1, total - 1);
  for (let i = 0; i < total; i++) {
    stepIndex = i;
    const y = Math.round(i * stride);
    window.scrollTo(0, y);
    ys.push(window.scrollY);
    await raf();
    await raf();
    if (opts.settleMs) await wait(opts.settleMs);
    sample();
  }

  // Eased/spring values keep moving briefly after scrolling stops — let them settle
  // and record where they land, then treat anything STILL changing as time-driven
  // (marquee, ticker, autoplay loops) rather than scroll-linked, and drop it.
  await wait(900);
  stepIndex = total - 1;
  sample();
  const before = new Map<Track, string | null>();
  for (const t of tracks.values()) before.set(t, t.el.getAttribute(t.name));
  const stillChildChanges = new Set<Element>();
  await wait(800);
  for (const m of mo.takeRecords()) {
    if (m.type === 'childList' && m.target instanceof Element) stillChildChanges.add(m.target);
  }
  mo.disconnect();
  const timeDriven = new Set<Track>();
  for (const t of tracks.values()) {
    if (before.has(t) && t.el.getAttribute(t.name) !== before.get(t)) timeDriven.add(t);
  }

  // Pick structural regions: connected, outermost, not time-driven (autoplay
  // carousels keep swapping children while we hold still), and not page-sized.
  const totalEls = document.getElementsByTagName('*').length || 1;
  let regionEls = Array.from(structural).filter((el) => el.isConnected);
  regionEls = regionEls.filter((el) => !regionEls.some((other) => other !== el && other.contains(el)));
  regionEls = regionEls.filter((el) => {
    for (const s of stillChildChanges) if (el.contains(s) || s.contains(el)) return false;
    if (el.getElementsByTagName('*').length > totalEls * 0.3) return false;
    if (el.querySelector('script,iframe,video,canvas')) return false;
    return el.innerHTML.length < 250_000;
  }).slice(0, opts.maxRegions);

  // Pass 2: replay the same scroll positions. A region gets a new HTML snapshot only
  // when its STRUCTURE or TEXT changes (a new step's panel) — not when style values
  // inside it move with scroll. New content is snapshotted after its entrance
  // animation settles (typing / scramble text, fades), never mid-way. Continuous
  // attribute changes inside a region become path-addressed tracks instead.
  type Region = { el: Element; samples: Array<[number, number]>; last: number; sig: string };
  const regions: Region[] = regionEls.map((el) => ({ el, samples: [], last: -1, sig: '' }));
  const htmlPool: string[] = [];
  const htmlIndex = new Map<string, number>();
  let poolBytes = 0;
  const signature = (el: Element) => el.innerHTML
    .replace(/\s(?:style|data-clonyfy-[a-z-]+)="[^"]*"/g, '');
  const settleRegion = async (r: Region) => {
    // Entrance effects animate inline styles too (typing reveals via width/clip,
    // fades), so wait for the FULL markup to hold still ~300ms (max ~2.5s).
    // We aren't scrolling meanwhile, so scroll-linked values stay put.
    const full = () => r.el.innerHTML.replace(/\sdata-clonyfy-[a-z-]+="[^"]*"/g, '');
    let prev = full();
    let stableFor = 0;
    for (let t = 0; t < 2500 && stableFor < 300; t += 100) {
      await wait(100);
      const now = full();
      if (now === prev) stableFor += 100;
      else { stableFor = 0; prev = now; }
    }
    return signature(r.el);
  };
  const record = (r: Region, step: number) => {
    const h = r.el.innerHTML;
    let idx = htmlIndex.get(h);
    if (idx === undefined) {
      if (poolBytes + h.length > opts.maxRegionBytes) return;
      idx = htmlPool.length;
      htmlPool.push(h);
      htmlIndex.set(h, idx);
      poolBytes += h.length;
    }
    if (idx === r.last) return;
    r.samples.push([step, idx]);
    r.last = idx;
  };

  type PathTrack = { r: number; path: number[]; name: string; samples: Array<[number, string | null]>; last: string | null; lastStep: number };
  const pathTracks = new Map<string, PathTrack>();
  const pathOf = (root: Element, el: Element): number[] | null => {
    const p: number[] = [];
    for (let x: Element | null = el; x && x !== root; x = x.parentElement) {
      const parent: Element | null = x.parentElement;
      if (!parent) return null;
      p.unshift(Array.prototype.indexOf.call(parent.children, x));
    }
    return p;
  };
  const resolve = (root: Element, p: number[]) => {
    let x: Element | undefined = root;
    for (const i of p) { x = x?.children[i]; if (!x) return null; }
    return x || null;
  };
  let pass2Step = 0;
  const onRegionRecords = (records: MutationRecord[]) => {
    for (const m of records) {
      if (m.type !== 'attributes' || !m.attributeName || IGNORE_ATTR.test(m.attributeName)) continue;
      const el = m.target as Element;
      const ri = regions.findIndex((r) => r.el !== el && r.el.contains(el));
      if (ri < 0) continue;
      const path = pathOf(regions[ri].el, el);
      if (!path) continue;
      const key = `${ri}|${path.join('.')}|${m.attributeName}`;
      if (pathTracks.has(key) || pathTracks.size >= opts.maxTracks) continue;
      pathTracks.set(key, { r: ri, path, name: m.attributeName, samples: [[0, m.oldValue]], last: m.oldValue, lastStep: 0 });
    }
  };
  const regionMo = new MutationObserver(onRegionRecords);
  const samplePaths = (step: number) => {
    for (const t of pathTracks.values()) {
      const el = resolve(regions[t.r].el, t.path);
      if (!el) continue;
      const v = el.getAttribute(t.name);
      if (v === t.last) continue;
      if (step - 1 > t.lastStep) t.samples.push([step - 1, t.last]);
      t.samples.push([step, v]);
      t.last = v;
      t.lastStep = step;
    }
  };

  if (regions.length) {
    window.scrollTo(0, 0);
    await wait(600);
    await raf();
    for (const r of regions) {
      r.sig = await settleRegion(r);
      record(r, 0);
      regionMo.observe(r.el, { attributes: true, subtree: true, attributeOldValue: true });
    }
    for (let i = 0; i < ys.length; i++) {
      pass2Step = i;
      window.scrollTo(0, ys[i]);
      await raf();
      await raf();
      if (opts.settleMs) await wait(opts.settleMs);
      for (const r of regions) {
        if (!r.el.isConnected || signature(r.el) === r.sig) continue;
        r.sig = await settleRegion(r);
        record(r, i);
      }
      onRegionRecords(regionMo.takeRecords());
      samplePaths(pass2Step);
    }
    await wait(900);
    onRegionRecords(regionMo.takeRecords());
    samplePaths(ys.length - 1);
    regionMo.disconnect();
  }

  // Resolve each tracked element's progress anchor.
  const isSticky = (el: Element) => { try { return getComputedStyle(el).position === 'sticky'; } catch { return false; } };
  const isFixed = (el: Element) => { try { return getComputedStyle(el).position === 'fixed'; } catch { return false; } };
  const anchorFor = (el: Element): { el: Element | null; mode: 'el' | 'doc' } => {
    if (el === document.documentElement || el === document.body) return { el: null, mode: 'doc' };
    let html: Element | null = el instanceof SVGElement ? (el.closest('svg')?.parentElement || null) : el;
    for (let x: Element | null = html; x && x !== document.body; x = x.parentElement) {
      if (isFixed(x)) return { el: null, mode: 'doc' };
      if (isSticky(x)) return { el: x.parentElement, mode: 'el' }; // pinned story: the track drives it
    }
    return { el: html, mode: 'el' };
  };

  const anchors: ScrollTimelineData['anchors'] = [];
  const anchorIndex = new Map<Element | 'doc', number>();
  const anchorGeom: Array<{ top: number; h: number; mode: 'el' | 'doc' }> = [];
  const endY = window.scrollY;
  const getAnchor = (target: Element | null, mode: 'el' | 'doc') => {
    const key: Element | 'doc' = mode === 'doc' || !target ? 'doc' : target;
    let idx = anchorIndex.get(key);
    if (idx !== undefined) return idx;
    idx = anchors.length;
    anchorIndex.set(key, idx);
    if (key === 'doc') {
      anchors.push({ id: '', mode: 'doc' });
      anchorGeom.push({ top: 0, h: docH, mode: 'doc' });
    } else {
      const id = `a${idx}`;
      key.setAttribute('data-clonyfy-sa', id);
      const r = key.getBoundingClientRect();
      anchors.push({ id, mode: 'el' });
      anchorGeom.push({ top: r.top + endY, h: r.height, mode: 'el' });
    }
    return idx;
  };
  const progressAt = (a: number, y: number) => {
    const g = anchorGeom[a];
    if (g.mode === 'doc') return Math.max(0, Math.min(1, y / Math.max(1, docH - vh)));
    const top = g.top - y;
    return Math.max(0, Math.min(1, (vh - top) / Math.max(1, vh + g.h)));
  };
  const round = (n: number) => Math.round(n * 10000) / 10000;

  const out: ScrollTimelineData['tracks'] = [];
  let trackNo = 0;
  const regionHasPaths = new Set(Array.from(pathTracks.values()).filter((t) => t.samples.length >= 2).map((t) => t.r));
  const liveRegions = regions.filter((r, i) => r.el.isConnected && r.samples.length >= 1 && (r.samples.length >= 2 || regionHasPaths.has(i)));
  for (const t of tracks.values()) {
    if (timeDriven.has(t) || t.samples.length < 2 || !t.el.isConnected) continue;
    // Inside a snapshotted region the HTML keyframes already carry this attribute.
    if (liveRegions.some((r) => r.el.contains(t.el))) continue;
    const anchor = anchorFor(t.el);
    const a = getAnchor(anchor.el, anchor.mode);
    let id = t.el.getAttribute('data-clonyfy-st');
    if (!id) { id = `s${trackNo++}`; t.el.setAttribute('data-clonyfy-st', id); }
    let k: Array<[number, string | null]> = t.samples.map(([step, v]) => [round(progressAt(a, ys[step] ?? 0)), v]);
    // Keep the last value per progress point; cap keyframes per track.
    const dedup: Array<[number, string | null]> = [];
    for (const kf of k) {
      if (dedup.length && dedup[dedup.length - 1][0] === kf[0]) dedup[dedup.length - 1] = kf;
      else dedup.push(kf);
    }
    k = dedup;
    if (k.length > 160) {
      const keep: Array<[number, string | null]> = [];
      const every = k.length / 160;
      for (let i = 0; i < 160; i++) keep.push(k[Math.floor(i * every)]);
      keep.push(k[k.length - 1]);
      k = keep;
    }
    const track: ScrollTimelineData['tracks'][number] = { id, a, n: t.name, k };
    // One change and never back: reveal-once (IntersectionObserver add-class). Replay
    // latches it so scrolling up doesn't hide revealed content again.
    if (t.changes === 1) track.once = 1;
    out.push(track);
  }

  const regionOut: NonNullable<ScrollTimelineData['regions']> = [];
  const regionOutIndex = new Map<number, number>();
  const usedHtml = new Map<number, number>();
  const html: string[] = [];
  liveRegions.forEach((r, n) => {
    const anchor = anchorFor(r.el);
    const a = getAnchor(anchor.el, anchor.mode);
    const id = `r${n}`;
    r.el.setAttribute('data-clonyfy-sr', id);
    const k: Array<[number, number]> = [];
    for (const [step, idx] of r.samples) {
      let compact = usedHtml.get(idx);
      if (compact === undefined) { compact = html.length; usedHtml.set(idx, compact); html.push(htmlPool[idx]); }
      const p = round(progressAt(a, ys[step] ?? 0));
      if (k.length && k[k.length - 1][0] === p) k[k.length - 1] = [p, compact];
      else k.push([p, compact]);
    }
    regionOutIndex.set(regions.indexOf(r), regionOut.length);
    regionOut.push({ id, a, k });
  });

  // Continuous attributes inside regions (progress lines, CSS vars), addressed by
  // child-index path from the region root so they survive snapshot swaps.
  for (const t of pathTracks.values()) {
    const ri = regionOutIndex.get(t.r);
    if (ri === undefined || t.samples.length < 2) continue;
    const a = regionOut[ri].a;
    const k: Array<[number, string | null]> = [];
    for (const [step, v] of t.samples) {
      const p = round(progressAt(a, ys[step] ?? 0));
      if (k.length && k[k.length - 1][0] === p) k[k.length - 1] = [p, v];
      else k.push([p, v]);
    }
    if (k.length < 2) continue;
    const kept = k.length > 160 ? k.filter((_, i) => i % Math.ceil(k.length / 160) === 0 || i === k.length - 1) : k;
    out.push({ id: '', a, n: t.name, k: kept, r: ri, p: t.path });
  }

  window.scrollTo(0, 0);
  await wait(400);
  if (!out.length && !regionOut.length) return null;
  return regionOut.length ? { v: 1, anchors, tracks: out, regions: regionOut, html } : { v: 1, anchors, tracks: out };
}

export async function recordScrollTimeline(page: Page, opts: { fast: boolean }): Promise<ScrollTimelineData | null> {
  return page.evaluate(recordInPage, {
    step: opts.fast ? 60 : 36,
    maxSteps: opts.fast ? 160 : 280,
    settleMs: opts.fast ? 0 : 12,
    maxTracks: 1500,
    maxRegions: 12,
    maxRegionBytes: opts.fast ? 800_000 : 1_500_000,
  });
}

/** Embed the timeline as inert JSON (survives script neutralization). */
export function injectScrollTimeline(html: string, data: ScrollTimelineData | null): string {
  if (!data || (!data.tracks.length && !data.regions?.length)) return html;
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const tag = `<script type="application/json" id="${SCROLL_TIMELINE_SCRIPT_ID}" data-clonyfy-scroll-timeline>${json}</script>`;
  const idx = html.toLowerCase().lastIndexOf('</body>');
  return idx === -1 ? html + tag : html.slice(0, idx) + tag + html.slice(idx);
}
