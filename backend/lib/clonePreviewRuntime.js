/**
 * Browser runtimes injected into hosted clone previews and share pages.
 *
 * - Navigation: every link/button/form stays inside the clone. Cloned routes
 *   open the cloned page; missing/external targets open a modal with Go back
 *   (never leave for the live site).
 * - Interactions: replays menus/toggles recorded at capture time
 *   (#__clonyfy_interactions__) and emulates common UI patterns (aria-controls,
 *   tabs, Bootstrap, dialogs, carousels, hover submenus, hamburger menus)
 *   since original site JS is neutralized in previews.
 * - Animations: restarts CSS keyframe/marquee motion and replays scroll-entrance
 *   effects without the original framework JS.
 *
 * The in-page code is written as plain functions and serialized with
 * Function#toString, so it must not reference anything from this module.
 */

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/* ------------------------------------------------------------------ toast */

function installToast() {
  if (window.__clonyfyToast) return;
  var host = null;
  var box = null;
  var timer = 0;
  function ensure() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = '__clonyfy_toast_host__';
    host.setAttribute('data-clonyfy-ui', '');
    host.style.cssText = 'position:fixed;left:0;right:0;bottom:24px;z-index:2147483647;display:flex;justify-content:center;pointer-events:none;';
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var style = document.createElement('style');
    style.textContent = '.t{font:500 14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#fff;background:rgba(17,17,20,.95);'
      + 'border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:10px 16px;max-width:min(92vw,460px);'
      + 'box-shadow:0 10px 30px rgba(0,0,0,.35);opacity:0;transform:translateY(8px);transition:opacity .18s ease,transform .18s ease;text-align:center}'
      + '.t.on{opacity:1;transform:none}.s{display:block;margin-top:2px;font-weight:400;font-size:12px;color:rgba(255,255,255,.72);word-break:break-all}';
    box = document.createElement('div');
    box.className = 't';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    root.appendChild(style);
    root.appendChild(box);
    (document.body || document.documentElement).appendChild(host);
  }
  window.__clonyfyToast = function (title, detail) {
    try {
      ensure();
      box.textContent = '';
      box.appendChild(document.createTextNode(title));
      if (detail) {
        var s = document.createElement('span');
        s.className = 's';
        s.textContent = detail;
        box.appendChild(s);
      }
      requestAnimationFrame(function () { box.classList.add('on'); });
      clearTimeout(timer);
      timer = setTimeout(function () { box.classList.remove('on'); }, 2800);
    } catch (e) { /* ignore */ }
  };
}

/* ------------------------------------------------------ blocked-page modal */

function installBlockedModal() {
  if (window.__clonyfyBlockedModal) return;
  var host = null;
  var titleEl = null;
  var detailEl = null;
  var onBackCb = null;
  function ensure() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = '__clonyfy_blocked_modal__';
    host.setAttribute('data-clonyfy-ui', '');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483646;display:none;';
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var style = document.createElement('style');
    style.textContent = '.bg{position:absolute;inset:0;background:rgba(8,10,18,.55);backdrop-filter:blur(2px)}'
      + '.card{position:relative;margin:min(18vh,160px) auto 0;width:min(92vw,420px);background:#111318;color:#f4f4f5;'
      + 'border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:22px 22px 18px;box-shadow:0 24px 60px rgba(0,0,0,.45);'
      + 'font:500 15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}'
      + '.h{font-size:17px;font-weight:650;margin:0 0 6px;letter-spacing:-.01em}'
      + '.d{margin:0 0 18px;color:rgba(255,255,255,.68);font-weight:400;font-size:13px;word-break:break-all}'
      + '.row{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}'
      + 'button{appearance:none;border:0;border-radius:10px;padding:9px 14px;font:600 13px/1 system-ui,sans-serif;cursor:pointer}'
      + '.back{background:#fff;color:#111}.close{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.12)}';
    var bg = document.createElement('div');
    bg.className = 'bg';
    bg.addEventListener('click', function () { hide(); });
    var card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    titleEl = document.createElement('p');
    titleEl.className = 'h';
    detailEl = document.createElement('p');
    detailEl.className = 'd';
    var row = document.createElement('div');
    row.className = 'row';
    var backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'back';
    backBtn.textContent = 'Go back';
    backBtn.addEventListener('click', function () {
      var cb = onBackCb;
      hide();
      if (typeof cb === 'function') cb();
    });
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'close';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', function () { hide(); });
    row.appendChild(closeBtn);
    row.appendChild(backBtn);
    card.appendChild(titleEl);
    card.appendChild(detailEl);
    card.appendChild(row);
    root.appendChild(style);
    root.appendChild(bg);
    root.appendChild(card);
    (document.body || document.documentElement).appendChild(host);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && host && host.style.display === 'flex') hide();
    });
  }
  function hide() {
    if (!host) return;
    host.style.display = 'none';
    onBackCb = null;
  }
  window.__clonyfyBlockedModal = function (opts) {
    try {
      ensure();
      titleEl.textContent = (opts && opts.title) || 'This page is not cloned yet';
      detailEl.textContent = (opts && opts.detail) || '';
      onBackCb = opts && opts.onBack ? opts.onBack : null;
      host.style.display = 'block';
    } catch (e) { /* ignore */ }
  };
  window.__clonyfyBlockedModalHide = hide;
}

/* ------------------------------------------------------------- navigation */

