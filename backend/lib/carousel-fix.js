/** Shared carousel/slider + stacked text-rotator normalization for capture + preview. */

export const CAROUSEL_SKIP_SELECTOR = [
  '[class*="slideshow"]',
  '[class*="carousel"]',
  '[class*="slider"]',
  '[data-slider]',
  '[data-carousel]',
  '[role="region"][aria-roledescription*="carousel" i]',
  '[class*="rotat"]',
  '[class*="word-cycle"]',
  '[class*="text-cycle"]',
  '[class*="text-rotat"]',
  '[class*="headline-rotat"]',
  '[class*="animated-text"]',
  '[data-text-rotat]',
  '[data-rotator]',
  '[data-animate-text]',
  '.clonyfy-stacked-rotator',
].join(',');

export const CAROUSEL_CONTAINER_SELECTOR = CAROUSEL_SKIP_SELECTOR;

export const CAROUSEL_SLIDE_SELECTOR = [
  '[class*="slide"]',
  '[data-slide]',
  '[role="group"]',
  'li[class*="slide"]',
].join(',');

/** Browser-side: hide inactive slides / stacked text rotators so hero phrases do not overlap. */
export function normalizeCarouselsInDocument() {
  normalizeAllMotionStacksInDocument();
}

function isIntentionalBlendLayer(el) {
  if (!el || !el.getAttribute) return false;
  try {
    const cls = String(el.className || '');
    if (/title--foreground|title--background|hero-section__title/i.test(cls)) return true;
    const cs = window.getComputedStyle(el);
    if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') return true;
    // Stripe: background title + foreground blend title are intentional siblings.
    const sib = el.nextElementSibling || el.previousElementSibling;
    if (sib && /title--foreground|title--background/i.test(String(sib.className || ''))) return true;
  } catch (e) { /* ignore */ }
  return false;
}

/** Undo mistaken collapses of Stripe-style dual hero titles. */
export function restoreHeroBlendLayersInDocument() {
  document.querySelectorAll(
    '.hero-section__title--foreground, .hero-section__title--background, [class*="title--foreground"], [class*="title--background"]',
  ).forEach((el) => {
    el.removeAttribute('data-clonyfy-stack-hidden');
    if (el.getAttribute('aria-hidden') === 'true' && /title--foreground/i.test(String(el.className || ''))) {
      // Keep a11y aria-hidden, but force paint.
    }
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    el.style.removeProperty('opacity');
    el.style.removeProperty('pointer-events');
    if (/title--foreground/i.test(String(el.className || ''))) {
      el.style.setProperty('position', 'relative');
      el.style.setProperty('z-index', '3');
    }
  });
}

export function normalizeAllMotionStacksInDocument() {
  restoreHeroBlendLayersInDocument();
  const containerSel = CAROUSEL_CONTAINER_SELECTOR;
  const slideSel = CAROUSEL_SLIDE_SELECTOR;
  document.querySelectorAll(containerSel).forEach((container) => {
    const slides = container.querySelectorAll(slideSel);
    if (slides.length < 2) return;

    let active = container.querySelector(
      '.is-active,.active,.current,[aria-current="true"],[aria-hidden="false"],[data-active="true"],[data-state="active"]',
    );
    if (!active || !container.contains(active)) {
      let best = slides[0];
      let bestScore = -1;
      slides.forEach((slide) => {
        const cs = window.getComputedStyle(slide);
        const z = parseInt(cs.zIndex, 10) || 0;
        const op = parseFloat(cs.opacity) || 0;
        const score = z * 100 + op;
        if (score > bestScore) {
          bestScore = score;
          best = slide;
        }
      });
      active = best;
    }

    slides.forEach((slide) => {
      const isActive = slide === active || slide.contains(active) || active?.contains(slide);
      hideInactiveLayer(slide, isActive, { soft: true });
    });
  });

  normalizeStackedTextRotatorsInDocument();
  normalizeShellCaptureOverlapsInDocument();
}

/**
 * Shell screenshots use the element bounding box, so overlapping sibling chrome
 * (titles, expand buttons) gets baked into the PNG. Live DOM still paints that
 * chrome → double text / double icons. Drop those shells in preview.
 */
