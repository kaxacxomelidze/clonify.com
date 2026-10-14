/**
 * Motion backfill — record a page's scroll animations after the fact.
 *
 * The editor (and the offline preview) can only play animations recorded at capture
 * time (scroll timeline). Some captures have none: older clones, or pages where the
 * recording was lost. The interactive preview still runs the site's own JS against its
 * original server HTML, so the animations can be recorded there instead: we open that
 * preview headless, record exactly like the capture does, find each animated element in
 * the saved snapshot, and write the markers + timeline into the snapshot's HTML.
 */
import { parse } from 'parse5';
import { logger } from './logger.js';
import { getChromiumLaunchOptions } from './crawler.js';
import { createHash } from 'crypto';
import { recordScrollTimeline, injectScrollTimeline, type ScrollTimelineData } from './scrollTimeline.js';
import { captureCanvasFrames, canvasImageHtml } from './canvasFrames.js';

const VIEWPORT = { width: 1440, height: 900 };

type Mark = { path: number[]; attrs: Record<string, string> };
type MatchResult = { marks: Mark[]; dropAnchors: number[]; dropRegions: string[]; canvases: Array<{ id: string; path: number[] }> };

/** Runs in the browser — self-contained. Matches marked live elements to the snapshot. */
function matchInPage(args: { html: string }): MatchResult {
  const SKIP = 'script,style,link,meta,noscript,template,base,title,[data-clonyfy-ui]';
  const parsed = new DOMParser().parseFromString(args.html, 'text/html');
  const content = (el: Element) => Array.from(el.children).filter((c) => !c.matches(SKIP));
  const contentPath = (el: Element) => {
    const p: number[] = [];
    for (let x: Element | null = el; x && x !== x.ownerDocument.documentElement; x = x.parentElement) {
      const parent = x.parentElement;
      if (!parent) return null;
      const i = content(parent).indexOf(x);
      if (i < 0) return null;
      p.unshift(i);
    }
    return p;
  };
  const byPath = (doc: Document, p: number[]) => {
    let x: Element | undefined = doc.documentElement;
    for (const i of p) { x = x ? content(x)[i] : undefined; if (!x) return null; }
    return x || null;
  };
  const classes = (el: Element) => new Set(String(el.getAttribute('class') || '').split(/\s+/).filter(Boolean));
  const similar = (a: Element, b: Element) => {
    if (a.tagName !== b.tagName) return false;
    if (a.id || b.id) return a.id === b.id;
    const ca = classes(a);
    const cb = classes(b);
    if (!ca.size && !cb.size) return true;
    let common = 0;
    for (const c of ca) if (cb.has(c)) common++;
    return common / Math.max(ca.size, cb.size) >= 0.5;
  };
  const text = (el: Element) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const signature = (el: Element) => `${el.tagName}|${el.id}|${Array.from(classes(el)).sort().join(' ')}|${text(el)}`;
  const sigIndex = new Map<string, Element | null>();
  for (const el of Array.from(parsed.body ? parsed.body.getElementsByTagName('*') : [])) {
    const s = signature(el);
    sigIndex.set(s, sigIndex.has(s) ? null : el); // null = ambiguous
  }
  const find = (live: Element) => {
    const p = contentPath(live);
    const cand = p ? byPath(parsed, p) : null;
    if (cand && similar(live, cand)) return cand;
    return sigIndex.get(signature(live)) || null;
  };
  const realPath = (el: Element) => {
    const p: number[] = [];
    for (let x: Element | null = el; x && x !== parsed.documentElement; x = x.parentElement) {
      if (!x.parentElement) return null;
      p.unshift(Array.prototype.indexOf.call(x.parentElement.children, x));
    }
    return p;
  };

  const out = new Map<Element, Mark>();
  const mark = (target: Element, name: string, value: string) => {
    const path = realPath(target);
    if (!path) return false;
    let m = out.get(target);
    if (!m) out.set(target, (m = { path, attrs: {} }));
    m.attrs[name] = value;
    return true;
  };
  const dropAnchors: number[] = [];
  const dropRegions: string[] = [];
  for (const live of Array.from(document.querySelectorAll('[data-clonyfy-sa]'))) {
    const id = live.getAttribute('data-clonyfy-sa')!;
    const t = find(live);
    if (!t || !mark(t, 'data-clonyfy-sa', id)) dropAnchors.push(Number(id.slice(1)));
  }
  for (const live of Array.from(document.querySelectorAll('[data-clonyfy-st]'))) {
    const t = find(live);
    if (t) mark(t, 'data-clonyfy-st', live.getAttribute('data-clonyfy-st')!);
  }
  for (const live of Array.from(document.querySelectorAll('[data-clonyfy-sr]'))) {
    const id = live.getAttribute('data-clonyfy-sr')!;
    const t = find(live);
    if (!t || !mark(t, 'data-clonyfy-sr', id)) dropRegions.push(id);
  }
  // Live canvases → the snapshot's still-empty <canvas> at the same place.
  const canvases: Array<{ id: string; path: number[] }> = [];
  for (const live of Array.from(document.querySelectorAll('canvas[data-clonyfy-bf-canvas]'))) {
    const t = find(live);
    if (!t || t.tagName !== 'CANVAS') continue;
    const path = realPath(t);
    if (path) canvases.push({ id: live.getAttribute('data-clonyfy-bf-canvas')!, path });
  }
  return { marks: Array.from(out.values()), dropAnchors, dropRegions, canvases };
}