function navigationRuntime(CFG) {
  if (window.__clonyfyNavRuntime) return;
  window.__clonyfyNavRuntime = true;
  var toast = window.__clonyfyToast || function () {};
  var isShare = CFG.mode === 'share';

  function norm(p) {
    var s = String(p == null ? '/' : p);
    try { s = decodeURIComponent(s); } catch (e) { /* keep raw */ }
    s = s.split('#')[0].split('?')[0].replace(/\/{2,}/g, '/');
    if (s.charAt(0) !== '/') s = '/' + s;
    s = s.replace(/\/index(?:\.html?)?$/i, '/').replace(/\.html?$/i, '');
    if (s.length > 1) s = s.replace(/\/+$/, '');
    return (s || '/').toLowerCase();
  }
  var routeIndex = {};
  for (var i = 0; i < CFG.routes.length; i++) {
    var key = norm(CFG.routes[i]);
    if (!Object.prototype.hasOwnProperty.call(routeIndex, key)) routeIndex[key] = CFG.routes[i];
  }

  var params = new URLSearchParams(location.search);
  var currentRoute = params.get('route') || CFG.defaultRoute || '/';
  var authQuery = '';
  if (!isShare) {
    var tok = params.get('access_token') || params.get('authToken');
    if (tok) authQuery = '&access_token=' + encodeURIComponent(tok);
  }
  function bareHost(h) { return String(h || '').toLowerCase().replace(/^www\./, ''); }
  var targetHost = '';
  try { targetHost = CFG.targetOrigin ? bareHost(new URL(CFG.targetOrigin).host) : ''; } catch (e) { /* ignore */ }
  var siteBase = (CFG.targetOrigin || location.origin) + (currentRoute.charAt(0) === '/' ? currentRoute : '/' + currentRoute);

  var nativePush = history.pushState;
  var nativeReplace = history.replaceState;
  var nativeOpen = window.open;

  function pageUrl(routeKey, hash) {
    return CFG.pageBase + encodeURIComponent(routeKey) + authQuery + (hash || '');
  }
  function newTabUrl(d) {
    if (isShare) return CFG.sharePathBase + (d.route === '/' ? '/' : d.route) + (d.hash || '');
    return d.url;
  }
  function lookup(route, hash) {
    var k = routeIndex[norm(route)];
    if (k == null) return { kind: 'missing', route: String(route).split('?')[0] || '/' };
    if (hash && norm(k) === norm(currentRoute)) return { kind: 'hash', hash: hash };
    return { kind: 'cloned', route: k, hash: hash || '', url: pageUrl(k, hash) };
  }
  function openNative(href) {
    var value = String(href || '').trim();
    if (!value) return;
    // Sandboxed preview iframes often block bare mailto:/tel: navigation — open via
    // window.open / top navigation so Contact us and phone links still work.
    try {
      var w = nativeOpen.call(window, value, '_blank', 'noopener');
      if (w) return;
    } catch (e) { /* ignore */ }
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = value;
        return;
      }
    } catch (e2) { /* cross-origin top */ }
    try { location.href = value; } catch (e3) { /* ignore */ }
  }
  function classify(raw) {
    var value = String(raw == null ? '' : raw).trim();
    if (!value || /^#!?$/.test(value) || /^javascript:/i.test(value)) return { kind: 'noop' };
    if (/^(mailto|tel|sms|data|blob):/i.test(value)) return { kind: 'native', href: value };
    if (value.charAt(0) === '#') return { kind: 'hash', hash: value };
    var url;
    try {
      // Clonyfy-served paths resolve against the API host; site links against the original page URL.
      url = /^\/(api|_assets|share)\//.test(value) ? new URL(value, location.origin) : new URL(value, siteBase);
    } catch (e) { return { kind: 'native' }; }
    if (!/^https?:$/.test(url.protocol)) return { kind: 'native' };
    var sameApi = url.origin === location.origin;
    if (sameApi && (url.pathname === '/api/page' || url.pathname === '/api/share-page')) {
      return lookup(url.searchParams.get('route') || '/', url.hash);
    }
    if (sameApi && /^\/(api|_assets|share)\//.test(url.pathname)) return { kind: 'native' };
    var sameSite = sameApi || (targetHost && bareHost(url.host) === targetHost);
    if (!sameSite) return { kind: 'external', host: url.host, href: url.href };
    return lookup(url.pathname + url.search, url.hash);
  }

  function scrollToHash(hash) {
    var id = String(hash || '').slice(1);
    try { id = decodeURIComponent(id); } catch (e) { /* keep raw */ }
    var el = id ? (document.getElementById(id) || document.getElementsByName(id)[0]) : null;
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else if (!id || id === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
    try { nativeReplace.call(history, history.state, '', location.pathname + location.search + hash); } catch (e) { /* ignore */ }
  }
  function notify(type, extra) {
    try {
      var msg = { type: type };
      for (var k in extra) msg[k] = extra[k];
      window.parent.postMessage(msg, '*');
    } catch (e) { /* ignore */ }
  }
  function syncShareUrl(d) {
    if (!isShare) return;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.history.replaceState(null, '', CFG.sharePathBase + (d.route === '/' ? '/' : d.route) + (d.hash || ''));
      }
    } catch (e) { /* ignore */ }
  }
  function go(d, newTab) {
    if (newTab) {
      nativeOpen.call(window, newTabUrl(d), '_blank', 'noopener');
      return;
    }
    notify('clonyfy-preview-nav', { route: d.route });
    syncShareUrl(d);
    location.href = d.url;
  }
  function goHomeOrBack() {
    try {
      if (window.history.length > 1) {
        history.back();
        return;
      }
    } catch (e) { /* ignore */ }
    var home = lookup(CFG.defaultRoute || '/', '');
    if (home.kind === 'cloned') go(home, false);
  }
  function explain(d) {
    var title = d.kind === 'external'
      ? 'External link \u2014 not cloned yet'
      : 'This page is not cloned yet';
    var detail = d.kind === 'external' ? (d.host || d.href || '') : (d.route || '');
    if (typeof window.__clonyfyBlockedModal === 'function') {
      window.__clonyfyBlockedModal({ title: title, detail: detail, onBack: goHomeOrBack });
    } else {
      toast(title, detail);
    }
    notify('clonyfy-preview-nav-blocked', { reason: d.kind, target: d.route || d.href || '' });
  }
  window.__clonyfyNav = { classify: classify, go: go, explain: explain, scrollToHash: scrollToHash, openNative: openNative };

  function inlineNavTarget(el) {
    var code = el.getAttribute && el.getAttribute('onclick');
    if (!code) return null;
    var m = code.match(/(?:location(?:\.href)?\s*=|location\.(?:assign|replace)\(|window\.open\()\s*['"]([^'"]+)['"]/);
    return m ? m[1] : null;
  }
  function linkFromEvent(e) {
    var t = e.target;
    if (!t || !t.closest) return null;
    if (t.closest('[data-clonyfy-ui]')) return null;
    var a = t.closest('a[href], area[href]');
    if (a) {
      return {
        href: a.getAttribute('href'),
        blank: /^_(blank|new)$/i.test(a.getAttribute('target') || ''),
        download: a.hasAttribute('download'),
      };
    }
    var d = t.closest('[data-href], [data-url], [data-link], [role="link"][href]');
    if (d) {
      return { href: d.getAttribute('data-href') || d.getAttribute('data-url') || d.getAttribute('data-link') || d.getAttribute('href') };
    }
    var n = t.closest('[onclick]');
    if (n) {
      var h = inlineNavTarget(n);
      if (h) return { href: h };
    }
    return null;
  }
  function onActivate(e, forceNewTab) {
    var link = linkFromEvent(e);
    if (!link) return;
    var d = classify(link.href);
    if (d.kind === 'native') {
      if (d.href && /^(mailto|tel|sms):/i.test(d.href)) {
        e.preventDefault();
        e.stopPropagation();
        openNative(d.href);
      }
      return;
    }
    if (link.download && /^\/(api|_assets)\//.test(String(link.href || ''))) return;
    if (d.kind === 'noop') {
      // "#" / javascript: links are usually JS buttons - let the interaction runtime handle them.
      e.preventDefault();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (d.kind === 'hash') { scrollToHash(d.hash); return; }
    if (d.kind === 'cloned') {
      go(d, forceNewTab || link.blank || e.metaKey || e.ctrlKey || e.shiftKey);
      return;
    }
    explain(d);
  }
  document.addEventListener('click', function (e) { onActivate(e, false); }, true);
  document.addEventListener('auxclick', function (e) { if (e.button === 1) onActivate(e, true); }, true);

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.getAttribute) return;
    e.preventDefault();
    e.stopPropagation();
    var method = String(form.getAttribute('method') || 'get').toLowerCase();
    var action = form.getAttribute('action');
    var d = action ? classify(action) : { kind: 'none' };
    if (d.kind === 'cloned' && method === 'get') { go(d, false); return; }
    if (method === 'get' && (d.kind === 'external' || d.kind === 'missing')) { explain(d); return; }
    toast('Form submission is not cloned yet', 'Forms are disabled in the cloned preview.');
  }, true);

  function wrapHistory(native) {
    return function (state, title, url) {
      if (url == null || url === '') return native.call(this, state, title);
      var d = classify(url);
      if (d.kind === 'hash') return native.call(this, state, title, location.pathname + location.search + d.hash);
      if (d.kind === 'cloned') {
        notify('clonyfy-preview-nav', { route: d.route });
        syncShareUrl(d);
        return native.call(this, state, title, d.url);
      }
      // Never point the address bar at a URL this preview can't serve.
      return native.call(this, state, title);
    };
  }
  history.pushState = wrapHistory(nativePush);
  history.replaceState = wrapHistory(nativeReplace);

  window.open = function (url, target, features) {
    if (url == null || url === '') return nativeOpen.apply(window, arguments);
    var d = classify(url);
    if (d.kind === 'native') return nativeOpen.apply(window, arguments);
    if (d.kind === 'cloned') return nativeOpen.call(window, newTabUrl(d), target || '_blank', features);
    if (d.kind === 'hash') { scrollToHash(d.hash); return null; }
    if (d.kind !== 'noop') explain(d);
    return null;
  };

  try {
    var L = window.Location && window.Location.prototype;
    if (L) {
      var nativeAssign = L.assign;
      var nativeLocReplace = L.replace;
      var guarded = function (native) {
        return function (url) {
          var d = classify(url);
          if (d.kind === 'native') return native.call(this, url);
          if (d.kind === 'cloned') return native.call(this, d.url);
          if (d.kind === 'hash') return scrollToHash(d.hash);
          if (d.kind !== 'noop') explain(d);
          return undefined;
        };
      };
      L.assign = guarded(nativeAssign);
      L.replace = guarded(nativeLocReplace);
    }
  } catch (e) { /* ignore */ }

  // Safety net (Chromium Navigation API): catches `location.href = ...` and any other
  // navigation the handlers above could not see.
  try {
    var navApi = window.navigation;
    if (navApi && typeof navApi.addEventListener === 'function') {
      navApi.addEventListener('navigate', function (e) {
        if (e.hashChange || e.downloadRequest != null) return;
        if (e.navigationType === 'reload' || e.navigationType === 'traverse') return;
        var dest;
        try { dest = new URL(e.destination.url); } catch (x) { return; }
        if (dest.origin === location.origin && /^\/(api|_assets|share)\//.test(dest.pathname)) return;
        var d = classify(dest.href);
        if (d.kind === 'native' || d.kind === 'noop') return;
        if (!e.cancelable) return;
        e.preventDefault();
        if (d.kind === 'cloned') { go(d, false); return; }
        if (d.kind === 'hash') { scrollToHash(d.hash); return; }
        explain(d);
      });
    }
  } catch (e) { /* ignore */ }
}

/* ----------------------------------------------------------- interactions */

function interactionRuntime() {
  if (window.__clonyfyIxRuntime) return;
  window.__clonyfyIxRuntime = true;
  var toast = window.__clonyfyToast || function () {};
  var handled = typeof WeakSet === 'function' ? new WeakSet() : null;
  function markHandled(e) { try { if (handled) handled.add(e); } catch (x) { /* ignore */ } }
  function wasHandled(e) { try { return !!(handled && handled.has(e)); } catch (x) { return false; } }

  /* Mutation noise tracker: tickers/carousels mutate constantly; ignore them when
     deciding whether a click "did something". */
  var lastMutated = typeof WeakMap === 'function' ? new WeakMap() : null;
  var clickWatch = null;
  try {
    new MutationObserver(function (list) {
      var now = Date.now();
      for (var i = 0; i < list.length; i++) {
        var t = list[i].target;
        if (t && t.closest && t.closest('[data-clonyfy-ui]')) continue;
        if (t && t.nodeType === 3 && t.parentElement && t.parentElement.closest('[data-clonyfy-ui]')) continue;
        var prev = lastMutated ? lastMutated.get(t) : 0;
        if (clickWatch && (!prev || now - prev > 1500) && now >= clickWatch.since) clickWatch.changed = true;
        if (lastMutated) lastMutated.set(t, now);
      }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  } catch (e) { /* ignore */ }

  function isHidden(el) {
    if (!el || !el.isConnected) return true;
    if (el.hidden) return true;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return true;
    var r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) return true;
    return r.height < 1 && (cs.overflow === 'hidden' || cs.overflowY === 'hidden');
  }

  var saved = typeof WeakMap === 'function' ? new WeakMap() : null;
  function reveal(el) {
    if (!el) return;
    if (saved && !saved.has(el)) {
      saved.set(el, {
        style: el.getAttribute('style'),
        hidden: el.hasAttribute('hidden'),
        ariaHidden: el.getAttribute('aria-hidden'),
        state: el.getAttribute('data-state'),
        inert: el.hasAttribute('inert'),
      });
    }
    el.removeAttribute('hidden');
    el.removeAttribute('inert');
    if (el.getAttribute('aria-hidden') === 'true') el.setAttribute('aria-hidden', 'false');
    if (el.hasAttribute('data-state')) el.setAttribute('data-state', 'open');
    var cs = getComputedStyle(el);
    if (cs.display === 'none') el.style.setProperty('display', 'block', 'important');
    if (cs.visibility === 'hidden') el.style.setProperty('visibility', 'visible', 'important');
    if (parseFloat(cs.opacity) < 0.05) el.style.setProperty('opacity', '1', 'important');
    if (cs.pointerEvents === 'none') el.style.setProperty('pointer-events', 'auto', 'important');
    var r = el.getBoundingClientRect();
    if (r.height < 1 && (cs.overflow === 'hidden' || cs.overflowY === 'hidden' || cs.maxHeight === '0px')) {
      el.style.setProperty('max-height', 'none', 'important');
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
    }
  }
  function conceal(el) {
    if (!el) return;
    var s = saved ? saved.get(el) : null;
    if (!s) {
      el.setAttribute('hidden', '');
      if (el.hasAttribute('data-state')) el.setAttribute('data-state', 'closed');
      return;
    }
    if (s.style == null) el.removeAttribute('style'); else el.setAttribute('style', s.style);
    if (s.hidden) el.setAttribute('hidden', '');
    if (s.ariaHidden == null) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', s.ariaHidden);
    if (s.state == null) el.removeAttribute('data-state'); else el.setAttribute('data-state', s.state);
    if (s.inert) el.setAttribute('inert', '');
    saved.delete(el);
  }
  function isRealLink(el) {
    if (!el || el.tagName !== 'A') return false;
    var h = String(el.getAttribute('href') || '').trim();
    return !!h && !/^#/.test(h) && !/^javascript:/i.test(h);
  }

  /* ---- recorded nav menus (captured on the live site) ---- */
  var data = null;
  try {
    var dataEl = document.getElementById('__clonyfy_interactions__');
    if (dataEl) data = JSON.parse(dataEl.textContent || 'null');
  } catch (e) { data = null; }
  var items = (data && data.items) || [];
  var open = {};

  function refEl(ref, trigger) {
    if (ref === 'html') return document.documentElement;
    if (ref === 'body') return document.body;
    if (ref === 'head') return document.head;
    if (ref === 'self') return trigger;
    if (typeof ref === 'string' && ref.indexOf('t:') === 0) {
      return document.querySelector('[data-clonyfy-ixt="' + ref.slice(2) + '"]');
    }
    return null;
  }
  function setAttr(el, name, value) {
    // Recordings from older clones may carry animation-driven inline styles on
    // <html>/<body> (e.g. rotateX(4140deg)) that flip the whole page.
    if (name === 'style' && (el === document.documentElement || el === document.body)) return;
    try { if (value === null) el.removeAttribute(name); else el.setAttribute(name, value); } catch (e) { /* ignore */ }
  }
  function closeItem(id) {
    var st = open[id];
    if (!st) return;
    clearTimeout(st.timer);
    var ops = st.item.ops;
    for (var i = ops.length - 1; i >= 0; i--) {
      var op = ops[i];
      var el;
      if (op.k === 'attr') {
        el = refEl(op.t, st.trigger);
        if (el) setAttr(el, op.n, op.off);
      } else if (op.k === 'cls') {
        el = refEl(op.t, st.trigger);
        if (el) {
          for (var a = 0; a < op.a.length; a++) el.classList.remove(op.a[a]);
          for (var r = 0; r < op.r.length; r++) el.classList.add(op.r[r]);
        }
      }
    }
    for (var n = 0; n < st.added.length; n++) st.added[n].remove();
    delete open[id];
  }
  function closeAll(except) {
    for (var id in open) if (String(id) !== String(except)) closeItem(id);
  }
  function inZones(st, node) {
    if (!node) return false;
    for (var i = 0; i < st.zones.length; i++) if (st.zones[i] && st.zones[i].contains(node)) return true;
    return false;
  }
  /* Floating-UI panels carry absolute coordinates from the live capture (often
     from a scrolled/transformed page) — re-anchor them under the current menu root. */
  function placeFloating(nodes, anchor) {
    if (!anchor || !anchor.getBoundingClientRect) return;
    var r = anchor.getBoundingClientRect();
    var sx = window.scrollX || window.pageXOffset || 0;
    var sy = window.scrollY || window.pageYOffset || 0;
    for (var n = 0; n < nodes.length; n++) {
      var node = nodes[n];
      if (!node || !node.querySelectorAll) continue;
      var list = Array.prototype.slice.call(node.querySelectorAll('[style*="--position-y"]'));
      if (node.getAttribute && /--position-y/.test(node.getAttribute('style') || '')) list.unshift(node);
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        var fixed = getComputedStyle(el).position === 'fixed';
        el.style.setProperty('--position-x', Math.round(r.left + (fixed ? 0 : sx)) + 'px');
        el.style.setProperty('--position-y', Math.round(r.bottom + (fixed ? 0 : sy)) + 'px');
        el.style.setProperty('--anchor-width', Math.round(r.width) + 'px');
        el.style.setProperty('--anchor-height', Math.round(r.height) + 'px');
        el.style.setProperty('--root-width', Math.round(r.width) + 'px');
        el.style.setProperty('--root-height', Math.round(r.height) + 'px');
        el.style.setProperty('--available-width', window.innerWidth + 'px');
        el.style.setProperty('--available-height', Math.max(0, Math.round(window.innerHeight - r.bottom)) + 'px');
      }
      // Panels recorded with baked top/left (e.g. remakeit language menu) ignore
      // Floating UI vars — pin them under the trigger in the current preview.
      var styleAttr = node.getAttribute('style') || '';
      var cs = getComputedStyle(node);
      if ((cs.position === 'fixed' || cs.position === 'absolute')
        && (/(\s|^)(top|left)\s*:/.test(styleAttr) || node.style.top || node.style.left)) {
        var width = node.getBoundingClientRect().width || parseFloat(cs.minWidth) || 180;
        var top;
        var left;
        if (cs.position === 'fixed') {
          top = Math.round(r.bottom + 8);
          left = Math.round(r.left + r.width / 2 - width / 2);
          left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
        } else {
          top = Math.round(r.bottom + sy + 8);
          left = Math.round(r.left + sx + r.width / 2 - width / 2);
        }
        node.style.top = top + 'px';
        node.style.left = left + 'px';
        node.style.right = 'auto';
        node.style.marginLeft = '0';
        node.style.transform = 'none';
        node.style.opacity = '1';
      }
    }
  }

  /* Language switcher buttons are plain <button>s in recordings — map labels to
     locale routes so preview can navigate (or show “not cloned”) instead of a dead toast.
     Labels are often localized (Inglese, Français, …), not only English names. */
  function wireLocaleButtons(nodes) {
    var LOCALE_CODES = { en: 1, fr: 1, es: 1, it: 1, de: 1, pt: 1, nl: 1, ja: 1, zh: 1, pl: 1, ru: 1, ko: 1, ar: 1, tr: 1, sv: 1, da: 1, fi: 1, no: 1, cs: 1, hu: 1, ro: 1, uk: 1 };
    var LOCALE_BY_LABEL = {
      // English UI
      english: 'en', en: 'en',
      french: 'fr', fr: 'fr',
      spanish: 'es', es: 'es',
      italian: 'it', it: 'it',
      german: 'de', de: 'de',
      portuguese: 'pt', pt: 'pt',
      dutch: 'nl', nl: 'nl',
      japanese: 'ja', ja: 'ja',
      chinese: 'zh', zh: 'zh',
      // Italian UI (Francese / Inglese / Spagnolo / Italiano / Tedesco)
      inglese: 'en', francese: 'fr', spagnolo: 'es', italiano: 'it', tedesco: 'de',
      // French UI
      anglais: 'en', francais: 'fr', 'français': 'fr', espagnol: 'es', italien: 'it', allemand: 'de',
      // Spanish UI
      ingles: 'en', 'inglés': 'en', frances: 'fr', 'francés': 'fr', espanol: 'es', 'español': 'es',
      italiano: 'it', aleman: 'de', 'alemán': 'de',
      // German UI
      englisch: 'en', franzoesisch: 'fr', 'französisch': 'fr', spanisch: 'es', italienisch: 'it', deutsch: 'de',
    };
    // Prefer switching the same path under another locale when possible.
    var curPath = '/';
    try {
      var route = new URL(location.href).searchParams.get('route') || '/';
      curPath = route;
    } catch (e) { /* ignore */ }
    function localePath(code) {
      var segs = String(curPath || '/').split('/').filter(Boolean);
      if (segs.length && LOCALE_CODES[segs[0].toLowerCase()]) segs = segs.slice(1);
      if (!code || code === 'en') return segs.length ? '/' + segs.join('/') : '/';
      return '/' + code + (segs.length ? '/' + segs.join('/') : '');
    }
    function normLabel(s) {
      return String(s || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // français → francais
    }
    for (var n = 0; n < nodes.length; n++) {
      var root = nodes[n];
      if (!root || !root.querySelectorAll) continue;
      var buttons = root.querySelectorAll('button');
      for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        if (btn.getAttribute('data-href') || btn.getAttribute('href')) continue;
        var label = normLabel(btn.textContent);
        // Skip close (X) / icon-only controls.
        if (!label || label.length > 24) continue;
        var code = LOCALE_BY_LABEL[label];
        if (!code) continue;
        btn.setAttribute('data-href', localePath(code));
        btn.setAttribute('role', 'link');
      }
    }
  }
  /* Portaled panels are often serialized mid-transition (data-status="close"),
     which their CSS clips away — show them in the open state. */
  function markOpen(nodes) {
    for (var n = 0; n < nodes.length; n++) {
      var node = nodes[n];
      if (!node.querySelectorAll) continue;
      var list = Array.prototype.slice.call(node.querySelectorAll('[data-status],[data-state]'));
      list.unshift(node);
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        var s = el.getAttribute('data-status');
        if (s === 'close' || s === 'closed' || s === 'closing') el.setAttribute('data-status', 'open');
        var st = el.getAttribute('data-state');
        if (st === 'closed' || st === 'closing') el.setAttribute('data-state', 'open');
      }
    }
  }
  function openItem(item, trigger) {
    if (open[item.i]) return;
    for (var id in open) {
      if (!inZones(open[id], trigger)) closeItem(id);
    }
    var added = [];
    var anchor = null;
    var zones = [trigger];
    var li = trigger.closest('li');
    if (li) zones.push(li);
    for (var i = 0; i < item.ops.length; i++) {
      var op = item.ops[i];
      var el;
      if (op.k === 'attr' || op.k === 'cls') {
        el = refEl(op.t, trigger);
        if (!el) continue;
        if (op.k === 'attr') setAttr(el, op.n, op.on);
        else {
          for (var r = 0; r < op.r.length; r++) el.classList.remove(op.r[r]);
          for (var a = 0; a < op.a.length; a++) el.classList.add(op.a[a]);
        }
        if (el !== document.documentElement && el !== document.body) {
          if (!el.contains(trigger)) zones.push(el);
          else if (!anchor && el !== trigger) anchor = el;
        }
      } else if (op.k === 'add') {
        var parent = refEl(op.p, trigger);
        if (!parent) continue;
        var tpl = document.createElement('template');
        tpl.innerHTML = op.h;
        var node = tpl.content.firstElementChild;
        if (!node) continue;
        node.setAttribute('data-clonyfy-ix-added', String(item.i));
        var before = op.b ? refEl(op.b, trigger) : null;
        if (before && before.parentNode === parent) parent.insertBefore(node, before);
        else parent.appendChild(node);
        added.push(node);
        if (node.tagName !== 'STYLE') zones.push(node);
      }
    }
    if (added.length) {
      placeFloating(added, trigger);
      markOpen(added);
      wireLocaleButtons(added);
    }
    open[item.i] = { item: item, trigger: trigger, added: added, zones: zones, timer: 0, at: Date.now() };
  }
  function scheduleClose(id, delay) {
    var st = open[id];
    if (!st || st.timer) return;
    st.timer = setTimeout(function () { closeItem(id); }, delay);
  }

  items.forEach(function (item) {
    var trigger = document.querySelector('[data-clonyfy-ix="' + item.i + '"]');
    if (!trigger) return;
    if (item.ev === 'hover') {
      trigger.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'touch') return;
        var st = open[item.i];
        if (st) { clearTimeout(st.timer); st.timer = 0; return; }
        openItem(item, trigger);
      });
      trigger.addEventListener('focusin', function () { openItem(item, trigger); });
    }
    trigger.addEventListener('click', function (e) {
      // Real links on hover-menus navigate (handled by the navigation runtime).
      if (item.ev === 'hover' && isRealLink(trigger.closest('a'))) return;
      e.preventDefault();
      markHandled(e);
      var cur = open[item.i];
      // Hover menus are opened by the pointer on the way to the click; leaving,
      // clicking outside or Escape closes them.
      if (cur && item.ev === 'hover' && Date.now() - cur.at < 600) { clearTimeout(cur.timer); cur.timer = 0; return; }
      if (cur && item.ev === 'hover' && e.pointerType !== 'touch' && e.detail > 0) { clearTimeout(cur.timer); cur.timer = 0; return; }
      if (cur) closeItem(item.i);
      else openItem(item, trigger);
    });
  });

  if (items.length) {
    document.addEventListener('pointermove', function (e) {
      for (var id in open) {
        var st = open[id];
        if (st.item.ev !== 'hover') continue;
        if (inZones(st, e.target)) { clearTimeout(st.timer); st.timer = 0; }
        else scheduleClose(id, 220);
      }
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () {
      for (var id in open) if (open[id].item.ev === 'hover') scheduleClose(id, 220);
    });
    document.addEventListener('focusin', function (e) {
      for (var id in open) if (!inZones(open[id], e.target)) closeItem(id);
    });
  }

  /* ---- Bootstrap ---- */
  function bsTarget(el) {
    var sel = el.getAttribute('data-bs-target') || el.getAttribute('data-target') || el.getAttribute('href') || '';
    if (!sel || sel === '#') return null;
    try { return document.querySelector(sel); } catch (e) { return null; }
  }
  var backdrop = null;
  function showModal(m) {
    m.style.display = 'block';
    m.classList.add('show');
    m.removeAttribute('aria-hidden');
    m.setAttribute('aria-modal', 'true');
    document.body.classList.add('modal-open');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop fade show';
      document.body.appendChild(backdrop);
    }
  }
  function hideModal(m) {
    m.style.display = '';
    m.classList.remove('show');
    m.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (backdrop) { backdrop.remove(); backdrop = null; }
  }
  function closeBsDropdowns(except) {
    document.querySelectorAll('.dropdown-menu.show').forEach(function (m) {
      if (m === except) return;
      m.classList.remove('show');
      var t = m.parentElement && m.parentElement.querySelector('[data-bs-toggle="dropdown"],[data-toggle="dropdown"]');
      if (t) { t.classList.remove('show'); t.setAttribute('aria-expanded', 'false'); }
    });
  }
  function bootstrap(el, kind) {
    var t;
    var isOpen;
    if (kind === 'collapse') {
      t = bsTarget(el);
      if (!t) return false;
      isOpen = !t.classList.contains('show');
      t.classList.toggle('show', isOpen);
      el.classList.toggle('collapsed', !isOpen);
      el.setAttribute('aria-expanded', String(isOpen));
      return true;
    }
    if (kind === 'dropdown') {
      var menu = (el.parentElement && el.parentElement.querySelector('.dropdown-menu')) || el.nextElementSibling;
      if (!menu) return false;
      isOpen = !menu.classList.contains('show');
      closeBsDropdowns(menu);
      menu.classList.toggle('show', isOpen);
      el.classList.toggle('show', isOpen);
      el.setAttribute('aria-expanded', String(isOpen));
      return true;
    }
    if (kind === 'modal') {
      t = bsTarget(el);
      if (!t) return false;
      showModal(t);
      return true;
    }
    if (kind === 'offcanvas') {
      t = bsTarget(el);
      if (!t) return false;
      isOpen = !t.classList.contains('show');
      t.classList.toggle('show', isOpen);
      t.style.visibility = isOpen ? 'visible' : '';
      return true;
    }
    if (kind === 'tab' || kind === 'pill' || kind === 'list') {
      var nav = el.closest('.nav, .list-group, [role="tablist"]') || el.parentElement;
      if (nav) {
        nav.querySelectorAll('.active').forEach(function (x) {
          if (x.matches('[data-bs-toggle],[data-toggle],.nav-link,.list-group-item')) x.classList.remove('active');
        });
      }
      el.classList.add('active');
      t = bsTarget(el);
      if (t && t.parentElement) {
        Array.prototype.forEach.call(t.parentElement.children, function (p) {
          if (p.classList.contains('tab-pane')) p.classList.remove('active', 'show');
        });
        t.classList.add('active', 'show');
      }
      return true;
    }
    return false;
  }

  /* ---- ARIA tabs / disclosures ---- */
  function activateTab(tab) {
    var list = tab.closest('[role="tablist"]') || tab.parentElement;
    var tabs = list ? list.querySelectorAll('[role="tab"]') : [tab];
    var activeClass = null;
    Array.prototype.forEach.call(tabs, function (t) {
      ['active', 'is-active', 'selected', 'is-selected', 'current'].forEach(function (c) {
        if (!activeClass && t.classList.contains(c)) activeClass = c;
      });
    });
    Array.prototype.forEach.call(tabs, function (t) {
      var sel = t === tab;
      t.setAttribute('aria-selected', sel ? 'true' : 'false');
      if (t.hasAttribute('data-state')) t.setAttribute('data-state', sel ? 'active' : 'inactive');
      if (activeClass) t.classList.toggle(activeClass, sel);
      var pid = t.getAttribute('aria-controls');
      var panel = pid ? document.getElementById(pid) : null;
      if (!panel) return;
      if (sel) reveal(panel); else conceal(panel);
      if (panel.hasAttribute('data-state')) panel.setAttribute('data-state', sel ? 'active' : 'inactive');
    });
  }
  function toggleControlled(trigger, target) {
    var expanded = trigger.getAttribute('aria-expanded');
    var makeOpen = expanded === 'true' ? false : (expanded === 'false' ? true : isHidden(target));
    if (makeOpen) reveal(target); else conceal(target);
    if (trigger.hasAttribute('aria-expanded')) trigger.setAttribute('aria-expanded', makeOpen ? 'true' : 'false');
    if (trigger.hasAttribute('data-state')) trigger.setAttribute('data-state', makeOpen ? 'open' : 'closed');
  }

  /* ---- hamburger / mobile menu ---- */
  var BURGER_RE = /(hamburger|burger|menu|navigation|nav-?toggle|navbar-?toggler|drawer|mobile-?nav|toggle-?nav|open nav)/i;
  function burgerMenuFor(btn) {
    var label = [
      btn.getAttribute('aria-label'), btn.getAttribute('title'), btn.id,
      typeof btn.className === 'string' ? btn.className : '',
      (btn.textContent || '').trim().slice(0, 30),
    ].join(' ');
    if (!BURGER_RE.test(label)) return null;
    var scope = btn.closest('header, nav, [role="banner"]') || document.body;
    var sel = 'nav, [role="dialog"], [role="menu"], [class*="menu" i], [class*="drawer" i], [class*="mobile" i], [id*="menu" i], [id*="nav" i], ul';
    var scopes = scope === document.body ? [document.body] : [scope, document.body];
    for (var s = 0; s < scopes.length; s++) {
      var cands = scopes[s].querySelectorAll(sel);
      for (var i = 0; i < cands.length; i++) {
        var c = cands[i];
        if (c === btn || c.contains(btn) || btn.contains(c)) continue;
        if (c.querySelectorAll('a[href]').length < 2) continue;
        if (!isHidden(c)) continue;
        return c;
      }
    }
    return null;
  }
  var burgerOpen = typeof WeakMap === 'function' ? new WeakMap() : null;

  /* ---- hover submenus driven by site JS ---- */
  var hoverOpen = null;
  var hoverTimer = 0;
  function closeHover() {
    if (!hoverOpen) return;
    conceal(hoverOpen.sub);
    hoverOpen = null;
  }
  function hiddenSubmenu(li) {
    if (li.querySelector('[data-clonyfy-ix]')) return null;
    for (var i = 0; i < li.children.length; i++) {
      var c = li.children[i];
      if (!/^(UL|OL|DIV|SECTION|NAV)$/.test(c.tagName) && c.getAttribute('role') !== 'menu') continue;
      if (!c.querySelector('a[href]')) continue;
      if (isHidden(c)) return c;
    }
    return null;
  }
  document.addEventListener('pointerover', function (e) {
    if (e.pointerType === 'touch') return;
    var t = e.target;
    if (!t || !t.closest) return;
    if (hoverOpen) {
      if (hoverOpen.li.contains(t)) { clearTimeout(hoverTimer); hoverTimer = 0; return; }
      if (!hoverTimer) hoverTimer = setTimeout(function () { hoverTimer = 0; closeHover(); }, 200);
    }
    var li = t.closest('nav li, header li, [role="menubar"] > li, [role="menubar"] > [role="none"]');
    if (!li || (hoverOpen && hoverOpen.li === li)) return;
    requestAnimationFrame(function () {
      if (!li.matches(':hover')) return;
      var sub = hiddenSubmenu(li);
      if (!sub) return;
      closeHover();
      clearTimeout(hoverTimer);
      hoverTimer = 0;
      reveal(sub);
      hoverOpen = { li: li, sub: sub };
    });
  });

  /* ---- dialog / popover / accordion / carousel heuristics ---- */
  function findDialogFor(trigger) {
    var labelled = trigger.getAttribute('aria-controls');
    if (labelled) {
      var byId = document.getElementById(String(labelled).split(/\s+/)[0]);
      if (byId) return byId;
    }
    var href = trigger.getAttribute('href') || trigger.getAttribute('data-target') || trigger.getAttribute('data-bs-target') || '';
    if (href && href.charAt(0) === '#' && href.length > 1) {
      try {
        var byHref = document.querySelector(href);
        if (byHref) return byHref;
      } catch (e) { /* ignore */ }
    }
    var scope = trigger.closest('section, article, main, header, nav, form, div') || document.body;
    var dialogs = scope.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog, .modal, [class*="modal" i], [class*="dialog" i], [class*="popover" i], [data-radix-portal], [data-state="closed"]');
    for (var i = 0; i < dialogs.length; i++) {
      var d = dialogs[i];
      if (d === trigger || d.contains(trigger)) continue;
      if (isHidden(d) || d.getAttribute('data-state') === 'closed') return d;
    }
    return null;
  }
  function toggleDialog(trigger) {
    var d = findDialogFor(trigger);
    if (!d) return false;
    var openNow = !isHidden(d) && d.getAttribute('data-state') !== 'closed';
    if (openNow) {
      conceal(d);
      if (trigger.hasAttribute('aria-expanded')) trigger.setAttribute('aria-expanded', 'false');
      if (d.hasAttribute('data-state')) d.setAttribute('data-state', 'closed');
    } else {
      reveal(d);
      if (trigger.hasAttribute('aria-expanded')) trigger.setAttribute('aria-expanded', 'true');
      if (d.hasAttribute('data-state')) d.setAttribute('data-state', 'open');
      if (d.tagName === 'DIALOG' && typeof d.showModal === 'function') {
        try { d.showModal(); } catch (e) { try { d.show(); } catch (x) { /* ignore */ } }
      }
    }
    return true;
  }
  function toggleAccordion(trigger) {
    var panel = null;
    var cid = trigger.getAttribute('aria-controls');
    if (cid) panel = document.getElementById(String(cid).split(/\s+/)[0]);
    if (!panel) {
      var next = trigger.nextElementSibling;
      if (next && (/accordion|panel|content|collapse|region/i.test(next.className || '') || next.getAttribute('role') === 'region')) {
        panel = next;
      }
    }
    if (!panel) {
      var parent = trigger.closest('[class*="accordion" i], details, [data-orientation]');
      if (parent) {
        panel = parent.querySelector('[role="region"], .accordion-panel, .accordion-content, [class*="content" i], [data-state]');
        if (panel === trigger || (panel && panel.contains(trigger))) panel = null;
      }
    }
    if (!panel || panel === trigger) return false;
    toggleControlled(trigger, panel);
    return true;
  }
  function advanceCarousel(btn, dir) {
    var root = btn.closest('[class*="carousel" i], [class*="slider" i], [class*="swiper" i], [data-carousel], [data-slider], [aria-roledescription*="carousel" i]');
    if (!root) return false;
    var slides = root.querySelectorAll('[class*="slide" i], [data-slide], [role="group"], .swiper-slide');
    if (slides.length < 2) return false;
    var idx = -1;
    for (var i = 0; i < slides.length; i++) {
      var s = slides[i];
      var cs = getComputedStyle(s);
      var active = s.classList.contains('active') || s.classList.contains('is-active') || s.classList.contains('swiper-slide-active')
        || s.getAttribute('aria-hidden') === 'false' || s.getAttribute('data-state') === 'active'
        || (parseFloat(cs.opacity) > 0.5 && cs.visibility !== 'hidden');
      if (active) { idx = i; break; }
    }
    if (idx < 0) idx = 0;
    var next = (idx + (dir < 0 ? -1 : 1) + slides.length) % slides.length;
    for (var j = 0; j < slides.length; j++) {
      var slide = slides[j];
      var on = j === next;
      slide.classList.toggle('active', on);
      slide.classList.toggle('is-active', on);
      slide.classList.toggle('swiper-slide-active', on);
      if (on) {
        reveal(slide);
        slide.setAttribute('aria-hidden', 'false');
      } else {
        conceal(slide);
        slide.setAttribute('aria-hidden', 'true');
      }
    }
    return true;
  }
  function carouselDir(btn) {
    var label = [
      btn.getAttribute('aria-label'), btn.getAttribute('title'),
      typeof btn.className === 'string' ? btn.className : '',
      btn.id || '', (btn.textContent || '').trim().slice(0, 24),
    ].join(' ');
    if (/prev|previous|back|left/i.test(label) || btn.classList.contains('carousel-control-prev')) return -1;
    if (/next|forward|right/i.test(label) || btn.classList.contains('carousel-control-next')) return 1;
    return 0;
  }

  /* FAQ answers often exist only in JSON-LD — inject a panel on click when the
     captured DOM has the question button but no answer sibling (common SPA pattern). */
  var faqAnswers = null;
  function loadFaqAnswers() {
    if (faqAnswers) return faqAnswers;
    faqAnswers = {};
    function ingest(node) {
      if (!node) return;
      if (Array.isArray(node)) { node.forEach(ingest); return; }
      if (typeof node !== 'object') return;
      var entities = node.mainEntity;
      if ((!entities || !entities.length) && Array.isArray(node['@graph'])) {
        node['@graph'].forEach(ingest);
        return;
      }
      if (node['@type'] === 'FAQPage' && entities) { /* use entities below */ }
      else if (!entities || !entities.length) return;
      if (!Array.isArray(entities)) entities = [entities];
      for (var e = 0; e < entities.length; e++) {
        var q = entities[e];
        if (!q || !q.name) continue;
        var ans = q.acceptedAnswer && (q.acceptedAnswer.text || q.acceptedAnswer);
        if (typeof ans === 'string' && ans.trim()) {
          faqAnswers[String(q.name).replace(/\s+/g, ' ').trim().toLowerCase()] = ans.trim();
        }
      }
    }
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < scripts.length; i++) {
      try {
        ingest(JSON.parse(scripts[i].textContent || 'null'));
      } catch (err) { /* ignore bad JSON-LD */ }
    }
    return faqAnswers;
  }
  function toggleFaqFromSchema(btn) {
    var span = btn.querySelector('span');
    var qText = String((span && span.textContent) || btn.textContent || '').replace(/\s+/g, ' ').trim();
    // Plus-icon clicks still land on the question button via closest().
    if (!qText || qText.length < 8 || qText.length > 160) return false;
    if (!/[?？]$/.test(qText) && !/^(what|why|how|can|do|does|is|are|will|qui|quoi|comment|pourquoi|puedo|cosa)/i.test(qText)) {
      if (!btn.closest('[class*="faq" i], [class*="accordion" i], [class*="light-gray" i]')) return false;
    }
    var map = loadFaqAnswers();
    var answer = map[qText.toLowerCase()];
    if (!answer) return false;
    var wrap = btn.parentElement;
    if (!wrap) return false;
    var panel = wrap.querySelector('[data-clonyfy-faq-panel]');
    var plus = btn.querySelector('span.flex-shrink-0, span[class*="shrink"]');
    var vert = plus && plus.querySelector('span:last-child');
    if (panel) {
      var open = panel.style.display !== 'none';
      panel.style.display = open ? 'none' : 'block';
      if (vert) vert.style.opacity = open ? '1' : '0';
      return true;
    }
    panel = document.createElement('div');
    panel.setAttribute('data-clonyfy-faq-panel', '1');
    panel.style.cssText = 'padding:0 1.5rem 1.25rem;color:#333;font-size:0.95rem;line-height:1.5';
    panel.textContent = answer;
    wrap.appendChild(panel);
    if (vert) vert.style.opacity = '0';
    return true;
  }

  /* Monthly / Yearly (and similar) pill toggles — swap active styles when JS is gone. */
  function toggleSegmentedControl(btn) {
    var label = String(btn.textContent || '').replace(/\s+/g, ' ').trim();
    if (!/^(monthly|yearly|annual|annually|mensuel|mensuelle|annuel|annuelle|mensile|annuale|monatlich|jährlich|mensual|anual)$/i.test(label)) {
      return false;
    }
    var row = btn.parentElement;
    if (!row) return false;
    var buttons = row.querySelectorAll(':scope > button');
    if (buttons.length < 2 || buttons.length > 4) return false;
    var idx = Array.prototype.indexOf.call(buttons, btn);
    if (idx < 0) return false;
    var pill = row.querySelector('div[style*="position:absolute"], div[style*="position: absolute"]');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var on = b === btn;
      b.style.color = on ? '#fff' : '#9A999B';
      b.classList.toggle('text-white', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (pill && buttons.length === 2) {
      pill.style.width = pill.style.width || 'calc(50% - 4px)';
      pill.style.left = idx === 0 ? '4px' : '50%';
      pill.style.transition = pill.style.transition || 'left .2s ease';
    }
    // Soften/restore "Save 30%" hint under the toggle.
    var hint = row.parentElement && row.parentElement.querySelector('p');
    if (hint && /save|économ|risparm|spar/i.test(hint.textContent || '')) {
      var yearly = /year|annuel|annual|jähr|anual/i.test(label);
      hint.style.opacity = yearly ? '1' : '0.45';
    }
    return true;
  }

  /* Plan CTAs ("Choose plan") usually go to the hosted app — reuse a captured app data-href. */
  function activatePlanCta(btn) {
    var label = String(btn.textContent || '').replace(/\s+/g, ' ').trim();
    if (!/^(choose plan|choisir|choisissez|elige|elegir|scegli|plan wählen|get plan|select plan|prendre|s'abonner|subscribe)$/i.test(label)) {
      return false;
    }
    if (!window.__clonyfyNav) return false;
    var app = document.querySelector('[data-href*="app."], [data-href*="signup"], [data-href*="sign-up"], [data-href*="sign-in"], a[href*="app."], a[href*="signup"]');
    var href = app && (app.getAttribute('data-href') || app.getAttribute('data-url') || app.getAttribute('href'));
    if (!href) {
      toast('Plan checkout is not cloned yet', 'Checkout runs on the original site’s app, which is outside this clone.');
      return true;
    }
    var dest = window.__clonyfyNav.classify(href);
    if (dest.kind === 'cloned') window.__clonyfyNav.go(dest, false);
    else if (dest.kind === 'native' && dest.href) window.__clonyfyNav.openNative(dest.href);
    else if (dest.kind !== 'noop') window.__clonyfyNav.explain(dest);
    return true;
  }

  function activateContactCta(btn) {
    var label = String(btn.textContent || '').replace(/\s+/g, ' ').trim();
    if (!/^(contact us|contactez|contáctanos|contattaci|kontakt|nous contacter|get in touch)$/i.test(label)) {
      return false;
    }
    // Prefer a real mailto already on the page (Remakeit uses mailto:app@…).
    var mail = document.querySelector('a[href^="mailto:"]');
    var href = (btn.getAttribute && (btn.getAttribute('href') || btn.getAttribute('data-href'))) || (mail && mail.getAttribute('href'));
    if (href && /^mailto:/i.test(href) && window.__clonyfyNav && window.__clonyfyNav.openNative) {
      window.__clonyfyNav.openNative(href);
      return true;
    }
    if (href && window.__clonyfyNav) {
      var dest = window.__clonyfyNav.classify(href);
      if (dest.kind === 'cloned') window.__clonyfyNav.go(dest, false);
      else if (dest.kind === 'hash') window.__clonyfyNav.scrollToHash(dest.hash);
      else if (dest.kind === 'native' && dest.href) window.__clonyfyNav.openNative(dest.href);
      else if (dest.kind !== 'noop') window.__clonyfyNav.explain(dest);
      return true;
    }
    toast('Contact action is not cloned yet', 'No email or contact page was captured for this control.');
    return true;
  }

  /* ---- click dispatcher (bubble phase: recorded triggers run first) ---- */
  var BUTTON_SEL = 'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"], a[href="#"], a[href="#!"], a[href^="javascript:"], summary, [aria-haspopup], [data-state]';
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('[data-clonyfy-ui]')) return;

    for (var id in open) {
      if (!inZones(open[id], t)) closeItem(id);
    }
    if (!t.closest('.dropdown-menu, [data-bs-toggle="dropdown"], [data-toggle="dropdown"]')) closeBsDropdowns(null);
    if (wasHandled(e)) return;

    var el = t.closest('[data-bs-dismiss="modal"], [data-dismiss="modal"]');
    if (el) {
      var m = el.closest('.modal');
      if (m) { hideModal(m); e.preventDefault(); return; }
    }
    if (t.classList && t.classList.contains('modal') && t.classList.contains('show')) { hideModal(t); return; }

    el = t.closest('[data-bs-toggle], [data-toggle]');
    if (el && bootstrap(el, el.getAttribute('data-bs-toggle') || el.getAttribute('data-toggle'))) { e.preventDefault(); return; }

    el = t.closest('[role="tab"]');
    if (el) { activateTab(el); e.preventDefault(); return; }

    el = t.closest('summary');
    if (el) {
      // Native <details> handles open/close; just mark so the dead-button watcher stays quiet.
      markHandled(e);
      return;
    }

    el = t.closest('[aria-controls]');
    if (el && !isRealLink(el)) {
      var cid = String(el.getAttribute('aria-controls') || '').split(/\s+/)[0];
      var target = cid ? document.getElementById(cid) : null;
      if (target) { toggleControlled(el, target); e.preventDefault(); return; }
    }

    var btn = t.closest(BUTTON_SEL);
    if (!btn) return;
    if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
    if (btn.form && (btn.type === 'submit' || btn.type === 'reset')) return;
    if (btn.tagName !== 'A' && isRealLink(btn.closest('a'))) return;
    if (btn.closest('label')) return;

    var cdir = carouselDir(btn);
    if (cdir && advanceCarousel(btn, cdir)) { e.preventDefault(); return; }

    if (btn.getAttribute('aria-haspopup') === 'dialog' || btn.getAttribute('aria-haspopup') === 'true'
      || /modal|dialog|popup|popover/i.test(String(btn.className || '') + ' ' + (btn.getAttribute('aria-label') || ''))) {
      if (toggleDialog(btn)) { e.preventDefault(); return; }
    }

    if (/accordion|collapse|expand|disclosure/i.test(String(btn.className || '') + ' ' + (btn.getAttribute('aria-label') || ''))
      || btn.closest('[class*="accordion" i], [data-orientation="vertical"]')) {
      if (toggleAccordion(btn)) { e.preventDefault(); return; }
    }

    if (btn.hasAttribute('data-state') || btn.hasAttribute('aria-expanded')) {
      if (toggleAccordion(btn) || toggleDialog(btn)) { e.preventDefault(); return; }
    }

    // FAQ question rows (no aria-controls; answers live in JSON-LD only).
    if (toggleFaqFromSchema(btn)) { e.preventDefault(); markHandled(e); return; }

    // Billing period pill (Monthly / Yearly).
    if (toggleSegmentedControl(btn)) { e.preventDefault(); markHandled(e); return; }

    // Pricing plan CTAs.
    if (activatePlanCta(btn)) { e.preventDefault(); markHandled(e); return; }

    // Contact us (mailto often blocked inside the preview iframe).
    if (activateContactCta(btn)) { e.preventDefault(); markHandled(e); return; }

    var menu = burgerOpen ? burgerOpen.get(btn) : null;
    if (menu) {
      conceal(menu);
      burgerOpen.delete(btn);
      if (btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', 'false');
      e.preventDefault();
      return;
    }
    menu = burgerMenuFor(btn);
    if (menu) {
      reveal(menu);
      if (burgerOpen) burgerOpen.set(btn, menu);
      if (btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', 'true');
      e.preventDefault();
      return;
    }

    // Nothing above applied: if capture tagged a destination, navigate like a link.
    var hrefEl = btn.closest('[data-href], [data-url], [data-link]');
    if (hrefEl && window.__clonyfyNav) {
      var href = hrefEl.getAttribute('data-href') || hrefEl.getAttribute('data-url') || hrefEl.getAttribute('data-link');
      if (href) {
        var dest = window.__clonyfyNav.classify(href);
        e.preventDefault();
        markHandled(e);
        if (dest.kind === 'cloned') window.__clonyfyNav.go(dest, false);
        else if (dest.kind === 'hash') window.__clonyfyNav.scrollToHash(dest.hash);
        else if (dest.kind === 'native' && dest.href) window.__clonyfyNav.openNative(dest.href);
        else if (dest.kind !== 'noop') window.__clonyfyNav.explain(dest);
        return;
      }
    }

    // Common "back / return" controls are JS-only on SPAs — use preview history.
    var backLabel = String(btn.getAttribute('aria-label') || btn.textContent || '')
      .replace(/\s+/g, ' ').trim();
    if (/^(back|go back|return|previous|←|‹|retour|zurück|atras|indietro)$/i.test(backLabel)
      || /\b(back|retour)\b/i.test(String(btn.className || ''))
      || btn.getAttribute('data-action') === 'back') {
      e.preventDefault();
      markHandled(e);
      try {
        if (window.history.length > 1) history.back();
        else if (window.__clonyfyNav) {
          var home = window.__clonyfyNav.classify('/');
          if (home.kind === 'cloned') window.__clonyfyNav.go(home, false);
        }
      } catch (err) { /* ignore */ }
      return;
    }

    // Nothing above applied: tell the user instead of silently doing nothing.
    var scrollY = window.scrollY;
    clickWatch = { changed: false, since: Date.now() };
    var watch = clickWatch;
    setTimeout(function () {
      if (clickWatch === watch) clickWatch = null;
      if (!watch.changed && Math.abs(window.scrollY - scrollY) < 2) {
        toast("This button's action is not cloned yet", 'Interactive JS from the original site is disabled in the preview.');
      }
    }, 450);
  }, false);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeAll(null);
    closeHover();
    closeBsDropdowns(null);
    document.querySelectorAll('.modal.show').forEach(hideModal);
    if (typeof window.__clonyfyBlockedModalHide === 'function') window.__clonyfyBlockedModalHide();
  });
}