export function normalizeShellCaptureOverlapsInDocument() {
  document.querySelectorAll('img[data-clonyfy-shell-capture]').forEach((img) => {
    const host = img.parentElement;
    if (!host || host.hasAttribute('data-clonyfy-stack-hidden')) return;
    const cls = String(host.className || '');
    const looksDecorativeBorder = /(?:^|[\s_-])(?:border|overlay|frame|mask|outline)(?:[\s_-]|$)|__border\b/i.test(cls);
    const imgRect = img.getBoundingClientRect();
    if (imgRect.width < 40 || imgRect.height < 40) return;

    let overlapsChrome = looksDecorativeBorder;
    if (!overlapsChrome) {
      const root = host.parentElement || host;
      const candidates = Array.from(root.children).filter((el) => el !== host);
      for (const sib of candidates) {
        const text = (sib.textContent || '').replace(/\s+/g, ' ').trim();
        const hasUi = !!sib.querySelector('h1,h2,h3,h4,h5,h6,button,a,svg,[aria-haspopup],summary');
        const isHeading = /^H[1-6]$/.test(sib.tagName);
        if (!hasUi && !isHeading && text.length < 4) continue;
        const r = sib.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        if (rectsOverlapHeavily(imgRect, r)) {
          overlapsChrome = true;
          break;
        }
        // Title/button often sits in a corner of a full-bleed shell — soft overlap.
        const ix = Math.max(0, Math.min(imgRect.right, r.right) - Math.max(imgRect.left, r.left));
        const iy = Math.max(0, Math.min(imgRect.bottom, r.bottom) - Math.max(imgRect.top, r.top));
        const inter = ix * iy;
        const sibArea = Math.max(1, r.width * r.height);
        if (inter / sibArea >= 0.35) {
          overlapsChrome = true;
          break;
        }
      }
    }

    if (!overlapsChrome) return;
    host.setAttribute('data-clonyfy-stack-hidden', '1');
    host.setAttribute('aria-hidden', 'true');
    img.setAttribute('data-clonyfy-stack-hidden', '1');
    host.style.setProperty('display', 'none', 'important');
    host.style.setProperty('visibility', 'hidden', 'important');
    host.style.setProperty('opacity', '0', 'important');
    img.style.setProperty('display', 'none', 'important');
  });
}

function rectsOverlapHeavily(a, b) {
  const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const inter = ix * iy;
  if (inter <= 0) return false;
  const areaA = Math.max(1, a.width * a.height);
  const areaB = Math.max(1, b.width * b.height);
  return inter / Math.min(areaA, areaB) >= 0.45;
}

function looksLikeTextLayer(el) {
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (text.length < 2 || text.length > 180) return false;
  const tag = el.tagName;
  if (/^(SCRIPT|STYLE|LINK|META|SVG|PATH|IMG|VIDEO|SOURCE|IFRAME|CANVAS)$/i.test(tag)) return false;
  return true;
}

