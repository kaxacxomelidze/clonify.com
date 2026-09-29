import { createHash } from 'crypto';
import type { Page } from 'playwright';
import { logger } from './logger.js';
import { IS_FAST_CLONE } from './serverlessBudget.js';

/**
 * Records how header/nav menus open (hover or click) on the live page so the
 * clone can replay them without the original site JS.
 *
 * Output: `<script type="application/json" id="__clonyfy_interactions__">` with
 * items keyed by `data-clonyfy-ix` (trigger) and ops referencing
 * `data-clonyfy-ixt` (targets). The serve-time runtime applies/reverts the ops.
 */

type Ref = { s: 'root' | 'body' | 'html' | 'head' | 'self'; p: number[] };
type RawOp =
  | { k: 'attr'; t: Ref; n: string; on: string | null; off: string | null }
  | { k: 'cls'; t: Ref; a: string[]; r: string[] }
  | { k: 'add'; p: Ref; b: Ref | null; h: string };
type RawItem = { i: number; ev: 'hover' | 'click'; ops: RawOp[] };

type FinalOp =
  | { k: 'attr'; t: string; n: string; on: string | null; off: string | null }
  | { k: 'cls'; t: string; a: string[]; r: string[] }
  | { k: 'add'; p: string; b: string | null; h: string };
type FinalItem = { i: number; ev: 'hover' | 'click'; ops: FinalOp[] };

const MAX_TRIGGERS = IS_FAST_CLONE ? 8 : 12;
const HOVER_WAIT_MS = IS_FAST_CLONE ? 280 : 360;
const CLICK_WAIT_MS = IS_FAST_CLONE ? 320 : 420;
const SETTLE_MS = IS_FAST_CLONE ? 140 : 180;
const TIME_BUDGET_MS = IS_FAST_CLONE ? 7_000 : 14_000;
const MAX_ADD_HTML = 250_000;
const MAX_TOTAL_JSON = 900_000;

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 200;
const recordedNavCache = new Map<string, { at: number; items: RawItem[] }>();

function cacheGet(key: string): RawItem[] | null {
  const hit = recordedNavCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    recordedNavCache.delete(key);
    return null;
  }
  return hit.items;
}

function cacheSet(key: string, items: RawItem[]): void {
  if (recordedNavCache.size >= CACHE_MAX) {
    const oldest = recordedNavCache.keys().next().value;
    if (oldest !== undefined) recordedNavCache.delete(oldest);
  }
  recordedNavCache.set(key, { at: Date.now(), items });
}

export function interactionsScriptHtml(items: FinalItem[]): string {
  if (!items.length) return '';
  const json = JSON.stringify({ v: 1, items }).replace(/</g, '\\u003c');
  return `<script type="application/json" id="__clonyfy_interactions__">${json}</script>`;
}

export function injectInteractionsScript(html: string, scriptHtml: string): string {
  if (!scriptHtml || html.includes('id="__clonyfy_interactions__"')) return html;
  const idx = html.toLowerCase().lastIndexOf('</body>');
  if (idx === -1) return html + scriptHtml;
  return html.slice(0, idx) + scriptHtml + html.slice(idx);
}