type P5Node = {
  nodeName: string;
  tagName?: string;
  childNodes?: P5Node[];
  attrs?: Array<{ name: string; value: string }>;
  sourceCodeLocation?: { startTag?: { startOffset: number; endOffset: number } } | null;
};

/** Replace elements addressed by element-index path with new HTML, editing the source text in place. */
function replaceElements(html: string, swaps: Array<{ path: number[]; html: string }>): { html: string; replaced: number } {
  const doc = parse(html, { sourceCodeLocationInfo: true }) as unknown as P5Node;
  const root = doc.childNodes?.find((n) => n.tagName === 'html');
  const edits: Array<{ start: number; end: number; text: string }> = [];
  for (const sw of swaps) {
    let x: P5Node | undefined = root;
    for (const i of sw.path) x = x?.childNodes?.filter((c) => !!c.tagName)[i];
    const loc = x?.sourceCodeLocation as { startTag?: { startOffset: number; endOffset: number }; endTag?: { endOffset: number } } | null | undefined;
    if (!loc?.startTag) continue;
    edits.push({ start: loc.startTag.startOffset, end: loc.endTag?.endOffset ?? loc.startTag.endOffset, text: sw.html });
  }
  edits.sort((a, b) => b.start - a.start);
  let out = html;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return { html: out, replaced: edits.length };
}

