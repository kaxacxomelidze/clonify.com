/**
 * Clonyfy Helper — background worker.
 *
 * One job: when the user asks Clonyfy to clone a protected site, capture the rendered
 * page in the user's own browser and hand it to the Clonyfy backend. The user is a real
 * visitor in their own tab; nothing here imitates a browser, defeats a check, or reads
 * anything the user can't already see. Only the public front-end layer is sent (see
 * sanitize.js): never cookies, logins, storage or personal data.
 *
 * Flow (started by the Clonyfy web app through bridge.js):
 *   1. one-time allow for the site (Chrome's own permission prompt, from a user click)
 *   2. open the site in a tab (or use the one the user already has open)
 *   3. wait until the page is the real page (the user completes any check themselves)
 *   4. read the rendered page + its files in that tab
 *   5. strip credentials, upload to the Clonyfy backend
 */
import { sanitizeBundle } from './sanitize.js';

/** Where captures may be uploaded — Clonyfy's own API only. */
const API_ORIGINS = ['https://clonyfy.com', 'https://www.clonyfy.com', 'http://localhost:5000', 'http://127.0.0.1:5000'];
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 140 * 1024 * 1024;
const MAX_FILES = 600;
const CHALLENGE_WAIT_MS = 3 * 60 * 1000;

const pendingAllows = new Map(); // requestId → resolve(granted)

chrome.runtime.onInstalled.addListener((details) => {
  // First install: tell Clonyfy, so the install card never shows again.
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'https://clonyfy.com/dashboard?helper=installed' }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'allow-result' && pendingAllows.has(msg.requestId)) {
    pendingAllows.get(msg.requestId)(!!msg.granted);
    pendingAllows.delete(msg.requestId);
    return false;
  }
  if (msg?.type === 'ping') {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return false;
  }
  if (msg?.type === 'capture' && sender.tab?.id != null) {
    const appTab = sender.tab.id;
    const report = (stage, extra = {}) => {
      chrome.tabs.sendMessage(appTab, { type: 'progress', requestId: msg.requestId, stage, ...extra }).catch(() => {});
    };
    const release = keepAlive();
    runCapture(msg, report)
      .then((result) => report('done', result))
      .catch((err) => report('error', { message: String(err?.message || err) }))
      .finally(release);
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

/** Host pattern for a site: the site and its subdomains (www., cdn. on the same domain), same scheme only. */
function sitePatterns(url) {
  const u = new URL(url);
  const bare = u.hostname.replace(/^www\./, '');
  return [`${u.protocol}//*.${bare}/*`];
}

async function ensureAllowed(url, requestId) {
  const origins = sitePatterns(url);
  if (await chrome.permissions.contains({ origins })) return true;
  // Chrome only shows its permission prompt from a click inside the extension, so the
  // one-time allow is a small Clonyfy Helper window with an Allow button.
  const granted = new Promise((resolve) => pendingAllows.set(requestId, resolve));
  const page = `allow.html?${new URLSearchParams({ requestId, site: new URL(url).hostname, scheme: new URL(url).protocol.replace(':', '') })}`;
  const win = await chrome.windows.create({ url: page, type: 'popup', width: 460, height: 560, focused: true });
  const closed = new Promise((resolve) => {
    const onRemoved = (id) => {
      if (id !== win.id) return;
      chrome.windows.onRemoved.removeListener(onRemoved);
      resolve(false);
    };
    chrome.windows.onRemoved.addListener(onRemoved);
  });
  const ok = await Promise.race([granted, closed]);
  pendingAllows.delete(requestId);
  chrome.windows.remove(win.id).catch(() => {});
  return ok && (await chrome.permissions.contains({ origins }));
}

function waitForTabComplete(tabId, timeoutMs = 60_000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; chrome.tabs.onUpdated.removeListener(onUpdated); resolve(); };
    const onUpdated = (id, info) => { if (id === tabId && info.status === 'complete') finish(); };
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId).then((t) => { if (t.status === 'complete') finish(); }).catch(finish);
    setTimeout(finish, timeoutMs);
  });
}

/** The user's own tab on that site if they already have it open, otherwise a new one. */
async function openSiteTab(url) {
  const target = new URL(url);
  const bare = target.hostname.replace(/^www\./, '');
  const tabs = await chrome.tabs.query({ url: sitePatterns(url) }).catch(() => []);
  const samePage = tabs.find((t) => {
    try {
      const u = new URL(t.url);
      return u.hostname.replace(/^www\./, '') === bare && u.pathname === target.pathname;
    } catch { return false; }
  });
  if (samePage) {
    await chrome.tabs.update(samePage.id, { active: true });
    if (samePage.windowId != null) await chrome.windows.update(samePage.windowId, { focused: true }).catch(() => {});
    return samePage.id;
  }
  const tab = await chrome.tabs.create({ url, active: true });
  return tab.id;
}