/** Install in-page helpers, tag the nav root + triggers. */
async function setupRecorder(page: Page, maxTriggers: number, maxAddHtml: number) {
  return page.evaluate(({ maxTriggers, maxAddHtml }: { maxTriggers: number; maxAddHtml: number }) => {
    const w = window as any;
    const root = document.querySelector('header, [role="banner"]') || document.querySelector('nav, [role="navigation"]');
    if (!root || !document.body) return null;
    root.setAttribute('data-clonyfy-ix-root', '');

    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05;
    };
    const realHref = (el: Element) => {
      if (el.tagName !== 'A') return false;
      const h = (el.getAttribute('href') || '').trim();
      return !!h && !/^#!?$/.test(h) && !/^javascript:/i.test(h);
    };
    const hasHiddenSubmenu = (li: Element) => Array.from(li.children).some((c) => (
      /^(UL|OL|DIV|SECTION|NAV)$/.test(c.tagName) && !!c.querySelector('a[href]') && !visible(c)
    ));

    const picked: Element[] = [];
    const consider = (el: Element | null) => {
      if (!el || picked.includes(el)) return;
      for (const s of picked) if (s.contains(el) || el.contains(s)) return;
      if (!visible(el)) return;
      if ((el as HTMLButtonElement).type === 'submit' && el.closest('form')) return;
      picked.push(el);
    };
    root.querySelectorAll(
      '[aria-haspopup]:not([aria-haspopup="false"]), [aria-expanded], [aria-controls], [data-toggle], [data-bs-toggle], button, [role="button"], summary',
    ).forEach((el) => consider(el));
    root.querySelectorAll('li').forEach((li) => {
      if (hasHiddenSubmenu(li)) consider(li.querySelector(':scope > a, :scope > button, :scope > span, :scope > div') || li);
    });

    const list = picked.slice(0, maxTriggers);
    const signature: string[] = [root.tagName];
    const clickable: boolean[] = [];
    list.forEach((el, i) => {
      el.setAttribute('data-clonyfy-ix', String(i));
      signature.push(`${el.tagName}:${(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)}:${el.getAttribute('aria-controls') || ''}`);
      clickable.push(!realHref(el) && (
        el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'SUMMARY'
        || el.getAttribute('role') === 'button'
        || el.hasAttribute('aria-expanded') || el.hasAttribute('aria-controls') || el.hasAttribute('aria-haspopup')
        || el.hasAttribute('data-toggle') || el.hasAttribute('data-bs-toggle')
      ));
    });

    const ATTRS = [
      'class', 'style', 'hidden', 'open', 'inert',
      'aria-expanded', 'aria-hidden', 'aria-selected',
      'data-state', 'data-open', 'data-expanded', 'data-active', 'data-show', 'data-visible', 'data-headlessui-state',
    ];
    const SKIP_TAGS = /^(SCRIPT|NOSCRIPT|IFRAME|LINK|META|TEMPLATE|OBJECT|EMBED|BASE)$/;
    const ROOTS = new Set<Element>([document.documentElement, document.body, document.head]);

    const st: any = {
      els: [] as Element[],
      noisy: new Set<Node>(),
      noisyRootAttrs: new Map<Element, Set<string>>(),
      mo: null as MutationObserver | null,
      records: [] as MutationRecord[],
      guard: true,
    };
    w.__clonyfyIx = st;

    st.start = () => {
      st.records = [];
      st.mo = new MutationObserver((l) => { st.records.push(...l); });
      st.mo.observe(document.documentElement, {
        subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ATTRS,
      });
    };
    st.collect = (): MutationRecord[] => {
      if (!st.mo) return [];
      st.records.push(...st.mo.takeRecords());
      st.mo.disconnect();
      st.mo = null;
      const recs = st.records;
      st.records = [];
      return recs;
    };
    st.baseline = () => {
      for (const r of st.collect()) {
        const t = r.target as Element;
        if (ROOTS.has(t)) {
          if (r.type === 'attributes' && r.attributeName) {
            let s = st.noisyRootAttrs.get(t);
            if (!s) { s = new Set<string>(); st.noisyRootAttrs.set(t, s); }
            s.add(r.attributeName);
          }
        } else {
          st.noisy.add(t);
        }
      }
    };
    st.isNoisy = (n: Node | null) => {
      for (let x: Node | null = n; x; x = x.parentNode) if (st.noisy.has(x)) return true;
      return false;
    };
    st.idx = (el: Element) => {
      let i = st.els.indexOf(el);
      if (i === -1) { i = st.els.length; st.els.push(el); }
      return i;
    };
    st.serialize = (node: Element) => {
      const c = node.cloneNode(true) as Element;
      const all = [c, ...Array.from(c.querySelectorAll('*'))];
      const abs = (v: string) => { try { return new URL(v, document.baseURI).href; } catch { return v; } };
      for (const el of all) {
        for (const a of ['src', 'href', 'poster', 'action', 'data-src']) {
          const v = el.getAttribute(a);
          if (!v || /^(#|data:|javascript:|mailto:|tel:|blob:)/i.test(v.trim())) continue;
          el.setAttribute(a, abs(v.trim()));
        }
        for (const a of ['srcset', 'data-srcset']) {
          const v = el.getAttribute(a);
          if (!v || v.includes('data:')) continue;
          el.setAttribute(a, v.split(',').map((part) => {
            const s = part.trim();
            if (!s) return s;
            const sp = s.search(/\s/);
            const u = sp === -1 ? s : s.slice(0, sp);
            return abs(u) + (sp === -1 ? '' : s.slice(sp));
          }).join(', '));
        }
        const style = el.getAttribute('style');
        if (style && /url\(/i.test(style)) {
          el.setAttribute('style', style.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, u) => (
            /^data:/i.test(u) ? m : `url(${q}${abs(u)}${q})`
          )));
        }
        el.removeAttribute('data-clonyfy-ix');
        el.removeAttribute('data-clonyfy-ixt');
      }
      return c.outerHTML;
    };
    st.stop = () => {
      const recs: MutationRecord[] = st.collect();
      const added = new Set<Element>();
      for (const r of recs) {
        if (r.type !== 'childList') continue;
        r.addedNodes.forEach((n) => { if (n.nodeType === 1) added.add(n as Element); });
      }
      const insideAdded = (n: Node | null) => {
        for (let x = n?.parentNode ?? null; x; x = x.parentNode) if (added.has(x as Element)) return true;
        return false;
      };
      const firstOld = new Map<Element, Map<string, string | null>>();
      for (const r of recs) {
        if (r.type !== 'attributes' || !r.attributeName) continue;
        const el = r.target as Element;
        const name = r.attributeName;
        if (name.startsWith('data-clonyfy')) continue;
        if (!el.isConnected || added.has(el) || insideAdded(el)) continue;
        if (ROOTS.has(el)) {
          if (st.noisyRootAttrs.get(el)?.has(name)) continue;
        } else if (st.isNoisy(el)) continue;
        let m = firstOld.get(el);
        if (!m) { m = new Map(); firstOld.set(el, m); }
        if (!m.has(name)) m.set(name, r.oldValue);
      }
      const ops: any[] = [];
      for (const [el, m] of firstOld) {
        for (const [name, off] of m) {
          const on = el.getAttribute(name);
          if (on === off) continue;
          ops.push({ k: 'attr', el: st.idx(el), n: name, on, off });
        }
      }
      for (const node of added) {
        if (!node.isConnected || insideAdded(node) || SKIP_TAGS.test(node.tagName)) continue;
        const parent = node.parentElement;
        if (!parent) continue;
        if (!ROOTS.has(parent) && st.isNoisy(parent)) continue;
        if (node.tagName !== 'STYLE' && !(node.textContent || '').trim() && !node.querySelector('img,svg,video,picture,canvas')) continue;
        let next: Element | null = node.nextElementSibling;
        while (next && added.has(next)) next = next.nextElementSibling;
        const h = st.serialize(node);
        if (!h || h.length > maxAddHtml) continue;
        ops.push({ k: 'add', el: st.idx(node), p: st.idx(parent), b: next ? st.idx(next) : -1, h });
      }
      return ops;
    };
    st.revert = (ops: any[]) => {
      for (const op of ops) {
        if (op.k === 'attr') {
          const el: Element | undefined = st.els[op.el];
          if (!el || !el.isConnected || el.getAttribute(op.n) === op.off) continue;
          try {
            if (op.off === null) el.removeAttribute(op.n);
            else el.setAttribute(op.n, op.off);
          } catch { /* ignore */ }
        } else if (op.k === 'add') {
          const n: Element | undefined = st.els[op.el];
          if (n && n.isConnected) { try { n.remove(); } catch { /* ignore */ } }
        }
      }
    };
    st.ref = (i: number, trigger: Element | null) => {
      const el: Element | undefined = st.els[i];
      if (!el || !el.isConnected) return null;
      if (el === document.documentElement) return { s: 'html', p: [] };
      if (el === document.body) return { s: 'body', p: [] };
      if (el === document.head) return { s: 'head', p: [] };
      if (trigger && el === trigger) return { s: 'self', p: [] };
      const base = root.contains(el) ? root : document.body;
      const p: number[] = [];
      let x: Element = el;
      while (x !== base) {
        const parent = x.parentElement;
        if (!parent) return null;
        p.unshift(Array.prototype.indexOf.call(parent.children, x));
        x = parent;
      }
      return { s: base === root ? 'root' : 'body', p };
    };
    st.finalize = (ops: any[], triggerIndex: number) => {
      const trigger = document.querySelector(`[data-clonyfy-ix="${triggerIndex}"]`);
      const out: any[] = [];
      const tokens = (v: string | null) => String(v || '').split(/\s+/).filter(Boolean);
      for (const op of ops) {
        if (op.k === 'attr') {
          const t = st.ref(op.el, trigger);
          if (!t) continue;
          if (op.n === 'class') {
            const on = tokens(op.on);
            const off = tokens(op.off);
            const a = on.filter((c) => !off.includes(c));
            const r = off.filter((c) => !on.includes(c));
            if (a.length || r.length) out.push({ k: 'cls', t, a, r });
          } else {
            out.push({ k: 'attr', t, n: op.n, on: op.on, off: op.off });
          }
        } else if (op.k === 'add') {
          const p = st.ref(op.p, trigger);
          if (!p) continue;
          const b = op.b >= 0 ? st.ref(op.b, trigger) : null;
          out.push({ k: 'add', p, b, h: op.h });
        }
      }
      return out;
    };

    // Never let a recorded click navigate away or open popups.
    const nav = w.navigation;
    if (nav && typeof nav.addEventListener === 'function') {
      w.__clonyfyIxNav = (e: any) => {
        if (st.guard && !e.hashChange && e.cancelable) e.preventDefault();
      };
      nav.addEventListener('navigate', w.__clonyfyIxNav);
    }
    w.__clonyfyIxOpen = window.open;
    window.open = () => null;
    w.__clonyfyIxSubmit = (e: Event) => e.preventDefault();
    document.addEventListener('submit', w.__clonyfyIxSubmit, true);

    return { count: list.length, signature: signature.join('|'), clickable };
  }, { maxTriggers, maxAddHtml });
}