function normText(el) {
  return (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function layerScore(el) {
  const cs = window.getComputedStyle(el);
  const z = parseInt(cs.zIndex, 10) || 0;
  const op = parseFloat(cs.opacity) || 0;
  const ariaHidden = el.getAttribute('aria-hidden') === 'true' ? -50 : 0;
  const activeClass = /\b(is-active|active|current|visible|show|in)\b/i.test(el.className || '') ? 40 : 0;
  return z * 100 + op * 20 + ariaHidden + activeClass;
}

function duplicateKeepScore(el) {
  const cs = window.getComputedStyle(el);
  let score = layerScore(el);
  // Prefer in-flow layout text over absolute/fixed animation overlays.
  if (cs.position === 'absolute' || cs.position === 'fixed') score -= 90;
  if (cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre') score -= 25;
  if (/^H[1-6]$/.test(el.tagName)) score += 55;
  if (/^(P|FIGCAPTION|LABEL|BLOCKQUOTE)$/.test(el.tagName)) score += 20;
  if (el.getAttribute('aria-hidden') === 'true') score -= 120;
  if (el.hasAttribute('data-clonyfy-stack-hidden')) score -= 200;
  // Prefer the taller (wrapping) box when both paint the same phrase.
  const r = el.getBoundingClientRect();
  score += Math.min(50, r.height / 3);
  return score;
}

function hideInactiveLayer(el, active, opts = {}) {
  if (!el || !el.style) return;
  if (active) {
    el.removeAttribute('data-clonyfy-stack-hidden');
    el.style.opacity = '1';
    el.style.visibility = 'visible';
    el.style.pointerEvents = '';
    if (!opts.soft) el.style.removeProperty('display');
    el.removeAttribute('aria-hidden');
    el.removeAttribute('hidden');
  } else if (opts.soft) {
    // Carousel slides: keep layout box, just hide paint.
    el.style.opacity = '0';
    el.style.visibility = 'hidden';
    el.style.pointerEvents = 'none';
    el.style.transform = 'none';
    el.setAttribute('aria-hidden', 'true');
  } else {
    // Text duplicates: hard-hide so visibility bake cannot resurrect them.
    el.setAttribute('data-clonyfy-stack-hidden', '1');
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.style.setProperty('transform', 'none', 'important');
  }
}

function collapseStack(layers, seen) {
  let active = layers.find((el) =>
    el.getAttribute('aria-hidden') === 'false'
    || /\b(is-active|active|current|visible|show|in)\b/i.test(el.className || ''),
  ) || null;
  if (!active) {
    active = layers.reduce((best, el) => (duplicateKeepScore(el) > duplicateKeepScore(best) ? el : best), layers[0]);
  }
  const parent = layers[0] && layers[0].parentElement;
  if (parent) {
    parent.classList.add('clonyfy-stacked-rotator');
    const pcs = window.getComputedStyle(parent);
    if (pcs.position === 'static') parent.style.position = 'relative';
  }
  layers.forEach((el) => {
    seen.add(el);
    hideInactiveLayer(el, el === active, { soft: false });
  });
}

/**
 * Stripe/Framer-style headlines often keep a layout copy + an absolute animation copy
 * of the same phrase. After site JS is disabled (and visibility bake force-shows
 * faded layers), both paint and look like overlapping clutter.
 */
function normalizeDuplicateTextOverlays(seen) {
  const candidates = [];
  document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,a,li,div,label,figcaption,blockquote,strong,em,b').forEach((el) => {
    if (seen.has(el)) return;
    if (el.closest && el.closest('[data-clonyfy-ui],[data-clonyfy-stack-hidden]')) return;
    // Never collapse Stripe/Framer blend title pairs — both layers are required.
    if (isIntentionalBlendLayer(el)) return;
    if (!looksLikeTextLayer(el)) return;
    const text = normText(el);
    if (text.length < 4 || text.length > 120) return;
    if (el.children.length > 8) return;
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 12) return;
    // Skip pure wrappers whose only child carries the same full text (same paint once).
    if (el.children.length === 1) {
      const child = el.children[0];
      if (normText(child) === text) return;
    }
    candidates.push(el);
  });

  const groups = new Map();
  for (const el of candidates) {
    const key = normText(el);
    let list = groups.get(key);
    if (!list) {
      list = [];
      groups.set(key, list);
    }
    list.push(el);
  }

  for (const els of groups.values()) {
    if (els.length < 2) continue;
    // If any member is a blend/hero title, keep the whole group.
    if (els.some((el) => isIntentionalBlendLayer(el))) continue;
    const rects = els.map((el) => el.getBoundingClientRect());
    const scores = els.map((el) => duplicateKeepScore(el));
    const hideIdx = new Set();

    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
        if (!rectsOverlapHeavily(rects[i], rects[j])) continue;
        if (scores[i] >= scores[j]) hideIdx.add(j);
        else hideIdx.add(i);
      }
    }

    for (const idx of hideIdx) {
      hideInactiveLayer(els[idx], false, { soft: false });
      seen.add(els[idx]);
    }
  }
}