async function inTab(tabId, func, args = [], timeoutMs = 90_000) {
  const run = chrome.scripting.executeScript({ target: { tabId }, func, args }).then(([res]) => res?.result);
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('The page did not respond in time')), timeoutMs));
  return Promise.race([run, timeout]);
}

/**
 * Chrome stops an idle extension worker after ~30s, which would kill a capture mid-way
 * (heavy pages take longer to load and read). A cheap API call every 20s keeps it alive
 * while — and only while — a capture the user started is running.
 */
function keepAlive() {
  const timer = setInterval(() => { chrome.runtime.getPlatformInfo().catch(() => {}); }, 20_000);
  return () => clearInterval(timer);
}

/** Same page, ignoring "www.", the hash and a trailing slash. */
function pageKey(u) {
  try {
    const x = new URL(u);
    return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '') || '/'}${x.search}`;
  } catch { return String(u); }
}

/** Wait until the tab shows the real page: if the site asks for its human check, the user does it there. */
async function waitForRealPage(tabId, site, report) {
  const started = Date.now();
  let state = await inTab(tabId, pageState, [], 20_000).catch(() => {
    throw new Error('Could not read the opened tab. Keep it open and try again.');
  });
  while (state?.challenge) {
    if (Date.now() - started > CHALLENGE_WAIT_MS) throw new Error('The site check was not completed in the opened tab');
    report('challenge', { site });
    await new Promise((r) => setTimeout(r, 2000));
    await waitForTabComplete(tabId, 15_000);
    state = await inTab(tabId, pageState, [], 20_000).catch(() => ({ challenge: true }));
  }
}

async function runCapture(msg, report) {
  const { url, jobId, token, apiBase, requestId } = msg;
  // The clone's own budget (Max pages / Depth chosen on clonyfy.com).
  const maxPages = Math.max(1, Math.min(60, parseInt(msg.maxPages, 10) || 1));
  const maxDepth = Math.max(1, Math.min(5, parseInt(msg.depth, 10) || 1));
  let api;
  try { api = new URL(apiBase).origin; } catch { throw new Error('Unknown Clonyfy address'); }
  if (!API_ORIGINS.includes(api)) throw new Error('Captures can only be sent to Clonyfy');
  if (!/^https?:\/\//i.test(url || '')) throw new Error('Invalid page address');
  const site = new URL(url).hostname;

  report('permission', { site });
  if (!(await ensureAllowed(url, requestId))) throw new Error('Permission to read this site was not given');

  report('opening');
  const tabId = await openSiteTab(url);
  // Heavy pages (ads, trackers) may never report "complete" — continue after 25s anyway.
  await waitForTabComplete(tabId, 25_000);

  // Pages: the start page, then its links (menus first) — breadth-first, up to the
  // clone's page budget and depth, all in the same tab the user is already verified in.
  const pages = [];
  const files = new Map(); // url → kind, shared by all pages
  const queue = [{ url, depth: 0 }];
  const seen = new Set([pageKey(url)]);
  while (queue.length && pages.length < maxPages) {
    const item = queue.shift();
    const n = pages.length + 1;
    if (pages.length) {
      report('next-page', { page: n, pages: maxPages, url: item.url });
      await new Promise((r) => setTimeout(r, 1200)); // a visitor's pace between pages
      await chrome.tabs.update(tabId, { url: item.url });
      await waitForTabComplete(tabId, 25_000);
    }
    await waitForRealPage(tabId, site, report);
    report('html', { page: n, pages: maxPages });
    const page = await inTab(tabId, readPage, [], 120_000).catch(() => null);
    if (!page?.domSnapshot) {
      if (!pages.length) throw new Error('Could not read the page');
      continue; // a later page failed: keep the ones already captured
    }
    // The site may redirect (e.g. to a page already captured) — keep each page once.
    if (pages.some((p) => pageKey(p.url) === pageKey(page.url))) continue;
    seen.add(pageKey(page.url));
    pages.push({ url: page.url, title: page.title, serverHtml: page.serverHtml, domSnapshot: page.domSnapshot, networkRecord: page.network });
    for (const f of page.files) if (!files.has(f.url)) files.set(f.url, f.kind);
    if (item.depth + 1 <= maxDepth) {
      for (const link of page.links || []) {
        const key = pageKey(link);
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ url: link, depth: item.depth + 1 });
      }
    }
  }

  // Files of every page, read in the page in batches (its own cache and session; nothing
  // new is requested from accounts).
  const list = [...files].map(([fileUrl, kind]) => ({ url: fileUrl, kind })).slice(0, MAX_FILES);
  const kinds = { css: 0, js: 0, assets: 0 };
  for (const f of list) kinds[f.kind === 'css' ? 'css' : f.kind === 'js' ? 'js' : 'assets']++;
  report('files', { total: list.length, pages: pages.length, ...kinds });
  const assets = [];
  let bytes = 0;
  for (let i = 0; i < list.length; i += 25) {
    const batch = list.slice(i, i + 25);
    const left = Math.max(0, MAX_TOTAL_BYTES - bytes);
    const read = await inTab(tabId, readFiles, [batch.map((f) => f.url), Math.min(MAX_FILE_BYTES, left)]).catch(() => []);
    for (const r of read || []) {
      if (r.data) bytes += Math.round(r.data.length * 0.75);
      assets.push(r);
    }
    const done = Math.min(list.length, i + batch.length);
    report(done === list.length ? 'files-done' : 'files', { done, total: list.length, pages: pages.length, ...kinds });
  }

  report('uploading', { pages: pages.length });
  const first = pages[0];
  const bundle = sanitizeBundle({
    url: first.url,
    title: first.title,
    capturedAt: new Date().toISOString(),
    serverHtml: first.serverHtml,
    domSnapshot: first.domSnapshot,
    assets,
    networkRecord: first.networkRecord,
    pages,
  });
  const res = await fetch(`${api}/api/helper/capture?job=${encodeURIComponent(jobId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Helper-Token': token },
    body: JSON.stringify(bundle),
    credentials: 'omit',
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `Upload failed (HTTP ${res.status})`);
  return { files: assets.length, read: assets.filter((x) => x.data).length, pages: pages.length };
}