async function teardownRecorder(page: Page, keep: number[]): Promise<void> {
  await page.evaluate((keep: number[]) => {
    const w = window as any;
    const st = w.__clonyfyIx;
    if (st) {
      st.guard = false;
      try { st.collect(); } catch { /* ignore */ }
    }
    if (w.__clonyfyIxNav && w.navigation) w.navigation.removeEventListener('navigate', w.__clonyfyIxNav);
    if (w.__clonyfyIxOpen) window.open = w.__clonyfyIxOpen;
    if (w.__clonyfyIxSubmit) document.removeEventListener('submit', w.__clonyfyIxSubmit, true);
    delete w.__clonyfyIx;
    delete w.__clonyfyIxNav;
    delete w.__clonyfyIxOpen;
    delete w.__clonyfyIxSubmit;
    document.querySelectorAll('[data-clonyfy-ix-root]').forEach((el) => el.removeAttribute('data-clonyfy-ix-root'));
    const keepSet = new Set(keep.map(String));
    document.querySelectorAll('[data-clonyfy-ix]').forEach((el) => {
      if (!keepSet.has(el.getAttribute('data-clonyfy-ix') || '')) el.removeAttribute('data-clonyfy-ix');
    });
  }, keep).catch(() => {});
}

/** Tag targets on this page and convert path refs into `t:<n>` handles. */
async function resolveItems(page: Page, items: RawItem[]): Promise<FinalItem[]> {
  return page.evaluate((items: RawItem[]) => {
    const root = document.querySelector('[data-clonyfy-ix-root]');
    let n = 0;
    const tagOf = new Map<Element, string>();
    const resolveEl = (ref: any, trigger: Element): Element | string | null => {
      if (!ref) return null;
      if (ref.s === 'html' || ref.s === 'body' || ref.s === 'head' || ref.s === 'self') return ref.s;
      let x: Element | null = ref.s === 'root' ? root : document.body;
      for (const i of ref.p as number[]) {
        x = x ? (x.children[i] ?? null) : null;
        if (!x) return null;
      }
      if (!x) return null;
      if (x === trigger) return 'self';
      return x;
    };
    const handle = (target: Element | string): string => {
      if (typeof target === 'string') return target;
      let tag = tagOf.get(target);
      if (!tag) {
        tag = String(n++);
        tagOf.set(target, tag);
        target.setAttribute('data-clonyfy-ixt', tag);
      }
      return `t:${tag}`;
    };
    const elementFor = (target: Element | string, trigger: Element): Element | null => {
      if (typeof target !== 'string') return target;
      if (target === 'html') return document.documentElement;
      if (target === 'body') return document.body;
      if (target === 'head') return document.head;
      return trigger;
    };
    const out: any[] = [];
    for (const it of items) {
      const trigger = document.querySelector(`[data-clonyfy-ix="${it.i}"]`);
      if (!trigger) continue;
      const ops: any[] = [];
      for (const op of it.ops as any[]) {
        if (op.k === 'attr') {
          const t = resolveEl(op.t, trigger);
          if (!t) continue;
          const el = elementFor(t, trigger);
          // Closed state must match this page (cached recordings come from a sibling page).
          const off = el ? el.getAttribute(op.n) : op.off;
          if (off === op.on) continue;
          ops.push({ k: 'attr', t: handle(t), n: op.n, on: op.on, off });
        } else if (op.k === 'cls') {
          const t = resolveEl(op.t, trigger);
          if (t) ops.push({ k: 'cls', t: handle(t), a: op.a, r: op.r });
        } else if (op.k === 'add') {
          const p = resolveEl(op.p, trigger);
          if (!p) continue;
          const b = op.b ? resolveEl(op.b, trigger) : null;
          ops.push({ k: 'add', p: handle(p), b: b ? handle(b) : null, h: op.h });
        }
      }
      if (ops.length) out.push({ i: it.i, ev: it.ev, ops });
    }
    return out;
  }, items);
}