export function normalizeStackedTextRotatorsInDocument() {
  const seen = new Set();

  // Prefer accessible static headline over animated absolute phrase stacks (Shopify hero).
  document.querySelectorAll('[aria-hidden="true"]').forEach((animated) => {
    if (isIntentionalBlendLayer(animated)) return;
    const absCount = animated.querySelectorAll('[class*="absolute"],.absolute').length;
    const fadedCount = animated.querySelectorAll('[class*="opacity-0"],.opacity-0').length;
    if (absCount < 1 && fadedCount < 2) return;
    const prev = animated.previousElementSibling;
    if (!prev) return;
    if (isIntentionalBlendLayer(prev)) return;
    const prevClass = String(prev.className || '');
    const hasFallbackHeading = !!(prev.querySelector('h1,h2,h3') || /^H[1-3]$/.test(prev.tagName));
    const looksSrOnly = /\bsr-only\b|visually-hidden|js-disabled:not-sr-only/i.test(prevClass);
    if (!hasFallbackHeading && !looksSrOnly) return;
    animated.style.setProperty('display', 'none', 'important');
    animated.setAttribute('data-clonyfy-stack-hidden', '1');
    seen.add(animated);
    prev.classList.remove('sr-only');
    prev.style.setProperty('position', 'static', 'important');
    prev.style.setProperty('width', 'auto', 'important');
    prev.style.setProperty('height', 'auto', 'important');
    prev.style.setProperty('overflow', 'visible', 'important');
    prev.style.setProperty('clip', 'auto', 'important');
    prev.style.setProperty('clip-path', 'none', 'important');
    prev.style.setProperty('white-space', 'normal', 'important');
    prev.style.setProperty('margin', '0', 'important');
    prev.style.setProperty('padding', '0', 'important');
    prev.removeAttribute('aria-hidden');
    seen.add(prev);
  });

  document.querySelectorAll('.relative, [class*="relative"]').forEach((rel) => {
    if (seen.has(rel)) return;
    const phraseRoots = Array.from(rel.children).filter((child) => {
      if (!child.querySelector) return false;
      if (!child.querySelector('[class*="absolute"],.absolute')) return false;
      const text = (child.textContent || '').replace(/\s+/g, ' ').trim();
      return text.length >= 2 && text.length <= 180;
    });
    if (phraseRoots.length < 2) return;
    let active = phraseRoots.find((el) => {
      const live = el.querySelector('[class*="opacity-100"],.opacity-100');
      const dead = el.querySelector('[class*="opacity-0"],.opacity-0,[class*="translate-y-100"]');
      return !!live && !dead;
    }) || phraseRoots.reduce((best, el) => (layerScore(el) > layerScore(best) ? el : best), phraseRoots[0]);
    rel.classList.add('clonyfy-stacked-rotator');
    phraseRoots.forEach((el) => {
      seen.add(el);
      hideInactiveLayer(el, el === active, { soft: false });
      el.querySelectorAll('span').forEach((span) => hideInactiveLayer(span, el === active, { soft: false }));
    });
  });

  const parents = document.querySelectorAll('h1,h2,h3,[class*="hero"],[class*="Hero"],[class*="headline"],[class*="Headline"],[class*="banner"],[data-hero],section,header,main');

  parents.forEach((parent) => {
    const children = Array.from(parent.children).filter((el) => {
      if (seen.has(el)) return false;
      if (!looksLikeTextLayer(el)) return false;
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 16) return false;
      const positioned = cs.position === 'absolute' || cs.position === 'fixed' || cs.position === 'sticky';
      const transformed = cs.transform && cs.transform !== 'none';
      const aria = el.hasAttribute('aria-hidden');
      // After visibility bake both layers are often fully opaque — still treat
      // absolute/sticky siblings (or any heavy geometric overlap) as a stack.
      return positioned || transformed || aria || parseFloat(cs.opacity) < 0.95;
    });

    if (children.length < 2) {
      Array.from(parent.children).forEach((wrap) => {
        if (seen.has(wrap)) return;
        const nested = Array.from(wrap.children).filter((el) => looksLikeTextLayer(el));
        if (nested.length < 2) return;
        const rects = nested.map((el) => el.getBoundingClientRect());
        let overlapPairs = 0;
        for (let i = 0; i < nested.length; i++) {
          for (let j = i + 1; j < nested.length; j++) {
            if (rectsOverlapHeavily(rects[i], rects[j])) overlapPairs++;
          }
        }
        if (overlapPairs < 1) return;
        collapseStack(nested, seen);
      });
      return;
    }

    const rects = children.map((el) => el.getBoundingClientRect());
    let overlapPairs = 0;
    for (let i = 0; i < children.length; i++) {
      for (let j = i + 1; j < children.length; j++) {
        if (rectsOverlapHeavily(rects[i], rects[j])) overlapPairs++;
      }
    }
    if (overlapPairs < 1) return;
    collapseStack(children, seen);
  });

  document.querySelectorAll('div,span,p,li').forEach((parent) => {
    if (seen.has(parent)) return;
    const kids = Array.from(parent.children).filter((el) => looksLikeTextLayer(el));
    if (kids.length < 2 || kids.length > 12) return;
    const rects = kids.map((el) => el.getBoundingClientRect());
    let heavy = 0;
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        if (rectsOverlapHeavily(rects[i], rects[j])) heavy++;
      }
    }
    const maxPairs = (kids.length * (kids.length - 1)) / 2;
    if (heavy < Math.max(1, Math.floor(maxPairs * 0.4))) return;
    collapseStack(kids, seen);
  });

  // Final pass: identical phrases occupying the same space (Stripe/Framer overlays).
  normalizeDuplicateTextOverlays(seen);
}