/* ─────────────── Functions below run inside the site's tab (self-contained) ─────────────── */

/** Is the tab showing a bot check instead of the site? */
function pageState() {
  const title = document.title || '';
  const text = (document.body?.innerText || '').slice(0, 5000);
  const checkText = /press\s*(&|and)\s*hold|verify (that )?you('| a)re (a )?human|are you a (human|robot)|just a moment|checking (if the site connection is secure|your browser)|access to this page has been denied|please complete the security check|attention required|unusual traffic/i;
  const checkMarkup = !!document.querySelector('#px-captcha, [id^="px-captcha"], #challenge-form, #cf-challenge-running, iframe[src*="captcha"], iframe[src*="challenges.cloudflare.com"], [class*="captcha" i]');
  const challenge = (checkText.test(title + ' ' + text) || checkMarkup) && text.length < 4000;
  return { challenge, url: location.href };
}

/** Rendered page, its server HTML, its file list and the public data it rendered from. */
async function readPage() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // Wait until the page is quiet: no new requests and no DOM changes for `quietMs`.
  const settle = async (quietMs, maxMs) => {
    let last = Date.now();
    const mo = new MutationObserver(() => { last = Date.now(); });
    mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    let requests = performance.getEntriesByType('resource').length;
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      await wait(250);
      const now = performance.getEntriesByType('resource').length;
      if (now !== requests) { requests = now; last = Date.now(); }
      if (Date.now() - last >= quietMs) break;
    }
    mo.disconnect();
  };
  // Scroll through the page, pausing on each screen: widgets that render when they come
  // into view (and then fetch their data) get the time to do it.
  const step = Math.max(300, Math.floor(innerHeight * 0.8));
  const start = Date.now();
  for (let y = 0; y < document.documentElement.scrollHeight && Date.now() - start < 30_000; y += step) {
    scrollTo(0, y);
    await settle(400, 1800);
  }
  scrollTo(0, 0);
  await settle(1200, 8000);

  const sameOrigin = (u) => { try { return new URL(u, location.href).origin === location.origin; } catch { return false; } };
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return ''; } };

  // The main document as the site serves it (from this session — the check is already passed).
  let serverHtml = '';
  try {
    const r = await fetch(location.href, { credentials: 'include', cache: 'force-cache', headers: { Accept: 'text/html' } });
    if (r.ok && /html/i.test(r.headers.get('content-type') || '')) serverHtml = await r.text();
  } catch { /* the snapshot still works without it (offline preview) */ }

  // Every file the page loaded or references: styles, scripts, fonts, images, media.
  const files = new Map();
  const add = (u, kind) => {
    const url = abs(u);
    if (!/^https?:/i.test(url) || files.has(url)) return;
    files.set(url, kind);
  };
  const kindOf = (url, initiator) => {
    const path = url.split('?')[0].toLowerCase();
    if (/\.css$/.test(path) || initiator === 'css-file') return 'css';
    if (/\.m?js$/.test(path) || initiator === 'script') return 'js';
    if (/\.(woff2?|ttf|otf|eot)$/.test(path)) return 'font';
    return 'asset';
  };
  for (const e of performance.getEntriesByType('resource')) {
    if (e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest' || e.initiatorType === 'beacon') continue;
    add(e.name, kindOf(e.name, e.initiatorType));
  }
  document.querySelectorAll('link[rel~="stylesheet"][href]').forEach((l) => add(l.href, 'css'));
  document.querySelectorAll('link[rel~="preload"][href], link[rel~="modulepreload"][href], link[rel~="icon"][href], link[rel~="apple-touch-icon"][href]').forEach((l) => add(l.href, kindOf(l.href, l.getAttribute('as') === 'script' ? 'script' : '')));
  document.querySelectorAll('script[src]').forEach((s) => add(s.src, 'js'));
  document.querySelectorAll('img').forEach((img) => {
    if (img.currentSrc) add(img.currentSrc, 'asset');
    if (img.getAttribute('src')) add(img.getAttribute('src'), 'asset');
  });
  document.querySelectorAll('img[srcset], source[srcset]').forEach((el) => {
    for (const part of String(el.getAttribute('srcset')).split(/,\s+|(?<=\s[\d.]+[wxh]),/)) add(part.trim().split(/\s+/)[0], 'asset');
  });
  document.querySelectorAll('video[poster]').forEach((v) => add(v.getAttribute('poster'), 'asset'));
  document.querySelectorAll('[style*="url("]').forEach((el) => {
    for (const m of String(el.getAttribute('style')).matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) add(m[1], 'asset');
  });

  // Public data the page rendered from (its own JSON/text APIs), fetched WITHOUT cookies:
  // only what any visitor gets — never account-scoped responses.
  const network = [];
  const seen = new Set();
  for (const e of performance.getEntriesByType('resource')) {
    if (network.length >= 60) break;
    if (e.initiatorType !== 'fetch' && e.initiatorType !== 'xmlhttprequest') continue;
    if (!sameOrigin(e.name) || seen.has(e.name)) continue;
    seen.add(e.name);
    try {
      const r = await fetch(e.name, { credentials: 'omit', cache: 'force-cache' });
      const contentType = r.headers.get('content-type') || '';
      if (!/json|text\/plain/i.test(contentType)) continue;
      const body = await r.text();
      if (body.length > 2_000_000) continue;
      network.push({ method: 'GET', url: e.name, status: r.status, contentType, body });
    } catch { /* skip */ }
  }

  // CSS-in-JS libraries (styled-components, emotion…) insert their rules straight into the
  // browser's style engine, so <style> tags stay empty in the HTML — copying outerHTML
  // alone loses every style. Write each tag's live rules into a COPY of the page, plus
  // stylesheets created in JS (adoptedStyleSheets). The live page is never modified.
  // Shadow DOM (web components, micro-frontends) isn't part of outerHTML either: copy each
  // shadow root as declarative shadow DOM (<template shadowrootmode>), which the browser
  // turns back into the same shadow root when the clone loads. Closed roots are reachable
  // from the extension (chrome.dom). Same-origin frames are copied into srcdoc.
  const shadowOf = (el) => {
    if (el.shadowRoot) return el.shadowRoot;
    try { return globalThis.chrome?.dom?.openOrClosedShadowRoot?.(el) || null; } catch { return null; }
  };
  // `live` is a document or shadow root; `copyRoot` its copy (an element holding the copied nodes).
  const bake = (live, copyRoot, depth) => {
    const liveStyles = Array.from(live.querySelectorAll('style'));
    const copyStyles = Array.from(copyRoot.querySelectorAll('style'));
    if (liveStyles.length === copyStyles.length) {
      liveStyles.forEach((el, i) => {
        const rules = el.sheet ? rulesOf(el.sheet) : null;
        if (rules == null || rules.length <= (el.textContent || '').trim().length) return;
        copyStyles[i].textContent = rules;
        copyStyles[i].setAttribute('data-clonyfy-cssom', '');
      });
    }
    // JS-created stylesheets are added last, so the element lists below still line up.
    const addAdopted = () => {
      const adopted = (live.adoptedStyleSheets || []).map(rulesOf).filter(Boolean).join('\n');
      if (!adopted) return;
      const tag = document.createElement('style');
      tag.setAttribute('data-clonyfy-adopted', '');
      tag.textContent = adopted;
      (copyRoot.querySelector('head') || copyRoot).appendChild(tag);
    };
    if (depth > 12) { addAdopted(); return; }
    const liveEls = Array.from((live.documentElement || live).querySelectorAll('*'));
    const copyEls = Array.from(copyRoot.querySelectorAll('*'));
    if (liveEls.length !== copyEls.length) { addAdopted(); return; }
    liveEls.forEach((el, i) => {
      const target = copyEls[i];
      const root = shadowOf(el);
      if (root) {
        const holder = document.createElement('div');
        root.childNodes.forEach((n) => holder.appendChild(n.cloneNode(true)));
        bake(root, holder, depth + 1);
        const tpl = document.createElement('template');
        tpl.setAttribute('shadowrootmode', root.mode === 'closed' ? 'closed' : 'open');
        if (root.delegatesFocus) tpl.setAttribute('shadowrootdelegatesfocus', '');
        tpl.innerHTML = holder.innerHTML;
        target.prepend(tpl);
      }
      if (el.tagName === 'IFRAME') {
        try {
          const doc = el.contentDocument;
          if (doc?.documentElement && doc.location.href !== 'about:blank' && !target.hasAttribute('srcdoc')) {
            const inner = doc.documentElement.cloneNode(true);
            bake(doc, inner, depth + 1);
            target.setAttribute('srcdoc', `<!DOCTYPE html>${inner.outerHTML}`);
            target.setAttribute('data-clonyfy-frame', el.getAttribute('src') || '');
          }
        } catch { /* cross-origin frame: kept as a link to its source */ }
      }
    });
    addAdopted();
  };
  const rulesOf = (sheet) => {
    try { return Array.from(sheet.cssRules, (r) => r.cssText).join('\n'); } catch { return null; }
  };
  const copy = document.documentElement.cloneNode(true);
  bake(document, copy, 0);
  // Links to other pages of this site, for the next pages: header/menu links first, then
  // the rest in page order. Never sign-in/account pages, and never files.
  const bare = (h) => h.toLowerCase().replace(/^www\./, '');
  const skipPath = /\/(log-?in|sign-?in|sign-?up|register|logout|log-?out|account|my-?account|myzillow|profile|settings|cart|checkout|auth|oauth|password)(\/|$|\?)/i;
  const fileExt = /\.(pdf|zip|jpe?g|png|gif|webp|svg|mp4|mp3|docx?|xlsx?|pptx?|csv|xml|json|rss|ics)$/i;
  const links = [];
  const linkSeen = new Set();
  const anchors = [
    ...document.querySelectorAll('header a[href], nav a[href], [role="navigation"] a[href]'),
    ...document.querySelectorAll('main a[href]'),
    ...document.querySelectorAll('a[href]'),
  ];
  for (const a of anchors) {
    let u;
    try { u = new URL(a.getAttribute('href'), location.href); } catch { continue; }
    if (!/^https?:$/.test(u.protocol) || bare(u.hostname) !== bare(location.hostname)) continue;
    if (skipPath.test(u.pathname) || fileExt.test(u.pathname)) continue;
    u.hash = '';
    const key = u.pathname.replace(/\/+$/, '') + u.search;
    if (linkSeen.has(key) || u.href === location.href.split('#')[0]) continue;
    linkSeen.add(key);
    links.push(u.href);
    if (links.length >= 200) break;
  }

  const doctype = document.doctype ? `<!DOCTYPE ${document.doctype.name}>` : '<!DOCTYPE html>';
  return {
    links,
    url: location.href,
    title: document.title,
    serverHtml,
    domSnapshot: `${doctype}\n${copy.outerHTML}`,
    files: [...files].map(([url, kind]) => ({ url, kind })),
    network,
  };
}

/** Read files as base64 in the page. Cross-origin files without CORS come back without data (the server downloads those public files). */
async function readFiles(urls, maxBytes) {
  const toBase64 = (blob) => new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).replace(/^data:[^,]*,/, ''));
    fr.onerror = () => resolve('');
    fr.readAsDataURL(blob);
  });
  const out = [];
  await Promise.all(urls.map(async (url) => {
    const entry = { url, contentType: '' };
    try {
      const same = new URL(url).origin === location.origin;
      const r = await fetch(url, { credentials: same ? 'include' : 'omit', cache: 'force-cache', mode: 'cors' });
      entry.contentType = r.headers.get('content-type') || '';
      if (r.ok) {
        const blob = await r.blob();
        if (blob.size && blob.size <= maxBytes) entry.data = await toBase64(blob);
      }
    } catch { /* not readable here */ }
    out.push(entry);
  }));
  return out;
}
