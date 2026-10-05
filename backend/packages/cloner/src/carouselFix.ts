/** Carousel / text-rotator normalization — keep one active layer, hide stacked siblings. */

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
  '[class*="rotat"] > *',
  '[aria-hidden]',
].join(',');

function rectsOverlapHeavily(a: DOMRect, b: DOMRect): boolean {
  const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const inter = ix * iy;
  if (inter <= 0) return false;
  const areaA = Math.max(1, a.width * a.height);
  const areaB = Math.max(1, b.width * b.height);
  return inter / Math.min(areaA, areaB) >= 0.45;
}

function looksLikeTextLayer(el: Element): boolean {
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (text.length < 2 || text.length > 180) return false;
  const tag = el.tagName;
  if (/^(SCRIPT|STYLE|LINK|META|SVG|PATH|IMG|VIDEO|SOURCE|IFRAME|CANVAS)$/i.test(tag)) return false;
  return true;
}

function normText(el: Element): string {
  return (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function layerScore(el: Element): number {
  const cs = window.getComputedStyle(el);
  const z = parseInt(cs.zIndex, 10) || 0;
  const op = parseFloat(cs.opacity) || 0;
  const ariaHidden = el.getAttribute('aria-hidden') === 'true' ? -50 : 0;
  const activeClass = /\b(is-active|active|current|visible|show|in)\b/i.test(el.className || '') ? 40 : 0;
  return z * 100 + op * 20 + ariaHidden + activeClass;
}

function duplicateKeepScore(el: Element): number {
  const cs = window.getComputedStyle(el);
  let score = layerScore(el);
  if (cs.position === 'absolute' || cs.position === 'fixed') score -= 90;
  if (cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre') score -= 25;
  if (/^H[1-6]$/.test(el.tagName)) score += 55;
  if (/^(P|FIGCAPTION|LABEL|BLOCKQUOTE)$/.test(el.tagName)) score += 20;
  if (el.getAttribute('aria-hidden') === 'true') score -= 120;
  if (el.hasAttribute('data-clonyfy-stack-hidden')) score -= 200;
  const r = el.getBoundingClientRect();
  score += Math.min(50, r.height / 3);
  return score;
}

function hideInactiveLayer(el: HTMLElement, active: boolean, soft = false): void {
  if (active) {
    el.removeAttribute('data-clonyfy-stack-hidden');
    el.style.opacity = '1';
    el.style.visibility = 'visible';
    el.style.pointerEvents = '';
    el.style.position = el.style.position || '';
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

/** Named carousel/slider containers — keep one active slide. */
export function normalizeCarouselsInDocument(): void {
  const containerSel = CAROUSEL_CONTAINER_SELECTOR;
  const slideSel = '[class*="slide"],[data-slide],[role="group"],li[class*="slide"]';
  const containers = document.querySelectorAll(containerSel);
  containers.forEach((container) => {
    const slides = container.querySelectorAll(slideSel);
    if (slides.length < 2) return;

    let active = container.querySelector(
      '.is-active,.active,.current,[aria-current="true"],[aria-hidden="false"],[data-active="true"],[data-state="active"]',
    );
    if (!active || !container.contains(active)) {
      let best: Element = slides[0];
      let bestScore = -1;
      slides.forEach((slide) => {
        const score = layerScore(slide);
        if (score > bestScore) {
          bestScore = score;
          best = slide;
        }
      });
      active = best;
    }

    slides.forEach((slide) => {
      const el = slide as HTMLElement;
      const isActive = slide === active || slide.contains(active) || active?.contains(slide);
      hideInactiveLayer(el, !!isActive, true);
    });
  });
}

/**
 * Shopify-style hero text rotators stack multiple phrases in the same box
 * (absolute/relative + animation). Without JS they all paint and overlap.
 * Detect geometric stacks and keep only the strongest layer.
 */
export function normalizeStackedTextRotatorsInDocument(): void {
  const seen = new Set<Element>();

  // Prefer the accessible static headline (sr-only sibling) over the animated stack.
  document.querySelectorAll('[aria-hidden="true"]').forEach((animated) => {
    if (isIntentionalBlendLayer(animated)) return;
    const absCount = animated.querySelectorAll('[class*="absolute"],.absolute').length;
    const fadedCount = animated.querySelectorAll('[class*="opacity-0"],.opacity-0').length;
    if (absCount < 1 && fadedCount < 2) return;
    const prev = animated.previousElementSibling as HTMLElement | null;
    if (!prev) return;
    if (isIntentionalBlendLayer(prev)) return;
    const prevClass = String(prev.className || '');
    const hasFallbackHeading = !!(prev.querySelector('h1,h2,h3') || /^H[1-3]$/.test(prev.tagName));
    const looksSrOnly = /\bsr-only\b|visually-hidden|clip-rect|js-disabled:not-sr-only/i.test(prevClass)
      || prevClass.includes('sr-only');
    if (!hasFallbackHeading && !looksSrOnly) return;

    (animated as HTMLElement).style.setProperty('display', 'none', 'important');
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
    prev.style.setProperty('border', '0', 'important');
    prev.removeAttribute('aria-hidden');
    seen.add(prev);
  });

  // Shopify homepage: .relative > div > span.absolute (one phrase per sibling div)
  document.querySelectorAll('.relative, [class*="relative"]').forEach((rel) => {
    if (seen.has(rel) || (rel as Element).closest?.('[style*="display: none"]')) return;
    const phraseRoots = Array.from(rel.children).filter((child) => {
      if (!child.querySelector) return false;
      const abs = child.querySelector('[class*="absolute"],.absolute');
      if (!abs) return false;
      const text = (child.textContent || '').replace(/\s+/g, ' ').trim();
      return text.length >= 2 && text.length <= 180;
    }) as Element[];
    if (phraseRoots.length < 2) return;

    let active = phraseRoots.find((el) => {
      const live = el.querySelector('[class*="opacity-100"],.opacity-100');
      const dead = el.querySelector('[class*="opacity-0"],.opacity-0,[class*="translate-y-100"],[class*="translate-y-full"]');
      return !!live && !dead;
    }) || null;
    if (!active) {
      active = phraseRoots.reduce((best, el) => {
        const spans = el.querySelectorAll('span');
        let score = 0;
        spans.forEach((s) => { score += layerScore(s); });
        const bestScore = Array.from(best.querySelectorAll('span')).reduce((n, s) => n + layerScore(s), 0);
        return score > bestScore ? el : best;
      }, phraseRoots[0]);
    }

    (rel as HTMLElement).classList.add('clonyfy-stacked-rotator');
    phraseRoots.forEach((el) => {
      seen.add(el);
      hideInactiveLayer(el as HTMLElement, el === active, false);
      el.querySelectorAll('span').forEach((span) => {
        hideInactiveLayer(span as HTMLElement, el === active, false);
      });
    });
  });

  const parents = document.querySelectorAll('h1,h2,h3,[class*="hero"],[class*="Hero"],[class*="headline"],[class*="Headline"],[class*="banner"],[data-hero],section,header,main');

  parents.forEach((parent) => {
    if (seen.has(parent)) return;
    const children = Array.from(parent.children).filter((el) => {
      if (seen.has(el)) return false;
      if (!looksLikeTextLayer(el)) return false;
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 16) return false;
      const positioned = cs.position === 'absolute' || cs.position === 'fixed' || cs.position === 'sticky';
      const transformed = cs.transform && cs.transform !== 'none';
      const aria = el.hasAttribute('aria-hidden');
      return positioned || transformed || aria || parseFloat(cs.opacity) < 0.95;
    }) as Element[];

    if (children.length < 2) {
      Array.from(parent.children).forEach((wrap) => {
        if (seen.has(wrap)) return;
        const nested = Array.from(wrap.children).filter((el) => looksLikeTextLayer(el)) as Element[];
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
    const kids = Array.from(parent.children).filter((el) => looksLikeTextLayer(el)) as Element[];
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

  normalizeDuplicateTextOverlays(seen);
}

/**
 * Stripe/Framer-style headlines often keep a layout copy + an absolute animation copy
 * of the same phrase. Without site JS both paint and overlap.
 */
function normalizeDuplicateTextOverlays(seen: Set<Element>): void {
  const candidates: Element[] = [];
  document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,a,li,div,label,figcaption,blockquote,strong,em,b').forEach((el) => {
    if (seen.has(el)) return;
    if (el.closest?.('[data-clonyfy-ui],[data-clonyfy-stack-hidden]')) return;
    if (isIntentionalBlendLayer(el)) return;
    if (!looksLikeTextLayer(el)) return;
    const text = normText(el);
    if (text.length < 4 || text.length > 120) return;
    if (el.children.length > 8) return;
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 12) return;
    if (el.children.length === 1 && normText(el.children[0]) === text) return;
    candidates.push(el);
  });

  const groups = new Map<string, Element[]>();
  for (const el of candidates) {
    const key = normText(el);
    const list = groups.get(key);
    if (list) list.push(el);
    else groups.set(key, [el]);
  }

  for (const els of groups.values()) {
    if (els.length < 2) continue;
    if (els.some((el) => isIntentionalBlendLayer(el))) continue;
    const rects = els.map((el) => el.getBoundingClientRect());
    const scores = els.map((el) => duplicateKeepScore(el));
    const hideIdx = new Set<number>();

    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
        if (!rectsOverlapHeavily(rects[i], rects[j])) continue;
        if (scores[i] >= scores[j]) hideIdx.add(j);
        else hideIdx.add(i);
      }
    }

    for (const idx of hideIdx) {
      hideInactiveLayer(els[idx] as HTMLElement, false, false);
      seen.add(els[idx]);
    }
  }
}

function collapseStack(layers: Element[], seen: Set<Element>): void {
  let active = layers.find((el) =>
    el.getAttribute('aria-hidden') === 'false'
    || /\b(is-active|active|current|visible|show|in)\b/i.test(el.className || ''),
  ) || null;
  if (!active) {
    active = layers.reduce((best, el) => (duplicateKeepScore(el) > duplicateKeepScore(best) ? el : best), layers[0]);
  }
  const parent = layers[0]?.parentElement;
  if (parent) {
    parent.classList.add('clonyfy-stacked-rotator');
    const pcs = window.getComputedStyle(parent);
    if (pcs.position === 'static') (parent as HTMLElement).style.position = 'relative';
  }
  layers.forEach((el) => {
    seen.add(el);
    hideInactiveLayer(el as HTMLElement, el === active, false);
  });
}

/**
 * Shell screenshots bake overlapping sibling titles/buttons into the PNG while
 * live DOM still paints them — hide those shells in the captured snapshot too.
 */
export function normalizeShellCaptureOverlapsInDocument(): void {
  document.querySelectorAll('img[data-clonyfy-shell-capture]').forEach((img) => {
    const host = img.parentElement as HTMLElement | null;
    if (!host || host.hasAttribute('data-clonyfy-stack-hidden')) return;
    const cls = String(host.className || '');
    const looksDecorativeBorder = /(?:^|[\s_-])(?:border|overlay|frame|mask|outline)(?:[\s_-]|$)|__border\b/i.test(cls);
    const imgRect = img.getBoundingClientRect();
    if (imgRect.width < 40 || imgRect.height < 40) return;

    let overlapsChrome = looksDecorativeBorder;
    if (!overlapsChrome) {
      const root = host.parentElement || host;
      for (const sib of Array.from(root.children)) {
        if (sib === host) continue;
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
    (img as HTMLElement).style.setProperty('display', 'none', 'important');
  });
}

function isIntentionalBlendLayer(el: Element): boolean {
  const cls = String(el.className || '');
  if (/title--foreground|title--background|hero-section__title/i.test(cls)) return true;
  try {
    const cs = window.getComputedStyle(el);
    if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') return true;
  } catch { /* ignore */ }
  const sib = el.nextElementSibling || el.previousElementSibling;
  if (sib && /title--foreground|title--background/i.test(String(sib.className || ''))) return true;
  return false;
}

export function restoreHeroBlendLayersInDocument(): void {
  document.querySelectorAll(
    '.hero-section__title--foreground, .hero-section__title--background, [class*="title--foreground"], [class*="title--background"]',
  ).forEach((node) => {
    const el = node as HTMLElement;
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

export function normalizeAllMotionStacksInDocument(): void {
  restoreHeroBlendLayersInDocument();
  normalizeCarouselsInDocument();
  normalizeStackedTextRotatorsInDocument();
  normalizeShellCaptureOverlapsInDocument();
  restoreHeroBlendLayersInDocument();
}

export function isInsideCarousel(el: Element | null): boolean {
  return !!(el && 'closest' in el && (el as Element).closest(CAROUSEL_SKIP_SELECTOR));
}

export function domAssetUrlScore(url: string): number {
  if (/shopify-brochure|\/b\/shopify/i.test(url)) return 12;
  if (/\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/i.test(url)) return 10;
  if (/\.(css|woff2?|ttf|otf|eot)(\?|$)/i.test(url)) return 9;
  if (/cdn\.shopify|shopifycdn|shopify\.com\/.*\/assets/i.test(url)) return 9;
  if (/images\.stripe|stripe\.com\/.*\.(png|jpe?g|webp|avif|gif|svg)/i.test(url)) return 9;
  if (/\/files\/|\/assets\/|\/media\/|\/images\//i.test(url)) return 7;
  return 1;
}