/* ------------------------------------------------------------- animations */

function animationRuntime() {
  if (window.__clonyfyAnimRuntime) return;
  window.__clonyfyAnimRuntime = true;

  function injectCss() {
    if (document.getElementById('__clonyfy_anim_css__')) return;
    var style = document.createElement('style');
    style.id = '__clonyfy_anim_css__';
    style.textContent = '@keyframes clonyfy-fade-up{from{opacity:0;transform:translate3d(0,28px,0)}to{opacity:1;transform:none}}'
      + '@keyframes clonyfy-fade-in{from{opacity:0}to{opacity:1}}'
      + '@keyframes clonyfy-fade-left{from{opacity:0;transform:translate3d(-28px,0,0)}to{opacity:1;transform:none}}'
      + '@keyframes clonyfy-fade-right{from{opacity:0;transform:translate3d(28px,0,0)}to{opacity:1;transform:none}}'
      + '@keyframes clonyfy-zoom-in{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}'
      + '@keyframes clonyfy-hero-wave-drift{0%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(-1.8%,1.2%,0) scale(1.025)}100%{transform:translate3d(0,0,0) scale(1)}}'
      + '@keyframes clonyfy-logo-marquee-scroll{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}'
      + '[data-clonyfy-anim].clonyfy-anim-run{animation-duration:.7s;animation-fill-mode:both;'
      + 'animation-timing-function:cubic-bezier(.22,.61,.36,1);will-change:opacity,transform}'
      + '[data-clonyfy-anim][data-clonyfy-anim="fade-up"].clonyfy-anim-run{animation-name:clonyfy-fade-up}'
      + '[data-clonyfy-anim][data-clonyfy-anim="fade-in"].clonyfy-anim-run{animation-name:clonyfy-fade-in}'
      + '[data-clonyfy-anim][data-clonyfy-anim="fade-left"].clonyfy-anim-run{animation-name:clonyfy-fade-left}'
      + '[data-clonyfy-anim][data-clonyfy-anim="fade-right"].clonyfy-anim-run{animation-name:clonyfy-fade-right}'
      + '[data-clonyfy-anim][data-clonyfy-anim="zoom-in"].clonyfy-anim-run{animation-name:clonyfy-zoom-in}'
      + '.marquee,.marquee-inner,[class*="marquee" i],[class*="ticker" i]{animation-play-state:running!important}'
      // Hero layering + live-like title colors (Stripe dual-title + hard-light blend).
      + '.hero-section-container,.hero-section__layout{isolation:auto!important}'
      + '.hero-section__background,.hero-wave-animation{z-index:1!important;pointer-events:none!important}'
      + '.hero-section__title--foreground,.hero-section__title--background,.hero-section__actions{position:relative!important;z-index:3!important}'
      + '.hero-section__title--foreground{display:block!important;visibility:visible!important;opacity:1!important;'
      + 'mix-blend-mode:hard-light!important;color:rgba(0,14,255,.5)!important}'
      + '.hero-section__title--foreground .hero-section__title-main{color:#2d2564!important}'
      + '.hero-section__title--foreground .hero-section__title-copy{color:rgba(0,14,255,.55)!important}'
      + '.hero-section__title--background .hero-section__title-main{color:#061b31!important}'
      + '.hero-section__title--background .hero-section__title-copy{color:#81b81a!important}'
      + '.hero-logo-wall-section,.hero-logo-section,.logo-carousel{position:relative!important;z-index:2!important}'
      + '.hero-wave-animation img[data-clonyfy-canvas-capture]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;object-fit:contain!important;object-position:70% center!important;'
      + 'animation:clonyfy-hero-wave-drift 14s ease-in-out infinite!important;transform-origin:70% 45%}'
      + '.hero-wave-animation__static img{animation:clonyfy-hero-wave-drift 16s ease-in-out infinite!important}'
      // Logo marquee (live Stripe uses JS translateX; clones often freeze as a static grid).
      + '.clonyfy-logo-marquee-host,.logo-carousel__marquee-container{overflow:hidden!important;width:100%!important}'
      + '.clonyfy-logo-marquee-track,.logo-carousel__marquee.clonyfy-logo-marquee-track{'
      + 'display:flex!important;flex-wrap:nowrap!important;align-items:center!important;'
      + 'width:max-content!important;max-width:none!important;grid-template-columns:none!important;'
      + 'gap:0!important;margin:0!important;padding:0!important;list-style:none!important;'
      + 'animation:clonyfy-logo-marquee-scroll 42s linear infinite!important;'
      + 'will-change:transform}'
      + '.clonyfy-logo-marquee-track>* , .logo-carousel__marquee.clonyfy-logo-marquee-track>*{'
      + 'flex:0 0 172px!important;width:172px!important;min-width:172px!important;height:72px!important;'
      + 'display:flex!important;align-items:center!important;justify-content:center!important;'
      + 'padding:0 12px!important;box-sizing:border-box!important}'
      + '.clonyfy-logo-marquee-track img,.clonyfy-logo-marquee-track svg,'
      + '.logo-carousel__marquee.clonyfy-logo-marquee-track img,.logo-carousel__marquee.clonyfy-logo-marquee-track svg{'
      + 'max-width:142px!important;max-height:34px!important;width:auto!important;height:auto!important}';
    (document.head || document.documentElement).appendChild(style);
  }

  /** Turn frozen logo grids / marquees into a continuous left scroll. */
  function installLogoMarquees() {
    // US-style carousel frozen mid-JS transform
    var liveTracks = document.querySelectorAll('.logo-carousel__marquee');
    for (var i = 0; i < liveTracks.length; i++) {
      var track = liveTracks[i];
      if (track.getAttribute('data-clonyfy-marquee') === '1') continue;
      track.setAttribute('data-clonyfy-marquee', '1');
      track.classList.add('clonyfy-logo-marquee-track');
      track.style.transform = 'none';
      var host = track.closest('.logo-carousel__marquee-container, .logo-carousel, .hero-logo-section');
      if (host) host.classList.add('clonyfy-logo-marquee-host');
      // Ensure enough content for a seamless -50% loop
      if (track.children.length > 0 && track.children.length < 24) {
        var original = Array.prototype.slice.call(track.children);
        for (var c = 0; c < original.length; c++) {
          var clone = original[c].cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');
          track.appendChild(clone);
        }
      }
    }

    // JP / static grid capture → single-row marquee
    var grids = document.querySelectorAll('.hero-logo-wall-section__grid');
    for (var g = 0; g < grids.length; g++) {
      var grid = grids[g];
      if (grid.getAttribute('data-clonyfy-marquee') === '1') continue;
      var cells = Array.prototype.slice.call(grid.children);
      if (cells.length < 4) continue;
      grid.setAttribute('data-clonyfy-marquee', '1');
      grid.classList.add('clonyfy-logo-marquee-track');
      var section = grid.closest('.hero-logo-wall-section, .section-container') || grid.parentElement;
      if (section) section.classList.add('clonyfy-logo-marquee-host');
      for (var k = 0; k < cells.length; k++) {
        var dup = cells[k].cloneNode(true);
        dup.setAttribute('aria-hidden', 'true');
        grid.appendChild(dup);
      }
    }
  }

  function reviveCssAnimations() {
    var nodes = document.querySelectorAll('body *');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      try {
        if (el.closest && el.closest('[data-clonyfy-ui]')) continue;
        var cs = getComputedStyle(el);
        var name = String(cs.animationName || '');
        if (!name || name === 'none') continue;
        if (String(cs.animationPlayState || '') === 'paused') {
          el.style.animationPlayState = 'running';
        }
        // Restart so loops frozen mid-capture keep moving.
        var prev = el.style.animation;
        el.style.animation = 'none';
        // force reflow
        void el.offsetWidth;
        el.style.animation = prev || '';
      } catch (e) { /* ignore */ }
    }
  }

  function aosKind(el) {
    var aos = (el.getAttribute('data-aos') || '').toLowerCase();
    if (!aos) {
      var framer = el.getAttribute('data-framer-appear-id') || el.getAttribute('data-framer-name') || '';
      if (framer) return 'fade-up';
      var cls = String(el.className || '').toLowerCase();
      if (/fade-?in|reveal|animate-in|slide-?up|slide-?in/.test(cls)) return 'fade-up';
      if (/slide-?left|from-left/.test(cls)) return 'fade-left';
      if (/slide-?right|from-right/.test(cls)) return 'fade-right';
      if (/zoom|scale-in/.test(cls)) return 'zoom-in';
      return '';
    }
    if (/fade-up|slide-up|fadeup|slideup/.test(aos)) return 'fade-up';
    if (/fade-down|slide-down/.test(aos)) return 'fade-up';
    if (/fade-left|slide-left|fadeleft/.test(aos)) return 'fade-left';
    if (/fade-right|slide-right|faderight/.test(aos)) return 'fade-right';
    if (/zoom|flip|scale/.test(aos)) return 'zoom-in';
    if (/fade/.test(aos)) return 'fade-in';
    return 'fade-up';
  }

  function inInitialViewport(el) {
    var r = el.getBoundingClientRect();
    return r.top < window.innerHeight * 0.92 && r.bottom > 0;
  }

  function tagEntranceTargets() {
    var sel = [
      '[data-aos]',
      '[data-framer-appear-id]',
      '[data-framer-name]',
      '.aos-init',
      '[class*="reveal" i]',
      '[class*="fade-in" i]',
      '[class*="animate-in" i]',
      '[class*="slide-up" i]',
      '[data-scroll]',
      '[data-animate]',
    ].join(',');
    var list = document.querySelectorAll(sel);
    var tagged = 0;
    for (var i = 0; i < list.length && tagged < 120; i++) {
      var el = list[i];
      if (el.hasAttribute('data-clonyfy-anim')) continue;
      if (el.closest && el.closest('[data-clonyfy-ui], script, style, noscript')) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      // Keep above-the-fold content visible; only replay entrance below the fold
      // (or for explicitly AOS-tagged nodes that want motion once).
      var kind = aosKind(el);
      if (!kind) continue;
      if (inInitialViewport(el) && !el.hasAttribute('data-aos') && !el.hasAttribute('data-framer-appear-id')) continue;
      el.setAttribute('data-clonyfy-anim', kind);
      var delay = el.getAttribute('data-aos-delay') || el.getAttribute('data-delay') || '';
      if (delay && /^\d+$/.test(delay)) el.style.animationDelay = (parseInt(delay, 10) / 1000) + 's';
      tagged++;
    }
  }

  function play(el) {
    if (!el || el.classList.contains('clonyfy-anim-run') || el.classList.contains('clonyfy-anim-done')) return;
    el.classList.add('clonyfy-anim-run');
    el.classList.add('aos-animate');
    if (el.hasAttribute('data-aos')) {
      try { el.style.removeProperty('transform'); } catch (e) { /* ignore */ }
    }
    var done = function () {
      el.classList.add('clonyfy-anim-done');
      el.classList.remove('clonyfy-anim-run');
      el.removeEventListener('animationend', done);
    };
    el.addEventListener('animationend', done);
    setTimeout(done, 1200);
  }

  function observe() {
    tagEntranceTargets();
    var targets = document.querySelectorAll('[data-clonyfy-anim]');
    if (!targets.length) return;
    if (typeof IntersectionObserver !== 'function') {
      for (var i = 0; i < targets.length; i++) play(targets[i]);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        play(entries[i].target);
        io.unobserve(entries[i].target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    for (var j = 0; j < targets.length; j++) {
      var el = targets[j];
      if (inInitialViewport(el)) play(el);
      else io.observe(el);
    }
  }

  /**
   * Replay scroll-linked animation recorded at capture time (pinned stories, parallax,
   * progress CSS variables, reveal-on-scroll classes). Keyframes are keyed by each
   * anchor's progress through the viewport, so they survive a different iframe size.
   */
  function installScrollTimeline() {
    if (window.__clonyfyScrollTimeline) return;
    var node = document.getElementById('__clonyfy_scroll_timeline__');
    if (!node) return;
    var data;
    try { data = JSON.parse(node.textContent || ''); } catch (e) { return; }
    if (!data || ((!data.tracks || !data.tracks.length) && (!data.regions || !data.regions.length))) return;
    data.tracks = data.tracks || [];
    window.__clonyfyScrollTimeline = true;

    // Undo the capture-time "force visible" pass inside timeline sections — there the
    // hidden state is the animation's starting point. Skip page-wide roots (html/body
    // or huge wrappers) so normal content keeps its baked visibility.
    var total = document.getElementsByTagName('*').length || 1;
    var roots = document.querySelectorAll('[data-clonyfy-st],[data-clonyfy-sr]');
    function restore(el) {
      if (el.hasAttribute('data-clonyfy-prev-style')) {
        var s = el.getAttribute('data-clonyfy-prev-style');
        if (s) el.setAttribute('style', s); else el.removeAttribute('style');
        el.removeAttribute('data-clonyfy-prev-style');
      }
      if (el.hasAttribute('data-clonyfy-prev-class')) {
        var c = el.getAttribute('data-clonyfy-prev-class');
        if (c) el.setAttribute('class', c); else el.removeAttribute('class');
        el.removeAttribute('data-clonyfy-prev-class');
      }
    }
    for (var r = 0; r < roots.length; r++) {
      var root = roots[r];
      if (root === document.documentElement || root === document.body) continue;
      if (root.getElementsByTagName('*').length > total * 0.25) continue;
      restore(root);
      var inner = root.querySelectorAll('[data-clonyfy-prev-style],[data-clonyfy-prev-class]');
      for (var q = 0; q < inner.length; q++) restore(inner[q]);
    }

    var anchors = [];
    for (var a = 0; a < data.anchors.length; a++) {
      var spec = data.anchors[a];
      anchors.push({
        mode: spec.mode,
        el: spec.mode === 'el' ? document.querySelector('[data-clonyfy-sa="' + spec.id + '"]') : null,
      });
    }
    var tracks = [];
    for (var t = 0; t < data.tracks.length; t++) {
      var tr = data.tracks[t];
      var inRegion = typeof tr.r === 'number' && tr.p;
      var el = inRegion ? null : document.querySelector('[data-clonyfy-st="' + tr.id + '"]');
      if ((!el && !inRegion) || !tr.k || tr.k.length < 2 || !anchors[tr.a]) continue;
      tracks.push({
        el: el,
        r: inRegion ? tr.r : -1,
        p: inRegion ? tr.p : null,
        a: tr.a,
        n: tr.n,
        k: tr.k,
        once: !!tr.once,
        latched: false,
        // Numbers in transforms / styles / SVG geometry morph smoothly; classes and
        // data-/aria- states switch at the recorded point.
        lerp: tr.n !== 'class' && !/^(data-|aria-)/.test(tr.n),
      });
    }
    // Structural regions: swap the container's HTML to the snapshot for this progress.
    // Indexed by the timeline's region number so path tracks can find their root.
    var regions = [];
    var regionByIndex = [];
    var pool = data.html || [];
    for (var g = 0; g < (data.regions || []).length; g++) {
      var rg = data.regions[g];
      var host = document.querySelector('[data-clonyfy-sr="' + rg.id + '"]');
      if (!host || !rg.k || !rg.k.length || !anchors[rg.a]) { regionByIndex.push(null); continue; }
      var region = { el: host, a: rg.a, k: rg.k, shown: -1 };
      regions.push(region);
      regionByIndex.push(region);
    }
    function resolvePath(root, p) {
      var x = root;
      for (var i = 0; i < p.length && x; i++) x = x.children[p[i]];
      return x || null;
    }
    if (!tracks.length && !regions.length) return;
    function snapshotAt(k, p) {
      if (p <= k[0][0]) return k[0][1];
      var idx = k[0][1];
      for (var s = 0; s < k.length && k[s][0] <= p; s++) idx = k[s][1];
      return idx;
    }
    function swapRegion(region, idx) {
      if (region.shown === idx || typeof pool[idx] !== 'string') return;
      region.shown = idx;
      region.el.innerHTML = pool[idx];
      // Re-set URL attributes so the preview's asset localizer (setAttribute hook)
      // maps original-site media to the clone's captured copies.
      var media = region.el.querySelectorAll('[src],[srcset],[poster]');
      for (var m = 0; m < media.length; m++) {
        var names = ['src', 'srcset', 'poster'];
        for (var n = 0; n < names.length; n++) {
          var val = media[m].getAttribute(names[n]);
          if (val) media[m].setAttribute(names[n], val);
        }
      }
    }

    var NUM =/-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
    function mix(a, b, f) {
      if (a === null || b === null || a === b) return a;
      var na = a.match(NUM), nb = b.match(NUM);
      if (!na || !nb || na.length !== nb.length) return a;
      var sa = a.split(NUM), sb = b.split(NUM);
      if (sa.join('\u0000') !== sb.join('\u0000')) return a;
      var out = sa[0];
      for (var i = 0; i < na.length; i++) {
        var x = parseFloat(na[i]), y = parseFloat(nb[i]);
        out += String(Math.round((x + (y - x) * f) * 10000) / 10000) + sa[i + 1];
      }
      return out;
    }
    function valueAt(track, p) {
      var k = track.k;
      if (p <= k[0][0]) return k[0][1];
      var last = k.length - 1;
      if (p >= k[last][0]) return k[last][1];
      var lo = 0, hi = last;
      while (hi - lo > 1) {
        var mid = (lo + hi) >> 1;
        if (k[mid][0] <= p) lo = mid; else hi = mid;
      }
      if (!track.lerp) return k[lo][1];
      var span = k[hi][0] - k[lo][0];
      return mix(k[lo][1], k[hi][1], span > 0 ? (p - k[lo][0]) / span : 0);
    }
    function progress(anchor, vh, docH) {
      if (anchor.mode === 'doc' || !anchor.el) {
        return Math.max(0, Math.min(1, window.scrollY / Math.max(1, docH - vh)));
      }
      var rect = anchor.el.getBoundingClientRect();
      return Math.max(0, Math.min(1, (vh - rect.top) / Math.max(1, vh + rect.height)));
    }

    var queued = false;
    function apply() {
      queued = false;
      var vh = window.innerHeight;
      var docH = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
      var prog = [];
      for (var i = 0; i < anchors.length; i++) prog.push(progress(anchors[i], vh, docH));
      for (var rr = 0; rr < regions.length; rr++) {
        try { swapRegion(regions[rr], snapshotAt(regions[rr].k, prog[regions[rr].a])); } catch (e) { /* ignore */ }
      }
      for (var j = 0; j < tracks.length; j++) {
        var track = tracks[j];
        var p = prog[track.a];
        var v;
        if (track.once) {
          var end = track.k[track.k.length - 1];
          if (!track.latched && p >= end[0]) track.latched = true;
          v = track.latched ? end[1] : track.k[0][1];
        } else {
          v = valueAt(track, p);
        }
        var target = track.el;
        if (track.r >= 0) {
          var owner = regionByIndex[track.r];
          target = owner ? resolvePath(owner.el, track.p) : null;
        }
        if (!target || target.getAttribute(track.n) === v) continue;
        try {
          if (v === null) target.removeAttribute(track.n);
          else target.setAttribute(track.n, v);
        } catch (e) { /* ignore */ }
      }
    }
    function schedule() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(apply);
    }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    apply();
  }

  /** Loop canvas frames recorded at capture time (site JS that drew them is off). */
  function playCanvasFrames() {
    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }
    var imgs = document.querySelectorAll('img[data-clonyfy-canvas-frames]');
    for (var i = 0; i < imgs.length; i++) {
      (function (img) {
        if (img.getAttribute('data-clonyfy-frames-playing') === '1') return;
        var frames;
        try { frames = JSON.parse(img.getAttribute('data-clonyfy-canvas-frames') || '[]'); } catch (e) { return; }
        if (!frames || frames.length < 2 || reduce) return;
        img.setAttribute('data-clonyfy-frames-playing', '1');
        var ms = parseInt(img.getAttribute('data-clonyfy-frame-ms') || '100', 10) || 100;
        // Preload so swaps don't flash; resolve against the img's own resolved base.
        var urls = [];
        for (var f = 0; f < frames.length; f++) {
          var pre = new Image();
          pre.src = frames[f];
          urls.push(pre.src);
        }
        var idx = 0;
        var visible = true;
        var timer = null;
        function tick() {
          if (!visible) return;
          idx = (idx + 1) % urls.length;
          img.src = urls[idx];
        }
        function start() { if (!timer) timer = setInterval(tick, ms); }
        function stop() { if (timer) { clearInterval(timer); timer = null; } }
        if (typeof IntersectionObserver === 'function') {
          new IntersectionObserver(function (entries) {
            visible = entries[0] && entries[0].isIntersecting;
            if (visible) start(); else stop();
          }).observe(img);
        } else {
          start();
        }
        document.addEventListener('visibilitychange', function () {
          if (document.hidden) stop(); else if (visible) start();
        });
      })(imgs[i]);
    }
  }

  function run() {
    try {
      injectCss();
      installLogoMarquees();
      reviveCssAnimations();
      observe();
      playCanvasFrames();
      installScrollTimeline();
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
  setTimeout(run, 500);
  setTimeout(reviveCssAnimations, 1600);
  setTimeout(installLogoMarquees, 800);
}

/* ---------------------------------------------------------------- builders */

/**
 * @param {{ mode?: 'preview'|'share', outDir?: string, shareId?: string, targetOrigin?: string, routes?: string[], defaultRoute?: string }} opts
 */
export function buildPreviewNavigationScript(opts = {}) {
  const mode = opts.mode === 'share' ? 'share' : 'preview';
  const shareId = String(opts.shareId || '');
  const config = {
    mode,
    pageBase: mode === 'share'
      ? `/api/share-page?shareId=${encodeURIComponent(shareId)}&route=`
      : `/api/page?outDir=${encodeURIComponent(String(opts.outDir || ''))}&route=`,
    sharePathBase: mode === 'share' ? `/share/${shareId}` : '',
    targetOrigin: String(opts.targetOrigin || '').replace(/\/$/, ''),
    routes: Array.isArray(opts.routes) ? opts.routes.slice(0, 5000).map(String) : [],
    defaultRoute: String(opts.defaultRoute || '/'),
  };
  const attr = mode === 'share' ? 'data-clonyfy-share-nav' : 'data-clonyfy-preview-nav';
  return `<script ${attr}>(${installToast.toString()})();(${installBlockedModal.toString()})();(${navigationRuntime.toString()})(${safeJson(config)});</script>`;
}

export function buildInteractionRuntimeScript() {
  return `<script data-clonyfy-interactions-runtime>(${installToast.toString()})();(${interactionRuntime.toString()})();</script>`;
}

export function buildAnimationRuntimeScript() {
  return `<script data-clonyfy-animation-runtime>(${animationRuntime.toString()})();</script>`;
}

/**
 * Bridge injected into origin-proxied Live JS pages.
 * Rewrites same-origin fetch/XHR/navigation through /api/live-site so the real
 * site scripts run while staying on the API host. No interaction heuristics.
 *
 * @param {{ prefix: string, targetOrigin: string, outDir?: string, route?: string }} opts
 */
export function buildLiveBridgeScript(opts = {}) {
  const config = {
    prefix: String(opts.prefix || '').replace(/\/$/, ''),
    targetOrigin: String(opts.targetOrigin || '').replace(/\/$/, ''),
    outDir: String(opts.outDir || ''),
    route: String(opts.route || '/'),
  };
  return `<script data-clonyfy-live-bridge>(${liveBridgeRuntime.toString()})(${safeJson(config)});</script>`;
}

function liveBridgeRuntime(CFG) {
  if (window.__clonyfyLiveBridge) return;
  window.__clonyfyLiveBridge = true;
  var prefix = String(CFG.prefix || '').replace(/\/$/, '');
  var targetOrigin = String(CFG.targetOrigin || '').replace(/\/$/, '');
  if (!prefix || !targetOrigin) return;

  function bareHost(h) {
    return String(h || '').replace(/:\d+$/, '').toLowerCase();
  }
  function targetHost() {
    try { return bareHost(new URL(targetOrigin).host); } catch (e) { return ''; }
  }
  function routeFromPath(pathname) {
    var p = String(pathname || '/');
    if (prefix && p.indexOf(prefix) === 0) {
      p = p.slice(prefix.length) || '/';
    }
    if (!p || p.charAt(0) !== '/') p = '/' + p;
    return p;
  }
  function toLive(raw) {
    var value = String(raw == null ? '' : raw).trim();
    if (!value || /^(mailto|tel|sms|javascript|data|blob):/i.test(value)) return value;
    if (value.charAt(0) === '#') return value;
    var url;
    try {
      url = new URL(value, targetOrigin + '/');
    } catch (e) { return value; }
    if (!/^https?:$/i.test(url.protocol)) return value;
    var same = bareHost(url.host) === targetHost();
    var viaLive = prefix && url.pathname.indexOf(prefix) === 0;
    if (viaLive) return url.pathname + url.search + url.hash;
    if (!same) return value;
    return prefix + (url.pathname || '/') + url.search + url.hash;
  }
  function notifyRoute() {
    try {
      var route = routeFromPath(location.pathname) + location.search + location.hash;
      window.parent.postMessage({ type: 'clonyfy-preview-nav', route: route, live: true }, '*');
    } catch (e) { /* ignore */ }
  }

  // fetch
  var nativeFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      var reqUrl = typeof input === 'string' ? input : (input && input.url);
      var mapped = toLive(reqUrl);
      if (mapped && mapped !== reqUrl) {
        if (typeof input === 'string') input = mapped;
        else if (input && typeof Request !== 'undefined') input = new Request(mapped, input);
      }
    } catch (e) { /* ignore */ }
    return nativeFetch.call(this, input, init);
  };

  // XHR
  var XO = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    var args = Array.prototype.slice.call(arguments);
    if (typeof url === 'string') args[1] = toLive(url);
    return XO.apply(this, args);
  };

  // window.open
  var nativeOpen = window.open;
  window.open = function (url, name, specs) {
    return nativeOpen.call(this, url != null ? toLive(String(url)) : url, name, specs);
  };

  // history
  var nativePush = history.pushState;
  var nativeReplace = history.replaceState;
  history.pushState = function (state, title, url) {
    var next = url != null && url !== '' ? toLive(String(url)) : url;
    var ret = nativePush.call(this, state, title, next);
    notifyRoute();
    return ret;
  };
  history.replaceState = function (state, title, url) {
    var next = url != null && url !== '' ? toLive(String(url)) : url;
    var ret = nativeReplace.call(this, state, title, next);
    notifyRoute();
    return ret;
  };
  window.addEventListener('popstate', notifyRoute);
  window.addEventListener('hashchange', notifyRoute);

  // Clicks on same-origin anchors
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a || a.hasAttribute('download')) return;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var href = a.getAttribute('href');
    if (!href || /^(mailto|tel|sms|javascript):/i.test(href) || href.charAt(0) === '#') return;
    var mapped = toLive(href);
    if (!mapped || mapped === href) return;
    // Only rewrite when the raw href pointed at the live origin / root-relative path.
    var abs;
    try { abs = new URL(href, targetOrigin + '/'); } catch (err) { return; }
    if (bareHost(abs.host) !== targetHost() && href.charAt(0) !== '/') return;
    e.preventDefault();
    if (/^_(blank|new)$/i.test(a.getAttribute('target') || '')) {
      nativeOpen.call(window, mapped, '_blank', 'noopener');
    } else {
      location.href = mapped;
    }
  }, true);

  // Forms posting to same origin
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.getAttribute) return;
    var action = form.getAttribute('action');
    if (action == null || action === '') action = location.href;
    var mapped = toLive(action);
    if (mapped && mapped !== action) form.setAttribute('action', mapped);
  }, true);

  notifyRoute();
}
