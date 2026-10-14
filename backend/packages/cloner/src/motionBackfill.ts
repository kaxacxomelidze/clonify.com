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
import { recordScrollTimeline, injectScrollTimeline, type ScrollTimelineData } from './scrollTimeline.js';

const VIEWPORT = { width: 1440, height: 900 };

type Mark = { path: number[]; attrs: Record<string, string> };
type MatchResult = { marks: Mark[]; dropAnchors: number[]; dropRegions: string[] };

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
  return { marks: Array.from(out.values()), dropAnchors, dropRegions };
}

type P5Node = {
  nodeName: string;
  tagName?: string;
  childNodes?: P5Node[];
  attrs?: Array<{ name: string; value: string }>;
  sourceCodeLocation?: { startTag?: { startOffset: number; endOffset: number } } | null;
};

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
  reason?: string;
}

/**
 * @param previewUrl interactive preview of the page (site JS running, served by this API)
 * @param snapshotHtml the saved snapshot to add the timeline to
 */
export async function backfillScrollTimeline(previewUrl: string, snapshotHtml: string, opts: { timeoutMs?: number } = {}): Promise<MotionBackfillResult> {
  if (/id=["']__clonyfy_scroll_timeline__["']/.test(snapshotHtml)) return { html: null, tracks: 0, regions: 0, reason: 'already recorded' };
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
    const left = deadline - Date.now();
    if (left < 5_000) return { html: null, tracks: 0, regions: 0, reason: 'timeout' };
    const tl = await Promise.race([
      recordScrollTimeline(page, { fast: true }),
      new Promise<null>((r) => setTimeout(() => r(null), left)),
    ]);
    if (!tl) return { html: null, tracks: 0, regions: 0, reason: 'no scroll animation' };
    const match: MatchResult = await page.evaluate(matchInPage, { html: snapshotHtml });
    const { html, applied } = applyMarks(snapshotHtml, match.marks);
    const pruned = pruneTimeline(tl, applied);
    if (!pruned) return { html: null, tracks: 0, regions: 0, reason: 'animated elements not found in the snapshot' };
    return { html: injectScrollTimeline(html, pruned), tracks: pruned.tracks.length, regions: pruned.regions?.length || 0 };
  } catch (err) {
    logger.debug(`  [MOTION BACKFILL] ${(err as Error).message.split('\n')[0]}`);
    return { html: null, tracks: 0, regions: 0, reason: (err as Error).message.split('\n')[0] };
  } finally {
    await browser?.close().catch(() => {});
  }
}