/** Add attributes to elements addressed by element-index path from <html>, editing the source text in place. */
function applyMarks(html: string, marks: Mark[]): { html: string; applied: Set<string> } {
  const doc = parse(html, { sourceCodeLocationInfo: true }) as unknown as P5Node;
  const root = doc.childNodes?.find((n) => n.tagName === 'html');
  const inserts: Array<{ at: number; text: string; names: string[] }> = [];
  for (const m of marks) {
    let x: P5Node | undefined = root;
    for (const i of m.path) x = x?.childNodes?.filter((c) => !!c.tagName)[i];
    const tag = x?.sourceCodeLocation?.startTag;
    if (!x || !tag) continue;
    const existing = new Set((x.attrs || []).map((a) => a.name));
    const add = Object.entries(m.attrs).filter(([n]) => !existing.has(n));
    if (!add.length) continue;
    const end = html.slice(tag.startOffset, tag.endOffset);
    const at = tag.endOffset - (end.endsWith('/>') ? 2 : 1);
    const text = add.map(([n, v]) => ` ${n}="${v.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join('');
    inserts.push({ at, text, names: add.map(([n, v]) => `${n}=${v}`) });
  }
  inserts.sort((a, b) => b.at - a.at);
  let out = html;
  const applied = new Set<string>();
  for (const ins of inserts) {
    out = out.slice(0, ins.at) + ins.text + out.slice(ins.at);
    ins.names.forEach((n) => applied.add(n));
  }
  return { html: out, applied };
}

/** Keep only the parts of the timeline whose elements were found in the snapshot. */
function pruneTimeline(tl: ScrollTimelineData, applied: Set<string>): ScrollTimelineData | null {
  const anchorOk = (a: number) => tl.anchors[a]?.mode === 'doc' || applied.has(`data-clonyfy-sa=${tl.anchors[a]?.id}`);
  const regionsKept = new Map<number, number>();
  const regions: NonNullable<ScrollTimelineData['regions']> = [];
  (tl.regions || []).forEach((r, i) => {
    if (!anchorOk(r.a) || !applied.has(`data-clonyfy-sr=${r.id}`)) return;
    regionsKept.set(i, regions.length);
    regions.push(r);
  });
  const tracks = tl.tracks
    .filter((t) => anchorOk(t.a))
    .filter((t) => (typeof t.r === 'number' ? regionsKept.has(t.r) : applied.has(`data-clonyfy-st=${t.id}`)))
    .map((t) => (typeof t.r === 'number' ? { ...t, r: regionsKept.get(t.r)! } : t));
  if (!tracks.length && !regions.length) return null;
  return regions.length ? { ...tl, tracks, regions } : { v: 1, anchors: tl.anchors, tracks };
}

export interface MotionBackfillResult {
  html: string | null;
  tracks: number;
  regions: number;
  /** Canvases (WebGL/2D visuals) replaced by recorded frame loops. */
  canvases: number;
  /** Frame images to save under public/_assets/<name>. */
  files: Array<{ name: string; data: Buffer }>;
  reason?: string;
}

/** Scroll animations only (kept for callers of the original API). */
export async function backfillScrollTimeline(previewUrl: string, snapshotHtml: string, opts: { timeoutMs?: number } = {}): Promise<MotionBackfillResult> {
  return backfillPageMedia(previewUrl, snapshotHtml, { ...opts, timeline: true, canvases: false });
}

/**
 * Record what only the site's JS draws, from its interactive preview, into the saved
 * snapshot: scroll animations (timeline) and canvas visuals (frame loops — e.g. a WebGL
 * gradient background the capture couldn't shoot).
 * @param previewUrl interactive preview of the page (site JS running, served by this API)
 * @param snapshotHtml the saved snapshot to add them to
 */
export async function backfillPageMedia(
  previewUrl: string,
  snapshotHtml: string,
  opts: { timeoutMs?: number; timeline: boolean; canvases: boolean },
): Promise<MotionBackfillResult> {
  const none = (reason: string): MotionBackfillResult => ({ html: null, tracks: 0, regions: 0, canvases: 0, files: [], reason });
  const wantTimeline = opts.timeline && !/id=["']__clonyfy_scroll_timeline__["']/.test(snapshotHtml);
  const wantCanvases = opts.canvases && /<canvas\b[^>]*data-clonyfy-canvas-id/i.test(snapshotHtml);
  if (!wantTimeline && !wantCanvases) return none('nothing to record');
  let browser: any;
  const deadline = Date.now() + (opts.timeoutMs ?? 60_000);
  try {
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ headless: true, ...(await getChromiumLaunchOptions(chromium as never)) });
    const page = await browser.newPage({ viewport: VIEWPORT });
    // Bundlers keep function names with a __name helper the page doesn't have.
    await page.addInitScript(() => { (window as unknown as { __name: (f: unknown) => unknown }).__name = (f) => f; });
    // Offline third-party requests (analytics, fonts) can hold "load" open — don't wait on them.
    await page.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('load', { timeout: 10_000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 4_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    let html = snapshotHtml;
    const files: MotionBackfillResult['files'] = [];
    let canvases = 0;
    let canvasNote = '';
    if (wantCanvases) {
      // Tag the live canvases worth keeping (same rule as the capture), then find their
      // empty twins in the snapshot and shoot a frame loop for each.
      const liveCount = await page.evaluate(() => {
        let n = 0;
        for (const el of Array.from(document.querySelectorAll('canvas'))) {
          const c = el as HTMLCanvasElement;
          const r = c.getBoundingClientRect();
          const cs = getComputedStyle(c);
          if (r.width < 80 || r.height < 40 || !c.width || !c.height) continue;
          if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) continue;
          const id = `bf-canvas-${n++}`;
          c.setAttribute('data-clonyfy-bf-canvas', id);
          c.setAttribute('data-clonyfy-canvas-id', id);
        }
        return n;
      });
      const { canvases: pairs } = await page.evaluate(matchInPage, { html }) as MatchResult;
      const swaps: Array<{ path: number[]; html: string }> = [];
      for (const pair of pairs.slice(0, 6)) {
        const left = deadline - Date.now() - (wantTimeline ? 30_000 : 5_000);
        if (left < 6_000) break;
        const { frames, frameMs, ext } = await captureCanvasFrames(page, pair.id, {
          maxFrames: 16, intervalMs: 90, maxBytes: 6_000_000, budgetMs: Math.min(20_000, left),
        });
        canvasNote += ` ${pair.id}:${frames.length}f`;
        if (!frames.length) continue;
        const webPaths = frames.map((buf) => {
          const name = `canvas_${createHash('sha1').update(buf).digest('hex').slice(0, 16)}.${ext}`;
          if (!files.some((f) => f.name === name)) files.push({ name, data: buf });
          return `/_assets/${name}`;
        });
        const imgHtml = await canvasImageHtml(page, pair.id, webPaths, frameMs);
        if (imgHtml) swaps.push({ path: pair.path, html: imgHtml });
      }
      canvasNote = `canvases live ${liveCount}, matched ${pairs.length}${canvasNote}`;
      if (swaps.length) {
        const res = replaceElements(html, swaps);
        html = res.html;
        canvases = res.replaced;
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
    }

    let tracks = 0;
    let regions = 0;
    let reason = '';
    if (wantTimeline) {
      const left = deadline - Date.now();
      const tl = left < 5_000 ? null : await Promise.race([
        // Stops at its budget with what it recorded; the race only guards a hung page.
        recordScrollTimeline(page, { fast: true, budgetMs: Math.min(50_000, left - 4_000) }),
        new Promise<null>((r) => setTimeout(() => r(null), left)),
      ]);
      if (!tl) reason = left < 5_000 ? 'timeout' : 'no scroll animation';
      else {
        const match: MatchResult = await page.evaluate(matchInPage, { html });
        const marked = applyMarks(html, match.marks);
        const pruned = pruneTimeline(tl, marked.applied);
        if (!pruned) reason = 'animated elements not found in the snapshot';
        else {
          html = injectScrollTimeline(marked.html, pruned);
          tracks = pruned.tracks.length;
          regions = pruned.regions?.length || 0;
        }
      }
    }
    if (canvasNote) reason = reason ? `${reason}; ${canvasNote}` : canvasNote;
    if (!canvases && !tracks && !regions) return none(reason || 'nothing recorded');
    return { html, tracks, regions, canvases, files, ...(reason ? { reason } : {}) };
  } catch (err) {
    logger.debug(`  [MOTION BACKFILL] ${(err as Error).message.split('\n')[0]}`);
    return none((err as Error).message.split('\n')[0]);
  } finally {
    await browser?.close().catch(() => {});
  }
}