export function isInsideCarousel(el) {
  return !!(el && el.closest && el.closest(CAROUSEL_SKIP_SELECTOR));
}

/**
 * Self-contained browser IIFE for preview/share HTML.
 * Built via Function#toString so it stays aligned with the module helpers above.
 */
function browserCarouselFixRuntime() {
  var CS = '[class*="slideshow"],[class*="carousel"],[class*="slider"],[data-slider],[data-carousel],[role="region"][aria-roledescription*="carousel" i],[class*="rotat"],[class*="word-cycle"],[class*="text-cycle"],[class*="text-rotat"],[class*="headline-rotat"],[class*="animated-text"],[data-text-rotat],[data-rotator],[data-animate-text],.clonyfy-stacked-rotator';
  var SS = '[class*="slide"],[data-slide],[role="group"],li[class*="slide"]';

  function overlap(a, b) {
    var ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    var iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    var inter = ix * iy;
    if (inter <= 0) return false;
    var aa = Math.max(1, a.width * a.height);
    var bb = Math.max(1, b.width * b.height);
    return inter / Math.min(aa, bb) >= 0.45;
  }
  function textLayer(el) {
    var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (t.length < 2 || t.length > 180) return false;
    if (/^(SCRIPT|STYLE|LINK|META|SVG|PATH|IMG|VIDEO|SOURCE|IFRAME|CANVAS)$/i.test(el.tagName)) return false;
    return true;
  }
  function isBlend(el) {
    if (!el) return false;
    var cls = String(el.className || '');
    if (/title--foreground|title--background|hero-section__title/i.test(cls)) return true;
    try {
      var cs = getComputedStyle(el);
      if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') return true;
    } catch (e) {}
    var sib = el.nextElementSibling || el.previousElementSibling;
    if (sib && /title--foreground|title--background/i.test(String(sib.className || ''))) return true;
    return false;
  }
  function restoreHero() {
    document.querySelectorAll('.hero-section__title--foreground,.hero-section__title--background,[class*="title--foreground"],[class*="title--background"]').forEach(function (el) {
      el.removeAttribute('data-clonyfy-stack-hidden');
      el.style.removeProperty('display');
      el.style.removeProperty('visibility');
      el.style.removeProperty('opacity');
      el.style.removeProperty('pointer-events');
      if (/title--foreground/i.test(String(el.className || ''))) {
        el.style.setProperty('position', 'relative');
        el.style.setProperty('z-index', '3');
      }
    });
  }
  function normText(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function score(el) {
    var cs = getComputedStyle(el);
    var z = parseInt(cs.zIndex, 10) || 0;
    var op = parseFloat(cs.opacity) || 0;
    var ah = el.getAttribute('aria-hidden') === 'true' ? -50 : 0;
    var ac = /\b(is-active|active|current|visible|show|in)\b/i.test(el.className || '') ? 40 : 0;
    return z * 100 + op * 20 + ah + ac;
  }
  function keepScore(el) {
    var cs = getComputedStyle(el);
    var s = score(el);
    if (cs.position === 'absolute' || cs.position === 'fixed') s -= 90;
    if (cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre') s -= 25;
    if (/^H[1-6]$/.test(el.tagName)) s += 55;
    if (/^(P|FIGCAPTION|LABEL|BLOCKQUOTE)$/.test(el.tagName)) s += 20;
    if (el.getAttribute('aria-hidden') === 'true') s -= 120;
    if (el.hasAttribute('data-clonyfy-stack-hidden')) s -= 200;
    var r = el.getBoundingClientRect();
    s += Math.min(50, r.height / 3);
    return s;
  }
  function hide(el, on, soft) {
    if (!el || !el.style) return;
    if (on) {
      el.removeAttribute('data-clonyfy-stack-hidden');
      el.style.opacity = '1';
      el.style.visibility = 'visible';
      el.style.pointerEvents = '';
      if (!soft) el.style.removeProperty('display');
      el.removeAttribute('aria-hidden');
      el.removeAttribute('hidden');
    } else if (soft) {
      el.style.opacity = '0';
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
      el.style.transform = 'none';
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.setAttribute('data-clonyfy-stack-hidden', '1');
      el.setAttribute('aria-hidden', 'true');
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
      el.style.setProperty('transform', 'none', 'important');
    }
  }
  function collapse(layers, seen) {
    var active = null;
    for (var i = 0; i < layers.length; i++) {
      var el = layers[i];
      if (el.getAttribute('aria-hidden') === 'false' || /\b(is-active|active|current|visible|show|in)\b/i.test(el.className || '')) {
        active = el;
        break;
      }
    }
    if (!active) {
      active = layers[0];
      for (var j = 1; j < layers.length; j++) {
        if (keepScore(layers[j]) > keepScore(active)) active = layers[j];
      }
    }
    var parent = layers[0] && layers[0].parentElement;
    if (parent) {
      parent.classList.add('clonyfy-stacked-rotator');
      if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    }
    layers.forEach(function (node) {
      seen.add(node);
      hide(node, node === active, false);
    });
  }
  function normCarousels() {
    document.querySelectorAll(CS).forEach(function (c) {
      var slides = c.querySelectorAll(SS);
      if (slides.length < 2) return;
      var active = c.querySelector('.is-active,.active,.current,[aria-current="true"],[aria-hidden="false"],[data-active="true"],[data-state="active"]');
      if (!active || !c.contains(active)) {
        var best = slides[0];
        var bestScore = -1;
        slides.forEach(function (s) {
          var cs = getComputedStyle(s);
          var z = parseInt(cs.zIndex, 10) || 0;
          var op = parseFloat(cs.opacity) || 0;
          var sc = z * 100 + op;
          if (sc > bestScore) {
            bestScore = sc;
            best = s;
          }
        });
        active = best;
      }
      slides.forEach(function (slide) {
        var isA = slide === active || slide.contains(active) || (active && active.contains(slide));
        hide(slide, !!isA, true);
      });
    });
  }
  function normDuplicateText(seen) {
    var candidates = [];
    document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,a,li,div,label,figcaption,blockquote,strong,em,b').forEach(function (el) {
      if (seen.has(el)) return;
      if (el.closest && el.closest('[data-clonyfy-ui],[data-clonyfy-stack-hidden]')) return;
      if (isBlend(el)) return;
      if (!textLayer(el)) return;
      var text = normText(el);
      if (text.length < 4 || text.length > 120) return;
      if (el.children.length > 8) return;
      var r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 12) return;
      if (el.children.length === 1 && normText(el.children[0]) === text) return;
      candidates.push(el);
    });
    var groups = {};
    candidates.forEach(function (el) {
      var key = normText(el);
      if (!groups[key]) groups[key] = [];
      groups[key].push(el);
    });
    Object.keys(groups).forEach(function (key) {
      var els = groups[key];
      if (els.length < 2) return;
      if (els.some(isBlend)) return;
      var rects = els.map(function (el) { return el.getBoundingClientRect(); });
      var scores = els.map(keepScore);
      var hideIdx = {};
      for (var i = 0; i < els.length; i++) {
        for (var j = i + 1; j < els.length; j++) {
          if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
          if (!overlap(rects[i], rects[j])) continue;
          if (scores[i] >= scores[j]) hideIdx[j] = 1;
          else hideIdx[i] = 1;
        }
      }
      Object.keys(hideIdx).forEach(function (idx) {
        hide(els[idx], false, false);
        seen.add(els[idx]);
      });
    });
  }
  function normStacks() {
    document.querySelectorAll('[aria-hidden="true"]').forEach(function (animated) {
      if (isBlend(animated)) return;
      var absCount = animated.querySelectorAll('[class*="absolute"],.absolute').length;
      var fadedCount = animated.querySelectorAll('[class*="opacity-0"],.opacity-0').length;
      if (absCount < 1 && fadedCount < 2) return;
      var prev = animated.previousElementSibling;
      if (!prev) return;
      if (isBlend(prev)) return;
      var prevClass = String(prev.className || '');
      var hasHeading = !!(prev.querySelector('h1,h2,h3') || /^H[1-3]$/.test(prev.tagName));
      var sr = /\bsr-only\b|visually-hidden|js-disabled:not-sr-only/i.test(prevClass);
      if (!hasHeading && !sr) return;
      animated.style.setProperty('display', 'none', 'important');
      animated.setAttribute('data-clonyfy-stack-hidden', '1');
      prev.classList.remove('sr-only');
      prev.style.setProperty('position', 'static', 'important');
      prev.style.setProperty('width', 'auto', 'important');
      prev.style.setProperty('height', 'auto', 'important');
      prev.style.setProperty('overflow', 'visible', 'important');
      prev.style.setProperty('clip', 'auto', 'important');
      prev.style.setProperty('clip-path', 'none', 'important');
      prev.style.setProperty('white-space', 'normal', 'important');
      prev.style.setProperty('margin', '0', 'important');
      prev.style.setProperty('padding', '0', 'important');
      prev.removeAttribute('aria-hidden');
    });
    var seen = new Set();
    document.querySelectorAll('.relative,[class*="relative"]').forEach(function (rel) {
      var phraseRoots = Array.prototype.filter.call(rel.children, function (child) {
        return child.querySelector && child.querySelector('[class*="absolute"],.absolute') && textLayer(child);
      });
      if (phraseRoots.length < 2) return;
      var active = phraseRoots.find(function (el) {
        return el.querySelector('[class*="opacity-100"],.opacity-100') && !el.querySelector('[class*="opacity-0"],.opacity-0');
      }) || phraseRoots[0];
      rel.classList.add('clonyfy-stacked-rotator');
      phraseRoots.forEach(function (el) {
        seen.add(el);
        hide(el, el === active, false);
        el.querySelectorAll('span').forEach(function (span) { hide(span, el === active, false); });
      });
    });
    document.querySelectorAll('h1,h2,h3,[class*="hero"],[class*="Hero"],[class*="headline"],[class*="Headline"],[class*="banner"],[data-hero],section,header,main').forEach(function (parent) {
      var children = Array.prototype.filter.call(parent.children, function (el) {
        if (seen.has(el) || !textLayer(el)) return false;
        var cs = getComputedStyle(el);
        var r = el.getBoundingClientRect();
        if (r.width < 40 || r.height < 16) return false;
        var pos = cs.position === 'absolute' || cs.position === 'fixed' || cs.position === 'sticky';
        var tr = cs.transform && cs.transform !== 'none';
        return pos || tr || el.hasAttribute('aria-hidden') || parseFloat(cs.opacity) < 0.95;
      });
      if (children.length < 2) {
        Array.prototype.forEach.call(parent.children, function (wrap) {
          if (seen.has(wrap)) return;
          var nested = Array.prototype.filter.call(wrap.children, textLayer);
          if (nested.length < 2) return;
          var rects = nested.map(function (el) { return el.getBoundingClientRect(); });
          var pairs = 0;
          for (var i = 0; i < nested.length; i++) {
            for (var j = i + 1; j < nested.length; j++) {
              if (overlap(rects[i], rects[j])) pairs++;
            }
          }
          if (pairs >= 1) collapse(nested, seen);
        });
        return;
      }
      var rects = children.map(function (el) { return el.getBoundingClientRect(); });
      var pairs = 0;
      for (var i = 0; i < children.length; i++) {
        for (var j = i + 1; j < children.length; j++) {
          if (overlap(rects[i], rects[j])) pairs++;
        }
      }
      if (pairs >= 1) collapse(children, seen);
    });
    document.querySelectorAll('div,span,p,li').forEach(function (parent) {
      if (seen.has(parent)) return;
      var kids = Array.prototype.filter.call(parent.children, textLayer);
      if (kids.length < 2 || kids.length > 12) return;
      var rects = kids.map(function (el) { return el.getBoundingClientRect(); });
      var heavy = 0;
      for (var i = 0; i < kids.length; i++) {
        for (var j = i + 1; j < kids.length; j++) {
          if (overlap(rects[i], rects[j])) heavy++;
        }
      }
      var maxPairs = (kids.length * (kids.length - 1)) / 2;
      if (heavy < Math.max(1, Math.floor(maxPairs * 0.4))) return;
      collapse(kids, seen);
    });
    normDuplicateText(seen);
  }
  function softOverlap(imgRect, r) {
    var ix = Math.max(0, Math.min(imgRect.right, r.right) - Math.max(imgRect.left, r.left));
    var iy = Math.max(0, Math.min(imgRect.bottom, r.bottom) - Math.max(imgRect.top, r.top));
    var inter = ix * iy;
    if (inter <= 0) return false;
    var sibArea = Math.max(1, r.width * r.height);
    return inter / sibArea >= 0.35;
  }
  function normShells() {
    document.querySelectorAll('img[data-clonyfy-shell-capture]').forEach(function (img) {
      var host = img.parentElement;
      if (!host || host.hasAttribute('data-clonyfy-stack-hidden')) return;
      var cls = String(host.className || '');
      var looksBorder = /(?:^|[\s_-])(?:border|overlay|frame|mask|outline)(?:[\s_-]|$)|__border\b/i.test(cls);
      var imgRect = img.getBoundingClientRect();
      if (imgRect.width < 40 || imgRect.height < 40) return;
      var overlapsChrome = looksBorder;
      if (!overlapsChrome) {
        var root = host.parentElement || host;
        var kids = Array.prototype.filter.call(root.children, function (el) { return el !== host; });
        for (var i = 0; i < kids.length; i++) {
          var sib = kids[i];
          var text = (sib.textContent || '').replace(/\s+/g, ' ').trim();
          var hasUi = !!sib.querySelector('h1,h2,h3,h4,h5,h6,button,a,svg,[aria-haspopup],summary');
          var isHeading = /^H[1-6]$/.test(sib.tagName);
          if (!hasUi && !isHeading && text.length < 4) continue;
          var r = sib.getBoundingClientRect();
          if (r.width < 8 || r.height < 8) continue;
          if (overlap(imgRect, r) || softOverlap(imgRect, r)) {
            overlapsChrome = true;
            break;
          }
        }
      }
      if (!overlapsChrome) return;
      host.setAttribute('data-clonyfy-stack-hidden', '1');
      host.setAttribute('aria-hidden', 'true');
      img.setAttribute('data-clonyfy-stack-hidden', '1');
      host.style.setProperty('display', 'none', 'important');
      host.style.setProperty('visibility', 'hidden', 'important');
      host.style.setProperty('opacity', '0', 'important');
      img.style.setProperty('display', 'none', 'important');
    });
  }
  function run() {
    try {
      restoreHero();
      normCarousels();
      normStacks();
      normShells();
      restoreHero();
    } catch (e) { /* ignore */ }
  }
  run();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  setTimeout(run, 400);
  setTimeout(run, 1200);
  setTimeout(run, 2800);
}

/** Minified script injected into preview HTML (no module loader). */
export function carouselFixInlineScript() {
  return `(${browserCarouselFixRuntime.toString()})();`;
}