/**
 * Record nav menu interactions and return the JSON script tag to embed in the
 * captured HTML ('' when nothing interactive was found). Leaves the DOM in its
 * closed state so the snapshot matches the original page.
 */
export async function recordNavInteractions(page: Page, pageUrl: string): Promise<string> {
  const started = Date.now();
  const startUrl = page.url();
  let keep: number[] = [];
  try {
    const setup = await setupRecorder(page, MAX_TRIGGERS, MAX_ADD_HTML);
    if (!setup || !setup.count) {
      await teardownRecorder(page, []);
      return '';
    }

    let origin = '';
    try { origin = new URL(pageUrl).origin; } catch { /* ignore */ }
    const cacheKey = `${origin}|${createHash('sha1').update(setup.signature).digest('hex')}`;
    let raw = cacheGet(cacheKey);

    if (!raw) {
      raw = [];
      const viewport = page.viewportSize() || { width: 1440, height: 900 };
      const restX = Math.round(viewport.width / 2);
      const restY = Math.max(1, viewport.height - 4);

      await page.keyboard.press('Escape').catch(() => {});
      await page.mouse.move(restX, restY).catch(() => {});
      await page.evaluate(() => (window as any).__clonyfyIx.start());
      await page.waitForTimeout(400);
      await page.evaluate(() => (window as any).__clonyfyIx.baseline());

      for (let i = 0; i < setup.count; i++) {
        if (Date.now() - started > TIME_BUDGET_MS) break;
        const loc = page.locator(`[data-clonyfy-ix="${i}"]`).first();
        if (!(await loc.isVisible().catch(() => false))) continue;

        let ev: 'hover' | 'click' = 'hover';
        await page.evaluate(() => (window as any).__clonyfyIx.start());
        const hovered = await loc.hover({ timeout: 900 }).then(() => true).catch(() => false);
        if (hovered) await page.waitForTimeout(HOVER_WAIT_MS);
        let ops: any[] = await page.evaluate(() => (window as any).__clonyfyIx.stop());

        if (!ops.length && setup.clickable[i]) {
          ev = 'click';
          await page.evaluate(() => (window as any).__clonyfyIx.start());
          const clicked = await loc.click({ timeout: 900, force: true, noWaitAfter: true }).then(() => true).catch(() => false);
          if (clicked) await page.waitForTimeout(CLICK_WAIT_MS);
          ops = await page.evaluate(() => (window as any).__clonyfyIx.stop());
        }

        await page.mouse.move(restX, restY).catch(() => {});
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(SETTLE_MS);

        if (page.url() !== startUrl) {
          logger.warn(`  [NAV INTERACTIONS] ${pageUrl} navigated during recording; skipping interactions`);
          raw = [];
          break;
        }

        const finalized: RawOp[] = await page.evaluate(({ ops, i }: { ops: any[]; i: number }) => {
          const st = (window as any).__clonyfyIx;
          st.revert(ops);
          return st.finalize(ops, i);
        }, { ops, i });
        if (finalized.length) raw.push({ i, ev, ops: finalized });
      }
      if (raw.length) cacheSet(cacheKey, raw);
    }

    let items = raw.length ? await resolveItems(page, raw) : [];
    while (items.length && JSON.stringify(items).length > MAX_TOTAL_JSON) items = items.slice(0, -1);
    keep = items.map((it) => it.i);
    await teardownRecorder(page, keep);
    if (items.length) {
      logger.debug(`  [NAV INTERACTIONS] ${pageUrl}: ${items.length} menu(s) recorded in ${Date.now() - started}ms`);
    }
    return interactionsScriptHtml(items);
  } catch (err) {
    logger.debug(`  [NAV INTERACTIONS WARN] ${(err as Error).message}`);
    await teardownRecorder(page, keep);
    return '';
  }
}
