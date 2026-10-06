/**
 * Clonyfy Scene Graph exporter (no screenshots).
 * format: "svg" (default) | "scene" — scene returns Figma Scene Graph v1 JSON.
 *
 * Mirrors what the browser actually paints:
 * - effective visibility (ancestor opacity, overflow / clip-path / clip clipping)
 * - CSS paint order (stacking contexts, block backgrounds below inline content)
 * - exact per-line text runs from layout, baselines from font metrics
 * - resolved text paint (-webkit-text-fill-color, gradient text, mix-blend-mode)
 * - inline <svg> with computed paint, canvas snapshots, background-size/position
 */
export default async function figmaExportPage(options = {}) {
  const viewportWidth = Number(options.viewportWidth) || 1440;
  const maxLayers = Math.min(Math.max(Number(options.maxLayers) || 4500, 500), 8000);
  const maxEmbeddedImageBytes = Math.min(
    Math.max(Number(options.maxEmbeddedImageBytes) || 180_000, 24_000),
    3_000_000,
  );
  const format = options.format === 'scene' ? 'scene' : 'svg';
  let embeddedImageBudget = Math.min(
    Math.max(Number(options.embeddedImageBudget) || (maxEmbeddedImageBytes * 12), maxEmbeddedImageBytes),
    30_000_000,
  );
  const lowRes = maxEmbeddedImageBytes <= 200_000;

  /* ------------------------------------------------------------------ utils */

  function svgEsc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
    }[ch]));
  }

  function num(v) {
    return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
  }

  function absRect(el) {
    const r = el.getBoundingClientRect();
    return { x: num(r.left + window.scrollX), y: num(r.top + window.scrollY), w: num(r.width), h: num(r.height) };
  }

  function intersect(a, b) {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.w, b.x + b.w);
    const y2 = Math.min(a.y + a.h, b.y + b.h);
    return { x, y, w: Math.max(0, x2 - x), h: Math.max(0, y2 - y) };
  }

  function layerId(el, suffix = '') {
    const base = el.getAttribute?.('data-framer-name')
      || el.getAttribute?.('aria-label')
      || el.id
      || (typeof el.className === 'string' && el.className.trim().split(/\s+/)[0])
      || el.tagName.toLowerCase();
    const clean = String(base).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'layer';
    return `${clean}${suffix}`;
  }

  /* ----------------------------------------------------------------- colors */

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = 1;
  colorCanvas.height = 1;
  const colorCtx = colorCanvas.getContext('2d', { willReadFrequently: true });
  const colorCache = new Map();

  /** Any CSS color (rgb, hex, oklch, color(), …) → {r,g,b,a} in sRGB 0–255. */
  function rgba(color) {
    const key = String(color || '').trim();
    if (colorCache.has(key)) return colorCache.get(key);
    let out = null;
    if (!key || key === 'transparent' || key === 'none') out = { r: 0, g: 0, b: 0, a: 0 };
    else {
      const m = key.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
      if (m) {
        const a = m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
        out = { r: +m[1], g: +m[2], b: +m[3], a: Number.isFinite(a) ? a : 1 };
      } else if (colorCtx) {
        try {
          colorCtx.clearRect(0, 0, 1, 1);
          colorCtx.fillStyle = '#000';
          colorCtx.fillStyle = key;
          colorCtx.fillRect(0, 0, 1, 1);
          const d = colorCtx.getImageData(0, 0, 1, 1).data;
          out = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
        } catch {}
      }
    }
    out = out || { r: 0, g: 0, b: 0, a: 1 };
    colorCache.set(key, out);
    return out;
  }

  function hex(c) {
    return `#${[c.r, c.g, c.b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
  }

  function cssRgba(c, extraAlpha = 1) {
    return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${num(c.a * extraAlpha)})`;
  }

  /** ` fill="#hex" fill-opacity=".5"` — Figma's SVG importer does not read rgba() reliably. */
  function paintAttr(name, color) {
    const c = typeof color === 'object' ? color : rgba(color);
    return ` ${name}="${hex(c)}"${c.a < 0.999 ? ` ${name}-opacity="${num(c.a)}"` : ''}`;
  }

  function blendChannel(mode, b, s) {
    switch (mode) {
      case 'multiply': return b * s;
      case 'screen': return b + s - b * s;
      case 'overlay': return blendChannel('hard-light', s, b);
      case 'darken': return Math.min(b, s);
      case 'lighten': return Math.max(b, s);
      case 'color-dodge': return b === 0 ? 0 : (s >= 1 ? 1 : Math.min(1, b / (1 - s)));
      case 'color-burn': return b >= 1 ? 1 : (s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s));
      case 'hard-light': return s <= 0.5 ? b * 2 * s : blendChannel('screen', b, 2 * s - 1);
      case 'soft-light': {
        if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
        const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
        return b + (2 * s - 1) * (d - b);
      }
      case 'difference': return Math.abs(b - s);
      case 'exclusion': return b + s - 2 * b * s;
      default: return s;
    }
  }

  /** Source color blended onto an opaque backdrop → opaque result. */
  function composite(mode, back, src, srcAlpha) {
    const out = { a: 1 };
    for (const k of ['r', 'g', 'b']) {
      const b = back[k] / 255;
      const s = src[k] / 255;
      out[k] = ((1 - srcAlpha) * b + srcAlpha * blendChannel(mode, b, s)) * 255;
    }
    return out;
  }

  /* --------------------------------------------------------------- geometry */

  function radii(cs) {
    const tl = parseFloat(cs.borderTopLeftRadius) || 0;
    const tr = parseFloat(cs.borderTopRightRadius) || 0;
    const br = parseFloat(cs.borderBottomRightRadius) || 0;
    const bl = parseFloat(cs.borderBottomLeftRadius) || 0;
    if (tl === tr && tr === br && br === bl) return { rx: tl, uniform: true, tl, tr, br, bl };
    return { tl, tr, br, bl, uniform: false, rx: Math.max(tl, tr, br, bl) };
  }

  function clampRadii(rad, r) {
    const max = Math.min(r.w, r.h) / 2;
    return {
      tl: Math.min(rad.tl, max), tr: Math.min(rad.tr, max), br: Math.min(rad.br, max), bl: Math.min(rad.bl, max),
      uniform: rad.uniform, rx: Math.min(rad.rx, max),
    };
  }

  /** <rect> or <path> for a (possibly per-corner) rounded box. */
  function boxShape(r, rad, attrs) {
    const c = clampRadii(rad || { tl: 0, tr: 0, br: 0, bl: 0, uniform: true, rx: 0 }, r);
    if (c.uniform) {
      const rx = c.rx > 0 ? ` rx="${num(c.rx)}"` : '';
      return `<rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}"${rx}${attrs}/>`;
    }
    const { x, y, w, h } = r;
    const d = [
      `M${num(x + c.tl)},${num(y)}`,
      `H${num(x + w - c.tr)}`, c.tr ? `A${num(c.tr)},${num(c.tr)} 0 0 1 ${num(x + w)},${num(y + c.tr)}` : '',
      `V${num(y + h - c.br)}`, c.br ? `A${num(c.br)},${num(c.br)} 0 0 1 ${num(x + w - c.br)},${num(y + h)}` : '',
      `H${num(x + c.bl)}`, c.bl ? `A${num(c.bl)},${num(c.bl)} 0 0 1 ${num(x)},${num(y + h - c.bl)}` : '',
      `V${num(y + c.tl)}`, c.tl ? `A${num(c.tl)},${num(c.tl)} 0 0 1 ${num(x + c.tl)},${num(y)}` : '',
      'Z',
    ].filter(Boolean).join(' ');
    return `<path d="${d}"${attrs}/>`;
  }

  function lengthPx(v, ref) {
    const s = String(v || '').trim();
    if (!s || s === 'auto') return null;
    if (s.endsWith('%')) return (parseFloat(s) / 100) * ref;
    const calc = s.match(/^calc\((.+)\)$/);
    if (calc) {
      let total = 0;
      for (const m of calc[1].matchAll(/([+-]?\s*[\d.]+)(px|%)/g)) {
        const n = parseFloat(m[1].replace(/\s+/g, ''));
        total += m[2] === '%' ? (n / 100) * ref : n;
      }
      return total;
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }

  /** clip-path: inset(...) → absolute rect (other shapes are ignored). */
  function clipPathRect(cs, r) {
    const cp = String(cs.clipPath || 'none');
    const m = cp.match(/^inset\(([^)]*?)(?:\s+round[^)]*)?\)$/);
    if (!m) return null;
    const parts = m[1].trim().split(/\s+/);
    const [t, rt = t, b = t, l = rt] = parts;
    const top = lengthPx(t, r.h) || 0;
    const right = lengthPx(rt, r.w) || 0;
    const bottom = lengthPx(b, r.h) || 0;
    const left = lengthPx(l, r.w) || 0;
    return { x: r.x + left, y: r.y + top, w: Math.max(0, r.w - left - right), h: Math.max(0, r.h - top - bottom) };
  }

  /** Legacy clip: rect(t, r, b, l) on absolutely positioned elements. */
  function legacyClipRect(cs, r) {
    const m = String(cs.clip || '').match(/^rect\(([^)]+)\)$/);
    if (!m) return null;
    const v = m[1].split(/[\s,]+/).map((s) => (s === 'auto' ? null : parseFloat(s)));
    const top = v[0] ?? 0;
    const right = v[1] ?? r.w;
    const bottom = v[2] ?? r.h;
    const left = v[3] ?? 0;
    return { x: r.x + left, y: r.y + top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) };
  }

  /* ------------------------------------------------- effective element state */

  const ROOT_EFF = { opacity: 1, clips: [], masks: [], z: [], sc: [], selfSc: true, blend: null };
  const effCache = new Map();
  let scSeq = 0;

  /**
   * Inherited render state: cumulative opacity, clip chain, stacking key and
   * blend mode. Opacity and clipping are NOT inherited by getComputedStyle,
   * so children of hidden/clipped wrappers must be checked here.
   */
  function eff(el) {
    if (!el || el.nodeType !== 1 || el === document.documentElement) return ROOT_EFF;
    const hit = effCache.get(el);
    if (hit) return hit;
    const p = el === document.body ? ROOT_EFF : eff(el.parentElement);
    const cs = getComputedStyle(el);
    const o = parseFloat(cs.opacity);
    const ownOpacity = Number.isFinite(o) ? o : 1;
    const opacity = p.opacity * ownOpacity;

    let clips = p.clips;
    if (cs.position === 'fixed') clips = clips.filter((c) => c.always);
    else if (cs.position === 'absolute' && clips.length) {
      const cb = el.offsetParent;
      if (cb) clips = clips.filter((c) => c.always || c.positioned || c.el === cb || c.el.contains(cb));
    }
    let r = null;
    const rectOf = () => (r || (r = absRect(el)));
    if (el !== document.body && (cs.overflowX !== 'visible' || cs.overflowY !== 'visible')) {
      const b = rectOf();
      const rect = {
        x: cs.overflowX === 'visible' ? -1e6 : b.x,
        y: cs.overflowY === 'visible' ? -1e6 : b.y,
        w: cs.overflowX === 'visible' ? 2e6 : b.w,
        h: cs.overflowY === 'visible' ? 2e6 : b.h,
      };
      clips = clips.concat([{
        el, rect, rad: radii(cs), positioned: cs.position !== 'static' || cs.transform !== 'none', always: false,
      }]);
    }
    if (cs.clipPath && cs.clipPath !== 'none') {
      const cr = clipPathRect(cs, rectOf());
      if (cr) clips = clips.concat([{ el, rect: cr, rad: null, positioned: true, always: true }]);
    }
    if ((cs.position === 'absolute' || cs.position === 'fixed') && cs.clip && cs.clip !== 'auto') {
      const cr = legacyClipRect(cs, rectOf());
      if (cr) clips = clips.concat([{ el, rect: cr, rad: null, positioned: true, always: true }]);
    }
    // Masks only paint inside the element box (e.g. rolling-digit counters);
    // gradient masks additionally fade content (exported as SVG <mask>).
    let masks = p.masks;
    const mask = cs.maskImage || cs.webkitMaskImage;
    if (mask && mask !== 'none') {
      clips = clips.concat([{ el, rect: rectOf(), rad: null, positioned: true, always: true }]);
      const grads = splitTopLevel(mask).filter((m) => /gradient\(/i.test(m));
      if (grads.length && !/url\(/i.test(mask)) masks = masks.concat([{ el, css: grads, rect: rectOf() }]);
    }

    // Stacking: `sc` = key of the nearest real stacking context, `z` = key this
    // element's own painting uses. Positioned z-auto boxes paint atomically at
    // level 0 but do not trap z-indexed descendants (those use `sc`).
    const zi = cs.zIndex === 'auto' ? null : parseInt(cs.zIndex, 10);
    const parentDisplay = el.parentElement ? getComputedStyle(el.parentElement).display : '';
    const positioned = cs.position !== 'static';
    const zApplies = zi !== null && (positioned || /flex|grid/.test(parentDisplay));
    const selfSc = zApplies || cs.position === 'fixed' || cs.position === 'sticky'
      || ownOpacity < 1 || cs.transform !== 'none' || cs.filter !== 'none'
      || cs.isolation === 'isolate' || (cs.mixBlendMode && cs.mixBlendMode !== 'normal')
      || /paint|strict|content/.test(cs.contain || '');
    let z = p.z;
    let sc = p.sc;
    if (selfSc) {
      const level = zApplies ? (zi === 0 ? 0.5 : zi + (zi > 0 ? 0.5 : 0)) : 0.5;
      z = p.sc.concat([level, ++scSeq]);
      sc = z;
    } else if (positioned) {
      z = p.sc.concat([0.5, ++scSeq]);
    }

    const blend = cs.mixBlendMode && cs.mixBlendMode !== 'normal' ? cs.mixBlendMode : p.blend;
    const e = { opacity, clips, masks, z, sc, selfSc, blend };
    effCache.set(el, e);
    return e;
  }

  function clipOf(e) {
    if (!e.clips.length) return null;
    if (e._clip !== undefined) return e._clip;
    let rect = null;
    for (const c of e.clips) rect = rect ? intersect(rect, c.rect) : { ...c.rect };
    const last = e.clips[e.clips.length - 1];
    const rad = last.rad && last.rad.rx > 0 && Math.abs(rect.w - last.rect.w) < 1 && Math.abs(rect.h - last.rect.h) < 1
      ? last.rad : null;
    e._clip = { rect, rad };
    return e._clip;
  }

  /* ------------------------------------------------------------------ images */

  const imageCache = new Map();
  const sizeCache = new Map();

  function absUrl(src) {
    try { return new URL(src, document.baseURI || location.href).href; } catch { return src; }
  }

  async function naturalSize(src) {
    const abs = absUrl(src);
    if (sizeCache.has(abs)) return sizeCache.get(abs);
    const p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = abs;
      setTimeout(() => resolve({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 }), 4000);
    });
    sizeCache.set(abs, p);
    return p;
  }

  /** Encode a bitmap source with alpha-aware format choice under a byte cap. */
  function encodeBitmap(source, sw, sh, maxEdge, maxBytes, knownOpaque = false) {
    const scale = Math.min(1, maxEdge / Math.max(sw, sh, 1));
    let w = Math.max(1, Math.round(sw * scale));
    let h = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return '';
    ctx.drawImage(source, 0, 0, w, h);
    let transparent = false;
    if (!knownOpaque) {
      try {
        const px = ctx.getImageData(0, 0, w, h).data;
        for (let i = 3; i < px.length; i += 16) { if (px[i] < 250) { transparent = true; break; } }
      } catch { return ''; }
    }
    const cap = maxBytes * 1.37;
    if (transparent) {
      // JPEG drops alpha (transparent PNG/WebP turn into black boxes) — keep PNG.
      let png = canvas.toDataURL('image/png');
      while (png.length > cap && Math.max(w, h) > 160) {
        w = Math.max(1, Math.round(w * 0.75));
        h = Math.max(1, Math.round(h * 0.75));
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(source, 0, 0, w, h);
        png = canvas.toDataURL('image/png');
      }
      return png.length <= cap ? png : '';
    }
    let quality = lowRes ? 0.6 : 0.86;
    let out = canvas.toDataURL('image/jpeg', quality);
    while (out.length > cap && quality > 0.4) {
      quality -= 0.1;
      out = canvas.toDataURL('image/jpeg', quality);
    }
    return out.length <= cap ? out : '';
  }

  function targetEdge(drawW, drawH) {
    if (lowRes) return 640;
    return Math.min(2400, Math.max(256, Math.ceil(Math.max(drawW || 0, drawH || 0) * 2)));
  }

  async function inlineImage(src, drawW = 0, drawH = 0) {
    if (!src) return '';
    if (src.startsWith('data:')) return src;
    const edge = targetEdge(drawW, drawH);
    const abs = absUrl(src);
    const key = `${abs}@${edge}`;
    if (imageCache.has(key)) return imageCache.get(key);
    const job = (async () => {
    if (embeddedImageBudget <= 0) return '';
    try {
      const res = await fetch(abs, { credentials: 'omit' });
      if (!res.ok) return '';
      const blob = await res.blob();
      if (!blob.size) return '';
        let out = '';
        if (typeof createImageBitmap === 'function' && /^image\/(png|jpeg|jpg|webp|gif|avif)/i.test(blob.type || 'image/png')) {
        try {
          const bmp = await createImageBitmap(blob);
            out = encodeBitmap(bmp, bmp.width, bmp.height, edge, maxEmbeddedImageBytes, /^image\/jpe?g/i.test(blob.type || ''));
            try { bmp.close(); } catch {}
          } catch {}
        }
        // figma.createImage only accepts PNG/JPEG/GIF — rasterize SVG (and
        // anything else the bitmap path missed) for the plugin scene.
        if (!out && format === 'scene') {
          out = await new Promise((resolve) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
              let enc = '';
              try {
                const w = img.naturalWidth || drawW || 300;
                const h = img.naturalHeight || drawH || 150;
                const fit = Math.max((drawW || w) * 2 / w, (drawH || h) * 2 / h, 1);
                enc = encodeBitmap(img, w * fit, h * fit, edge, maxEmbeddedImageBytes);
        } catch {}
              URL.revokeObjectURL(url);
              resolve(enc);
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
            img.src = url;
          });
        }
        if (!out && blob.size <= maxEmbeddedImageBytes && (format !== 'scene' || /^image\/(png|jpe?g|gif)/i.test(blob.type || ''))) {
          out = await new Promise((resolve) => {
        const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });
          if (out.length > maxEmbeddedImageBytes * 1.37) out = '';
        }
        if (out) embeddedImageBudget -= out.length;
        return out;
    } catch {
      return '';
    }
    })();
    imageCache.set(key, job);
    return job;
  }

  /** object-fit / object-position → drawn image rect inside the element box. */
  function objectFitRect(box, nat, cs) {
    const fit = cs.objectFit || 'fill';
    if (!nat.w || !nat.h || fit === 'fill') return { ...box };
    let s = 1;
    if (fit === 'cover') s = Math.max(box.w / nat.w, box.h / nat.h);
    else if (fit === 'contain') s = Math.min(box.w / nat.w, box.h / nat.h);
    else if (fit === 'scale-down') s = Math.min(1, Math.min(box.w / nat.w, box.h / nat.h));
    const w = nat.w * s;
    const h = nat.h * s;
    const [px = '50%', py = '50%'] = String(cs.objectPosition || '50% 50%').split(/\s+/);
    return { x: box.x + (lengthPx(px, box.w - w) ?? (box.w - w) / 2), y: box.y + (lengthPx(py, box.h - h) ?? (box.h - h) / 2), w, h };
  }

  /* --------------------------------------------------------------- gradients */

  const defs = [];
  let defSeq = 0;

  function splitTopLevel(s) {
    const out = [];
    let depth = 0;
    let cur = '';
    for (const ch of String(s)) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function parseStops(parts, lineLen) {
    const stops = [];
    for (const raw of parts) {
      const m = raw.match(/^(.*?\))\s*(.*)$/) || raw.match(/^(\S+)\s*(.*)$/);
      if (!m) continue;
      const color = m[1].trim();
      if (!/^(rgb|hsl|#|color|oklch|oklab|lab|lch|transparent|[a-z]+$)/i.test(color)) continue;
      const poss = (m[2] || '').trim().split(/\s+/).filter(Boolean)
        .map((p) => (p.endsWith('%') ? parseFloat(p) / 100 : (lineLen ? (parseFloat(p) || 0) / lineLen : null)));
      if (!poss.length) stops.push({ color, pos: null });
      else for (const pos of poss) stops.push({ color, pos });
    }
    if (!stops.length) return stops;
    if (stops[0].pos == null) stops[0].pos = 0;
    if (stops[stops.length - 1].pos == null) stops[stops.length - 1].pos = 1;
    for (let i = 1; i < stops.length; i++) {
      if (stops[i].pos != null) continue;
      let j = i;
      while (stops[j].pos == null) j++;
      const a = stops[i - 1].pos;
      const b = stops[j].pos;
      for (let k = i; k < j; k++) stops[k].pos = a + ((b - a) * (k - i + 1)) / (j - i + 1);
    }
    let prev = -Infinity;
    for (const s of stops) { s.pos = Math.max(prev, s.pos); prev = s.pos; }
    // SVG offsets are limited to 0–1; resample the colour at the box edges
    // so stops placed outside (e.g. -380% / 110%) keep the visible blend.
    const colorAt = (t) => {
      if (t <= stops[0].pos) return rgba(stops[0].color);
      for (let i = 1; i < stops.length; i++) {
        const a = stops[i - 1];
        const b = stops[i];
        if (t <= b.pos) {
          const k = b.pos === a.pos ? 1 : (t - a.pos) / (b.pos - a.pos);
          const ca = rgba(a.color);
          const cb = rgba(b.color);
          return { r: ca.r + (cb.r - ca.r) * k, g: ca.g + (cb.g - ca.g) * k, b: ca.b + (cb.b - ca.b) * k, a: ca.a + (cb.a - ca.a) * k };
        }
      }
      return rgba(stops[stops.length - 1].color);
    };
    const toCss = (c) => `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${num(c.a)})`;
    if (stops[0].pos >= 0 && stops[stops.length - 1].pos <= 1) return stops;
    const start = { color: toCss(colorAt(0)), pos: 0 };
    const end = { color: toCss(colorAt(1)), pos: 1 };
    return [start, ...stops.filter((s) => s.pos > 0 && s.pos < 1), end];
  }

  function over(src, under) {
    if (!under || under.a <= 0.001) return src;
    const a = src.a + under.a * (1 - src.a);
    if (a <= 0.001) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = (s, u) => (s * src.a + u * under.a * (1 - src.a)) / a;
    return { r: mix(src.r, under.r), g: mix(src.g, under.g), b: mix(src.b, under.b), a };
  }

  /**
   * `under`: colour painted beneath the gradient (background-color under a
   * background-image). `alphaMask`: emit white stops carrying only alpha, for
   * SVG <mask> (CSS mask-image is alpha-based, SVG masks are luminance-based).
   */
  function stopSvg(stops, { under = null, alphaMask = false } = {}) {
    return stops.map((s) => {
      const c = over(rgba(s.color), under);
      if (alphaMask) return `<stop offset="${num(s.pos * 100)}%" stop-color="#ffffff" stop-opacity="${num(c.a)}"/>`;
      return `<stop offset="${num(s.pos * 100)}%" stop-color="${hex(c)}"${c.a < 0.999 ? ` stop-opacity="${num(c.a)}"` : ''}/>`;
    }).join('');
  }

  /** CSS linear/radial gradient → userSpaceOnUse SVG gradient for this exact box. */
  function gradientDef(css, r, stopOpts = {}) {
    const s = String(css);
    const lin = s.match(/^(repeating-)?linear-gradient\((.*)\)$/i);
    const rad = s.match(/^(repeating-)?radial-gradient\((.*)\)$/i);
    const id = `g${++defSeq}`;
    if (lin) {
      const parts = splitTopLevel(lin[2]);
    let angle = 180;
      if (/^(-?[\d.]+(deg|turn|rad|grad)|to\s)/i.test(parts[0])) {
        const head = parts.shift();
        const deg = head.match(/(-?[\d.]+)deg/i);
        const turn = head.match(/(-?[\d.]+)turn/i);
        const radv = head.match(/(-?[\d.]+)rad/i);
      if (deg) angle = parseFloat(deg[1]);
        else if (turn) angle = parseFloat(turn[1]) * 360;
        else if (radv) angle = (parseFloat(radv[1]) * 180) / Math.PI;
        else {
          const h = head.toLowerCase();
          const top = h.includes('top');
          const bottom = h.includes('bottom');
          const left = h.includes('left');
          const right = h.includes('right');
          if ((top || bottom) && (left || right)) {
            const a = (Math.atan2(r.w, r.h) * 180) / Math.PI;
            angle = top ? (right ? a : 360 - a) : (right ? 180 - a : 180 + a);
          } else if (top) angle = 0;
          else if (right) angle = 90;
          else if (left) angle = 270;
          else angle = 180;
        }
      }
      const t = (angle * Math.PI) / 180;
      const len = Math.abs(r.w * Math.sin(t)) + Math.abs(r.h * Math.cos(t));
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const dx = (Math.sin(t) * len) / 2;
      const dy = (-Math.cos(t) * len) / 2;
      const stops = parseStops(parts, len);
      if (!stops.length) return null;
      defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(cx - dx)}" y1="${num(cy - dy)}" x2="${num(cx + dx)}" y2="${num(cy + dy)}"${lin[1] ? ' spreadMethod="repeat"' : ''}>${stopSvg(stops, stopOpts)}</linearGradient>`);
      return { id, stops, angle };
    }
    if (rad) {
      const parts = splitTopLevel(rad[2]);
      let cx = r.x + r.w / 2;
      let cy = r.y + r.h / 2;
      let circle = false;
      let size = 'farthest-corner';
      let explicit = null;
      if (!/^(rgb|hsl|#|color|oklch|transparent)/i.test(parts[0])) {
        const head = parts.shift();
        circle = /circle/i.test(head);
        const sz = head.match(/(closest-side|closest-corner|farthest-side|farthest-corner)/i);
        if (sz) size = sz[1].toLowerCase();
        const at = head.match(/at\s+(\S+)(?:\s+(\S+))?/i);
        if (at) {
          const kw = { left: '0%', center: '50%', right: '100%', top: '0%', bottom: '100%' };
          cx = r.x + (lengthPx(kw[at[1]] || at[1], r.w) ?? r.w / 2);
          cy = r.y + (lengthPx(kw[at[2] || 'center'] || at[2], r.h) ?? r.h / 2);
        }
        const lens = head.replace(/at\s+.*/i, '').match(/(-?[\d.]+(px|%))/g);
        if (lens) explicit = lens.map((v, i) => lengthPx(v, i === 0 ? r.w : r.h));
      }
      const dl = cx - r.x;
      const dr = r.x + r.w - cx;
      const dt = cy - r.y;
      const db = r.y + r.h - cy;
      let rx;
      let ry;
      if (explicit) { rx = explicit[0]; ry = explicit[1] ?? explicit[0]; } else {
        const sideX = size.includes('closest') ? Math.min(dl, dr) : Math.max(dl, dr);
        const sideY = size.includes('closest') ? Math.min(dt, db) : Math.max(dt, db);
        if (circle) {
          const v = size.includes('corner') ? Math.hypot(sideX, sideY) : (size.includes('closest') ? Math.min(sideX, sideY) : Math.max(sideX, sideY));
          rx = v; ry = v;
        } else if (size.includes('corner')) { rx = sideX * Math.SQRT2; ry = sideY * Math.SQRT2; } else { rx = sideX; ry = sideY; }
      }
      rx = Math.max(0.5, rx || 0.5);
      ry = Math.max(0.5, ry || 0.5);
      const stops = parseStops(parts, rx);
      if (!stops.length) return null;
      defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${num(cx)} ${num(cy)}) scale(${num(rx)} ${num(ry)})"${rad[1] ? ' spreadMethod="repeat"' : ''}>${stopSvg(stops, stopOpts)}</radialGradient>`);
      return { id, stops, angle: 180 };
    }
    return null;
  }

  function gradientFirstColor(css) {
    const inner = String(css || '').replace(/^[^(]*\(/, '').replace(/\)$/, '');
    return parseStops(splitTopLevel(inner), 0)[0]?.color || null;
  }

  function gradientSceneFill(g) {
    return {
      type: 'GRADIENT_LINEAR',
      angle: num(g.angle),
      stops: g.stops.map((s) => ({ color: cssRgba(rgba(s.color)), position: num(s.pos) })),
    };
  }

  /* -------------------------------------------------------------------- text */

  const measureCtx = document.createElement('canvas').getContext('2d');
  const metricsCache = new Map();

  function fontMetrics(cs) {
    const size = parseFloat(cs.fontSize) || 16;
    const font = `${cs.fontStyle || 'normal'} ${cs.fontWeight || '400'} ${size}px ${cs.fontFamily || 'sans-serif'}`;
    if (metricsCache.has(font)) return metricsCache.get(font);
    let asc = size * 0.8;
    let desc = size * 0.2;
    try {
      measureCtx.font = font;
      const m = measureCtx.measureText('Hgjy');
      if (m.fontBoundingBoxAscent > 0) { asc = m.fontBoundingBoxAscent; desc = m.fontBoundingBoxDescent; }
    } catch {}
    const out = { asc, desc };
    metricsCache.set(font, out);
    return out;
  }

  function applyTextTransform(text, transform) {
    const t = String(transform || '').toLowerCase();
    if (t === 'uppercase') return text.toUpperCase();
    if (t === 'lowercase') return text.toLowerCase();
    if (t === 'capitalize') return text.replace(/\b\w/g, (c) => c.toUpperCase());
    return text;
  }

  function fontStack(cs) {
    const fam = String(cs.fontFamily || 'sans-serif');
    return /\b(sans-serif|serif|monospace|system-ui|cursive|fantasy)\b/i.test(fam) ? fam : `${fam}, sans-serif`;
  }

  function primaryFont(cs) {
    return (cs.fontFamily || 'Inter').split(',')[0].replace(/['"]/g, '').trim() || 'Inter';
  }

  /** Exact visual lines of a text node: words grouped by their laid-out line box. */
  function textLines(node) {
    const text = node.nodeValue || '';
    const range = document.createRange();
    const lines = [];
    const addPiece = (s, e, rc) => {
      const last = lines[lines.length - 1];
      if (last && Math.abs(rc.top - last.top) < Math.max(2, rc.height * 0.5) && rc.left >= last.right - 3) {
        last.e = e;
        last.right = Math.max(last.right, rc.right);
        last.top = Math.min(last.top, rc.top);
        last.bottom = Math.max(last.bottom, rc.bottom);
      } else {
        lines.push({ s, e, left: rc.left, right: rc.right, top: rc.top, bottom: rc.bottom });
      }
    };
    const re = /\S+/g;
    let m;
    while ((m = re.exec(text))) {
      const s = m.index;
      const e = s + m[0].length;
      try {
        range.setStart(node, s);
        range.setEnd(node, e);
      } catch { continue; }
      const rs = [...range.getClientRects()].filter((rc) => rc.width > 0.2 && rc.height > 0.2);
      if (!rs.length) continue;
      if (rs.length === 1) { addPiece(s, e, rs[0]); continue; }
      // A "word" spanning lines (CJK runs, break-all): place char by char.
      for (let i = s; i < e; i++) {
        try {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
        } catch { continue; }
        const rc = range.getClientRects()[0];
        if (rc && rc.width > 0.1) addPiece(i, i + 1, rc);
      }
    }
    return lines.map((l) => ({
      text: text.slice(l.s, l.e).replace(/\s+/g, ' '),
      rect: { left: l.left, top: l.top, width: l.right - l.left, height: l.bottom - l.top },
    }));
  }

  /** What actually colors the glyphs: fill color, gradient text, or nothing. */
  function textPaint(el, cs) {
    const c = rgba(cs.webkitTextFillColor || cs.color);
    if (c.a > 0.01) return { color: c };
    for (let a = el, i = 0; a && i < 6; a = a.parentElement, i++) {
      const acs = getComputedStyle(a);
      const clip = acs.webkitBackgroundClip || acs.backgroundClip || '';
      if (!/text/.test(clip)) continue;
      const under = rgba(acs.backgroundColor);
      if (/gradient\(/i.test(acs.backgroundImage)) {
        return {
          gradient: splitTopLevel(acs.backgroundImage).find((l) => /gradient\(/i.test(l)),
          gradRect: absRect(a),
          under: under.a > 0.01 ? under : null,
        };
      }
      if (under.a > 0.01) return { color: under };
    }
    return null;
  }

  function lineHeightPx(cs, fontSize, fallback) {
    const raw = String(cs.lineHeight || '').trim();
    if (!raw || raw === 'normal') return num(fallback || fontSize * 1.2);
    if (raw.endsWith('px')) return num(parseFloat(raw) || fontSize * 1.2);
    const n = parseFloat(raw);
    return num(Number.isFinite(n) ? n * fontSize : fontSize * 1.2);
  }

  function mapTextDecoration(cs) {
    const td = String(cs.textDecorationLine || cs.textDecoration || '').toLowerCase();
    if (td.includes('underline')) return 'underline';
    if (td.includes('line-through')) return 'line-through';
    return 'none';
  }

  /* ------------------------------------------------------------ preparation */

  function revealScrollReveal() {
    try {
      document.querySelectorAll('.clonyfy-reveal').forEach((el) => {
        el.classList.add('clonyfy-in');
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('transform', 'none', 'important');
      });
      document.getElementById('clonyfy-scroll-reveal-style')?.remove();
    } catch {}
  }

  async function expandLazyContent() {
    document.querySelectorAll('[style*="content-visibility"]').forEach((el) => {
      try { el.style.setProperty('content-visibility', 'visible', 'important'); } catch {}
    });
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
      try { img.loading = 'eager'; } catch {}
    });
    document.querySelectorAll('[data-src],[data-lazy-src]').forEach((el) => {
      const real = el.getAttribute('data-src') || el.getAttribute('data-lazy-src');
      if (real && el.tagName === 'IMG' && !el.getAttribute('src')) el.setAttribute('src', real);
    });
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const step = Math.max(window.innerHeight, 700);
    const maxY = Math.min(document.documentElement.scrollHeight, 32000);
    for (let y = 0; y <= maxY; y += step) {
      window.scrollTo(0, y);
      await delay(45);
    }
    window.scrollTo(0, 0);
    await delay(160);
  }

  revealScrollReveal();
  await expandLazyContent();

  const width = Math.ceil(Math.max(viewportWidth, document.documentElement.clientWidth || 0, 320));
  const height = Math.ceil(Math.max(
    document.documentElement.scrollHeight,
    document.body?.scrollHeight || 0,
    320,
  ));
  const pageRect = { x: 0, y: 0, w: width, h: height };

  const bodyBgC = rgba(getComputedStyle(document.body).backgroundColor);
  const htmlBgC = rgba(getComputedStyle(document.documentElement).backgroundColor);
  const pageBgC = bodyBgC.a > 0.04 ? bodyBgC : (htmlBgC.a > 0.04 ? htmlBgC : { r: 255, g: 255, b: 255, a: 1 });

  /* ------------------------------------------------------------------ layers */

  const layers = [];
  let paintOrder = 0;
  const BG = -1e9;

  function sectionGroup(el) {
    const section = el.closest?.('section[id], section[aria-label], main, header, footer, nav, article');
    return section && section !== el ? layerId(section) : 'Page';
  }

  function needsClip(rect, clip) {
    const c = clip.rect;
    const inside = rect.x >= c.x - 0.5 && rect.y >= c.y - 0.5
      && rect.x + rect.w <= c.x + c.w + 0.5 && rect.y + rect.h <= c.y + c.h + 0.5;
    if (!inside) return true;
    const rx = clip.rad?.rx || 0;
    if (!rx) return false;
    return rect.x < c.x + rx || rect.x + rect.w > c.x + c.w - rx
      ? (rect.y < c.y + rx || rect.y + rect.h > c.y + c.h - rx)
      : false;
  }

  /**
   * Register a layer. Fully clipped layers are dropped; partly clipped ones get
   * a clipPath. `build()` returns the SVG markup (deferred so text paint can be
   * resolved after blend compositing).
   */
  function addLayer({ el, e, rect, z, kind, build, scene, ownClip = null, blend = null, data = null, group = null }) {
    if (layers.length >= maxLayers) return null;
    if (!rect || rect.w < 0.3 || rect.h < 0.3) return null;
    const clip = clipOf(e);
    let clipUse = null;
    if (clip) {
      const vis = intersect(rect, clip.rect);
      if (vis.w < 0.5 || vis.h < 0.5) return null;
      if (needsClip(rect, clip)) clipUse = clip;
      if (scene && clipUse && scene.type === 'RECT' && !clip.rad) {
        Object.assign(scene, { x: num(vis.x), y: num(vis.y), w: num(vis.w), h: num(vis.h) });
      }
    }
    const layer = {
      order: paintOrder++, group: group || sectionGroup(el), kind, rect, z, build, scene,
      clip: clipUse, ownClip, blend, data, el, removed: false, opacity: e.opacity, masks: e.masks || [],
    };
    layers.push(layer);
    return layer;
  }

  /* ---------------------------------------------------------- box painting */

  function bgLayers(cs) {
    const images = String(cs.backgroundImage || 'none') === 'none' ? [] : splitTopLevel(cs.backgroundImage);
    const pick = (v, i) => { const arr = splitTopLevel(v || ''); return arr.length ? arr[i % arr.length] : ''; };
    return images.map((img, i) => ({
      img,
      size: pick(cs.backgroundSize, i) || 'auto',
      posX: pick(cs.backgroundPositionX, i) || '0%',
      posY: pick(cs.backgroundPositionY, i) || '0%',
      repeat: pick(cs.backgroundRepeat, i) || 'repeat',
      clip: pick(cs.backgroundClip, i) || 'border-box',
    }));
  }

  function bgImageRect(box, nat, size, posX, posY) {
    let w;
    let h;
    const s = String(size).trim();
    if ((s === 'cover' || s === 'contain') && nat.w && nat.h) {
      const sc = (s === 'cover' ? Math.max : Math.min)(box.w / nat.w, box.h / nat.h);
      w = nat.w * sc;
      h = nat.h * sc;
    } else {
      const [a, b = 'auto'] = s.split(/\s+/);
      w = lengthPx(a, box.w);
      h = lengthPx(b, box.h);
      if (w == null && h == null) { w = nat.w || box.w; h = nat.h || box.h; } else if (w == null) w = nat.w && nat.h ? nat.w * (h / nat.h) : box.w;
      else if (h == null) h = nat.w && nat.h ? nat.h * (w / nat.w) : box.h;
    }
    return { x: box.x + (lengthPx(posX, box.w - w) ?? 0), y: box.y + (lengthPx(posY, box.h - h) ?? 0), w, h };
  }

  function parseShadows(v) {
    if (!v || v === 'none') return [];
    return splitTopLevel(v).map((s) => {
      const cm = s.match(/(rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]{3,8}\b|color\([^)]*\)|oklch\([^)]*\))/i);
      const rest = cm ? s.replace(cm[1], '') : s;
      const nums = (rest.match(/-?[\d.]+px/g) || []).map(parseFloat);
      const [ox = 0, oy = 0, blur = 0, spread = 0] = nums;
      return { inset: /\binset\b/.test(s), color: rgba(cm ? cm[1] : 'rgba(0,0,0,0.5)'), ox, oy, blur, spread };
    }).filter((s) => !s.inset && s.color.a > 0.01);
  }

  const blurDefs = new Map();
  function blurRef(blur) {
    const key = num(blur);
    if (blurDefs.has(key)) return blurDefs.get(key);
    const id = `f${++defSeq}`;
    defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${num(blur / 2)}"/></filter>`);
    blurDefs.set(key, id);
    return id;
  }

  function paintShadows(el, cs, r, e, group, rad, zBg) {
    e = withoutOwnOverflow(el, e);
    const shadows = parseShadows(cs.boxShadow).reverse();
    for (const s of shadows) {
      const sr = { x: r.x + s.ox - s.spread, y: r.y + s.oy - s.spread, w: r.w + 2 * s.spread, h: r.h + 2 * s.spread };
      if (sr.w <= 0 || sr.h <= 0) continue;
      const srad = { ...rad, tl: rad.tl + s.spread, tr: rad.tr + s.spread, br: rad.br + s.spread, bl: rad.bl + s.spread, rx: rad.rx + s.spread };
      const reach = { x: sr.x - s.blur, y: sr.y - s.blur, w: sr.w + 2 * s.blur, h: sr.h + 2 * s.blur };
      const filter = s.blur > 0.3 ? ` filter="url(#${blurRef(s.blur)})"` : '';
      addLayer({
        el, e, rect: reach, z: zBg, kind: 'shadow', group,
        build: (L) => boxShape(sr, srad, `${paintAttr('fill', s.color)}${filter}${opAttr(L)}`),
        scene: null,
      });
    }
  }

  async function paintBackground(el, cs, r, e, group) {
    if (r.w < 0.5 || r.h < 0.5) return;
    const rad = radii(cs);
    const zBg = e.z.concat([BG]);
    const color = rgba(cs.backgroundColor);
    const textClip = /text/.test(cs.webkitBackgroundClip || cs.backgroundClip || '');
    if (cs.boxShadow && cs.boxShadow !== 'none' && (color.a > 0.5 || cs.backgroundImage !== 'none')) {
      paintShadows(el, cs, r, e, group, rad, zBg);
    }
    if (color.a > 0.01 && !textClip) {
      addLayer({
        el, e, rect: r, z: zBg, kind: 'fill', group, blend: e.blend,
        build: (L) => boxShape(r, rad, `${paintAttr('fill', color)}${opAttr(L)}`),
        scene: rectScene(`${layerId(el)}-fill`, r, cssRgba(color), e.opacity, rad),
      });
    }
    if (textClip) return;
    const list = bgLayers(cs).reverse();
    for (const bl of list) {
      if (/gradient\(/i.test(bl.img)) {
        const g = gradientDef(bl.img, r);
        if (!g) continue;
        addLayer({
          el, e, rect: r, z: zBg, kind: 'fill', group, blend: e.blend,
          build: (L) => boxShape(r, rad, ` fill="url(#${g.id})"${opAttr(L)}`),
          scene: rectScene(`${layerId(el)}-gradient`, r, gradientSceneFill(g), e.opacity, rad),
        });
        continue;
      }
      const m = bl.img.match(/url\(["']?([^"')]+)["']?\)/);
      if (!m) continue;
      const url = m[1];
      const nat = await naturalSize(url);
      const ir = bgImageRect(r, nat, bl.size, bl.posX, bl.posY);
      if (ir.w < 0.5 || ir.h < 0.5) continue;
      const repeatX = !/no-repeat|repeat-y/.test(bl.repeat) && ir.w < r.w - 0.5;
      const repeatY = !/no-repeat|repeat-x/.test(bl.repeat) && ir.h < r.h - 0.5;
      const href = await inlineImage(url, ir.w, ir.h);
      if (!href) continue;
      const own = { rect: r, rad: rad.rx > 0 ? rad : null };
      if (repeatX || repeatY) {
        const pid = `p${++defSeq}`;
        defs.push(`<pattern id="${pid}" patternUnits="userSpaceOnUse" x="${num(ir.x)}" y="${num(ir.y)}" width="${num(ir.w)}" height="${num(ir.h)}"><image width="${num(ir.w)}" height="${num(ir.h)}" href="${svgEsc(href)}" xlink:href="${svgEsc(href)}" preserveAspectRatio="none"/></pattern>`);
        addLayer({
          el, e, rect: r, z: zBg, kind: 'image', group, blend: e.blend,
          build: (L) => boxShape(r, rad, ` fill="url(#${pid})"${opAttr(L)}`),
          scene: { type: 'IMAGE', name: `${layerId(el)}-bgimg`, x: r.x, y: r.y, w: r.w, h: r.h, src: href, opacity: num(e.opacity), objectFit: 'cover' },
        });
      } else {
        addLayer({
          el, e, rect: intersect(ir, r), z: zBg, kind: 'image', group, blend: e.blend, ownClip: needsClip(ir, own) ? own : null,
          build: (L) => `<image x="${num(ir.x)}" y="${num(ir.y)}" width="${num(ir.w)}" height="${num(ir.h)}" href="${svgEsc(href)}" xlink:href="${svgEsc(href)}" preserveAspectRatio="none"${opAttr(L)}/>`,
          scene: { type: 'IMAGE', name: `${layerId(el)}-bgimg`, x: num(ir.x), y: num(ir.y), w: num(ir.w), h: num(ir.h), src: href, opacity: num(e.opacity), objectFit: 'fill' },
        });
      }
    }
  }

  function paintBorder(el, cs, r, e, group) {
    const sides = ['Top', 'Right', 'Bottom', 'Left'].map((s) => ({
      w: cs[`border${s}Style`] === 'none' || cs[`border${s}Style`] === 'hidden' ? 0 : (parseFloat(cs[`border${s}Width`]) || 0),
      c: rgba(cs[`border${s}Color`]),
      style: cs[`border${s}Style`],
    }));
    if (!sides.some((s) => s.w > 0 && s.c.a > 0.01)) return;
    const zBg = e.z.concat([BG]);
    const rad = radii(cs);
    const same = sides.every((s) => Math.abs(s.w - sides[0].w) < 0.01 && hex(s.c) === hex(sides[0].c) && Math.abs(s.c.a - sides[0].c.a) < 0.01);
    if (same) {
      const bw = sides[0].w;
      const inner = { x: r.x + bw / 2, y: r.y + bw / 2, w: Math.max(0, r.w - bw), h: Math.max(0, r.h - bw) };
      const innerRad = { ...rad, tl: Math.max(0, rad.tl - bw / 2), tr: Math.max(0, rad.tr - bw / 2), br: Math.max(0, rad.br - bw / 2), bl: Math.max(0, rad.bl - bw / 2), rx: Math.max(0, rad.rx - bw / 2) };
      const dash = /dashed/.test(sides[0].style) ? ` stroke-dasharray="${num(bw * 3)} ${num(bw * 2)}"` : (/dotted/.test(sides[0].style) ? ` stroke-dasharray="${num(bw)} ${num(bw)}"` : '');
      addLayer({
        el, e, rect: r, z: zBg, kind: 'stroke', group, blend: e.blend,
        build: (L) => boxShape(inner, innerRad, ` fill="none"${paintAttr('stroke', sides[0].c)} stroke-width="${num(bw)}"${dash}${opAttr(L)}`),
        scene: rectScene(`${layerId(el)}-border`, r, null, e.opacity, rad, { stroke: { color: cssRgba(sides[0].c), weight: num(bw) } }),
      });
      return;
    }
    const rects = [
      { x: r.x, y: r.y, w: r.w, h: sides[0].w },
      { x: r.x + r.w - sides[1].w, y: r.y, w: sides[1].w, h: r.h },
      { x: r.x, y: r.y + r.h - sides[2].w, w: r.w, h: sides[2].w },
      { x: r.x, y: r.y, w: sides[3].w, h: r.h },
    ];
    sides.forEach((s, i) => {
      if (s.w <= 0 || s.c.a <= 0.01) return;
      const sr = rects[i];
      addLayer({
        el, e, rect: sr, z: zBg, kind: 'stroke', group, blend: e.blend,
        build: (L) => `<rect x="${num(sr.x)}" y="${num(sr.y)}" width="${num(sr.w)}" height="${num(sr.h)}"${paintAttr('fill', s.c)}${opAttr(L)}/>`,
        scene: rectScene(`${layerId(el)}-border-${i}`, sr, cssRgba(s.c), e.opacity, null),
      });
    });
  }

  /** overflow clips descendants, never the element's own shadow/outline. */
  function withoutOwnOverflow(el, e) {
    if (!e.clips.some((c) => c.el === el && !c.always)) return e;
    return { ...e, clips: e.clips.filter((c) => !(c.el === el && !c.always)), _clip: undefined };
  }

  function paintOutline(el, cs, r, e, group) {
    e = withoutOwnOverflow(el, e);
    const style = cs.outlineStyle;
    const ow = parseFloat(cs.outlineWidth) || 0;
    if (!style || style === 'none' || style === 'auto' || ow <= 0) return;
    const c = rgba(cs.outlineColor);
    if (c.a <= 0.01) return;
    const grow = (parseFloat(cs.outlineOffset) || 0) + ow / 2;
    const or = { x: r.x - grow, y: r.y - grow, w: r.w + 2 * grow, h: r.h + 2 * grow };
    if (or.w <= 0 || or.h <= 0) return;
      const rad = radii(cs);
    const g = (v) => (v > 0 ? Math.max(0, v + grow) : 0);
    const orad = { ...rad, tl: g(rad.tl), tr: g(rad.tr), br: g(rad.br), bl: g(rad.bl), rx: g(rad.rx) };
    const dash = /dashed/.test(style) ? ` stroke-dasharray="${num(ow * 3)} ${num(ow * 2)}"` : (/dotted/.test(style) ? ` stroke-dasharray="${num(ow)} ${num(ow)}"` : '');
    const outer = { x: or.x - ow / 2, y: or.y - ow / 2, w: or.w + ow, h: or.h + ow };
    addLayer({
      el, e, rect: outer, z: e.z.concat([1e9]), kind: 'stroke', group, blend: e.blend,
      build: (L) => boxShape(or, orad, ` fill="none"${paintAttr('stroke', c)} stroke-width="${num(ow)}"${dash}${opAttr(L)}`),
      scene: rectScene(`${layerId(el)}-outline`, or, null, e.opacity, orad, { stroke: { color: cssRgba(c), weight: num(ow) } }),
    });
  }

  function rectScene(name, r, fill, opacity, rad, extras = {}) {
    const node = {
      type: 'RECT', name: String(name || 'rect').slice(0, 80), x: num(r.x), y: num(r.y), w: num(r.w), h: num(r.h),
      opacity: Number.isFinite(opacity) ? num(opacity) : 1,
    };
    if (fill != null && fill !== '') node.fill = fill;
    if (extras.stroke) node.stroke = extras.stroke;
    if (rad && rad.uniform === false) {
      node.cornerRadii = { tl: num(rad.tl), tr: num(rad.tr), br: num(rad.br), bl: num(rad.bl) };
      node.cornerRadius = num(rad.rx);
    } else node.cornerRadius = num(rad?.rx || 0);
    return node;
  }

  function opAttr(L) {
    const op = L.opacity ?? 1;
    const blend = L.blend && L.kind !== 'text' ? ` style="mix-blend-mode:${L.blend}"` : '';
    return `${op < 0.999 ? ` opacity="${num(op)}"` : ''}${blend}`;
  }

  async function paintPseudo(el, pseudo, e, elRect, group) {
    const pcs = getComputedStyle(el, pseudo);
    if (!pcs || pcs.content === 'none' || pcs.content === 'normal' || pcs.display === 'none') return;
    if (pcs.visibility === 'hidden') return;
    const po = parseFloat(pcs.opacity);
    const pOpacity = Number.isFinite(po) ? po : 1;
    if (pOpacity <= 0.02) return;
    let r = elRect;
    const abs = pcs.position === 'absolute' || pcs.position === 'fixed';
    if (abs) {
      const ecs = getComputedStyle(el);
      const padBox = {
        x: elRect.x + (parseFloat(ecs.borderLeftWidth) || 0),
        y: elRect.y + (parseFloat(ecs.borderTopWidth) || 0),
        w: elRect.w - (parseFloat(ecs.borderLeftWidth) || 0) - (parseFloat(ecs.borderRightWidth) || 0),
        h: elRect.h - (parseFloat(ecs.borderTopWidth) || 0) - (parseFloat(ecs.borderBottomWidth) || 0),
      };
      const left = lengthPx(pcs.left, padBox.w);
      const right = lengthPx(pcs.right, padBox.w);
      const top = lengthPx(pcs.top, padBox.h);
      const bottom = lengthPx(pcs.bottom, padBox.h);
      let w = lengthPx(pcs.width, padBox.w);
      let h = lengthPx(pcs.height, padBox.h);
      if (w == null && left != null && right != null) w = padBox.w - left - right;
      if (h == null && top != null && bottom != null) h = padBox.h - top - bottom;
      if (w == null || h == null) return;
      const x = left != null ? padBox.x + left : (right != null ? padBox.x + padBox.w - right - w : padBox.x);
      const y = top != null ? padBox.y + top : (bottom != null ? padBox.y + padBox.h - bottom - h : padBox.y);
      r = { x: num(x), y: num(y), w: num(w), h: num(h) };
    } else {
      const w = lengthPx(pcs.width, elRect.w);
      const h = lengthPx(pcs.height, elRect.h);
      if (w == null || h == null) return;
      r = { x: elRect.x, y: elRect.y, w: num(w), h: num(h) };
    }
    if (r.w < 0.5 || r.h < 0.5) return;
    const zi = pcs.zIndex === 'auto' ? 0 : (parseInt(pcs.zIndex, 10) || 0);
    const pPositioned = pcs.position !== 'static';
    const pe = {
      ...e,
      opacity: e.opacity * pOpacity,
      z: pPositioned ? (e.selfSc ? e.z : e.sc).concat([zi === 0 ? 0.5 : zi + (zi > 0 ? 0.5 : 0), ++scSeq]) : e.z,
      _clip: undefined,
    };
    await paintBackground(el, pcs, r, pe, group);
    paintBorder(el, pcs, r, pe, group);
  }

  /* ------------------------------------------------------ replaced content */

  async function paintImageEl(el, cs, r, e, group) {
    const tag = el.tagName.toLowerCase();
    let href = '';
    let nat = { w: 0, h: 0 };
    if (tag === 'img') {
      const srcs = [...new Set([el.currentSrc, el.getAttribute('src')].filter(Boolean))];
      if (!srcs.length) return;
      nat = { w: el.naturalWidth || 0, h: el.naturalHeight || 0 };
      const dr = objectFitRect(r, nat, cs);
      for (const src of srcs) {
        href = await inlineImage(src, dr.w, dr.h);
        if (href) break;
      }
      if (!href && el.complete && el.naturalWidth) {
        try { href = encodeBitmap(el, el.naturalWidth, el.naturalHeight, targetEdge(dr.w, dr.h), maxEmbeddedImageBytes); } catch { href = ''; }
      }
    } else if (tag === 'canvas') {
      nat = { w: el.width, h: el.height };
      try { href = encodeBitmap(el, el.width, el.height, targetEdge(r.w, r.h), maxEmbeddedImageBytes); } catch { href = ''; }
      if (href) embeddedImageBudget -= href.length;
    } else if (tag === 'video') {
      nat = { w: el.videoWidth || 0, h: el.videoHeight || 0 };
      if (el.readyState >= 2 && nat.w) {
        try { href = encodeBitmap(el, nat.w, nat.h, targetEdge(r.w, r.h), maxEmbeddedImageBytes, true); } catch { href = ''; }
      }
      if (!href && el.getAttribute('poster')) href = await inlineImage(el.getAttribute('poster'), r.w, r.h);
    }
    const zContent = e.z;
    const rad = radii(cs);
    if (!href) return;
    const dr = objectFitRect(r, nat, cs);
    const own = { rect: r, rad: rad.rx > 0 ? rad : null };
    addLayer({
      el, e, rect: intersect(dr, r), z: zContent, kind: 'image', group, blend: e.blend,
      ownClip: needsClip(dr, own) ? own : null,
      build: (L) => `<image x="${num(dr.x)}" y="${num(dr.y)}" width="${num(dr.w)}" height="${num(dr.h)}" href="${svgEsc(href)}" xlink:href="${svgEsc(href)}" preserveAspectRatio="none"${opAttr(L)}/>`,
      scene: {
        type: 'IMAGE', name: layerId(el), x: r.x, y: r.y, w: r.w, h: r.h, src: href, opacity: num(e.opacity),
        objectFit: cs.objectFit === 'contain' ? 'contain' : cs.objectFit === 'cover' ? 'cover' : 'fill',
        cornerRadius: num(rad.rx || 0),
      },
    });
  }

  const SVG_PAINT = [
    ['fill', 'fill'], ['stroke', 'stroke'], ['strokeWidth', 'stroke-width'], ['fillOpacity', 'fill-opacity'],
    ['strokeOpacity', 'stroke-opacity'], ['fillRule', 'fill-rule'], ['strokeLinecap', 'stroke-linecap'],
    ['strokeLinejoin', 'stroke-linejoin'], ['strokeDasharray', 'stroke-dasharray'],
  ];

  /** Clone an inline <svg> with computed paint baked in (page CSS won't exist in Figma). */
  function inlineSvgMarkup(svgEl, r) {
    const clone = svgEl.cloneNode(true);
    const src = [svgEl, ...svgEl.querySelectorAll('*')];
    const dst = [clone, ...clone.querySelectorAll('*')];
    for (let i = 0; i < src.length; i++) {
      const s = src[i];
      const d = dst[i];
      if (!d) continue;
      let scs;
      try { scs = getComputedStyle(s); } catch { continue; }
      const tag = s.tagName.toLowerCase();
      if (scs.display === 'none' && !/^(symbol|defs|lineargradient|radialgradient|stop|clippath|mask|pattern)$/.test(tag)) {
        d.setAttribute('display', 'none');
        continue;
      }
      if (tag === 'stop') {
        const c = rgba(scs.stopColor);
        d.setAttribute('stop-color', hex(c));
        const so = (parseFloat(scs.stopOpacity) || 1) * c.a;
        if (so < 0.999) d.setAttribute('stop-opacity', String(num(so)));
        } else {
        for (const [prop, attr] of SVG_PAINT) {
          let v = scs[prop];
          if (!v) continue;
          if (attr === 'fill' || attr === 'stroke') {
            if (/^url\(/.test(v)) { d.setAttribute(attr, v.replace(/["']/g, '')); continue; }
            if (v === 'none') { d.setAttribute(attr, 'none'); continue; }
            const c = rgba(v);
            d.setAttribute(attr, hex(c));
            if (c.a < 0.999) {
              const base = parseFloat(scs[attr === 'fill' ? 'fillOpacity' : 'strokeOpacity']) || 1;
              d.setAttribute(`${attr}-opacity`, String(num(base * c.a)));
            }
            continue;
          }
          if (attr === 'fill-opacity' || attr === 'stroke-opacity') {
            if (d.hasAttribute(attr)) continue;
            if (parseFloat(v) >= 0.999) continue;
          }
          if (attr === 'stroke-dasharray' && v === 'none') continue;
          d.setAttribute(attr, v);
        }
      }
      if (i > 0) {
        const o = parseFloat(scs.opacity);
        if (Number.isFinite(o) && o < 0.999) d.setAttribute('opacity', String(num(o)));
        if (scs.visibility === 'hidden') d.setAttribute('visibility', 'hidden');
      }
      d.removeAttribute('class');
      d.removeAttribute('style');
    }
    // Pull in external defs (sprites, shared gradients) referenced by url(#id) / href="#id".
    const ids = new Set();
    const scan = (root) => {
      for (const n of [root, ...root.querySelectorAll('*')]) {
        for (const a of [...n.attributes]) {
          const m = a.value.match(/url\(#([^)]+)\)/) || ((a.name === 'href' || a.name === 'xlink:href') && a.value.match(/^#(.+)$/));
          if (m) ids.add(m[1]);
        }
      }
    };
    scan(clone);
    let defsEl = null;
    const seen = new Set();
    for (let guard = 0; guard < 3; guard++) {
      let added = false;
      for (const id of [...ids]) {
        if (seen.has(id)) continue;
        seen.add(id);
        if (clone.querySelector(`[id="${CSS.escape(id)}"]`)) continue;
        const ref = document.getElementById(id);
        if (!ref) continue;
        if (!defsEl) {
          defsEl = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
          clone.insertBefore(defsEl, clone.firstChild);
        }
        const copy = ref.cloneNode(true);
        defsEl.appendChild(copy);
        scan(copy);
        added = true;
      }
      if (!added) break;
    }
    if (!clone.getAttribute('viewBox')) {
      const aw = parseFloat(svgEl.getAttribute('width'));
      const ah = parseFloat(svgEl.getAttribute('height'));
      if (aw > 0 && ah > 0) clone.setAttribute('viewBox', `0 0 ${aw} ${ah}`);
    }
    clone.removeAttribute('class');
    clone.removeAttribute('style');
    clone.setAttribute('x', String(num(r.x)));
    clone.setAttribute('y', String(num(r.y)));
    clone.setAttribute('width', String(num(r.w)));
    clone.setAttribute('height', String(num(r.h)));
    clone.setAttribute('overflow', 'visible');
    return clone;
  }

  function paintSvg(el, r, e, group) {
    let clone;
    try { clone = inlineSvgMarkup(el, r); } catch { return; }
    const markup = clone.outerHTML;
    let sceneSvg = '';
    try {
      const c2 = clone.cloneNode(true);
      c2.setAttribute('x', '0');
      c2.setAttribute('y', '0');
      c2.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      sceneSvg = c2.outerHTML;
      // Standalone SVG parsers (figma.createNodeFromSvg, <img>) reject an
      // undeclared xlink prefix.
      if (/\sxlink:/.test(sceneSvg) && !/xmlns:xlink=/.test(sceneSvg)) {
        sceneSvg = sceneSvg.replace(/^<svg\b/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
      }
    } catch {}
    addLayer({
      el, e, rect: r, z: e.z, kind: 'svg', group, blend: e.blend,
      build: (L) => {
        const op = opAttr(L);
        return op ? `<g${op}>${markup}</g>` : markup;
      },
      scene: sceneSvg ? { type: 'SVG', name: layerId(el), x: r.x, y: r.y, w: r.w, h: r.h, svg: sceneSvg, opacity: num(e.opacity) } : null,
    });
  }

  /* ------------------------------------------------------------------ text */

  function addTextLine(el, cs, e, paint, line, group, overrides = {}) {
      const fontSize = parseFloat(cs.fontSize) || 16;
        const rc = line.rect;
        const x = num(rc.left + window.scrollX);
    const top = num(rc.top + window.scrollY);
    const h = rc.height;
    const { asc, desc } = fontMetrics(cs);
    const baseline = num(top + (h - (asc + desc)) / 2 + asc);
    const text = applyTextTransform(line.text, cs.textTransform);
    if (!text.trim()) return;
    const lh = lineHeightPx(cs, fontSize, asc + desc);
    const data = {
      text, x, top, h, w: rc.width, baseline, fontSize, lh,
      color: paint.color || null,
      gradient: paint.gradient ? { css: paint.gradient, rect: paint.gradRect, under: paint.under || null } : null,
      opacity: e.opacity,
      blend: e.blend,
      fontStack: fontStack(cs),
      fontFamily: primaryFont(cs),
            fontWeight: String(cs.fontWeight || '400'),
      fontStyle: /italic|oblique/i.test(cs.fontStyle || '') ? 'italic' : 'normal',
      letterSpacing: cs.letterSpacing && cs.letterSpacing !== 'normal' ? (parseFloat(cs.letterSpacing) || 0) : 0,
      decoration: mapTextDecoration(cs),
      ...overrides,
    };
    addLayer({
      el, e, rect: { x, y: top, w: rc.width, h }, z: e.z, kind: 'text', group, data,
      build: (L) => {
        const d = L.data;
        let fill = '';
        if (d.gradient) {
          const g = gradientDef(d.gradient.css, d.gradient.rect, { under: d.gradient.under });
          fill = g ? ` fill="url(#${g.id})"` : paintAttr('fill', d.color || d.gradient.under || { r: 0, g: 0, b: 0, a: 1 });
        } else fill = paintAttr('fill', d.color);
        const op = d.opacity < 0.999 ? ` opacity="${num(d.opacity)}"` : '';
        const ls = d.letterSpacing ? ` letter-spacing="${num(d.letterSpacing)}"` : '';
        const deco = d.decoration !== 'none' ? ` text-decoration="${d.decoration}"` : '';
        // Pin the run to its measured width so fallback fonts can't push into neighbours.
        const tl = d.w > 4 && d.text.length > 1 ? ` textLength="${num(d.w)}" lengthAdjust="spacingAndGlyphs"` : '';
        return `<text x="${d.x}" y="${d.baseline}" font-family="${svgEsc(d.fontStack)}" font-size="${num(d.fontSize)}" font-weight="${svgEsc(d.fontWeight)}" font-style="${d.fontStyle}"${ls}${deco}${fill}${op}${tl} xml:space="preserve">${svgEsc(d.text)}</text>`;
      },
      scene: null,
    });
  }

  function paintTextNode(node, parent, cs, e, group) {
    const raw = node.nodeValue || '';
    if (!raw.trim() || raw.length > 4000) return;
    const paint = textPaint(parent, cs);
    if (!paint) return;
    for (const line of textLines(node)) addTextLine(parent, cs, e, paint, line, group);
  }

  /** Form controls draw their value/placeholder without text nodes. */
  function paintFormText(el, cs, r, e, group) {
    const tag = el.tagName.toLowerCase();
    const type = String(el.getAttribute('type') || 'text').toLowerCase();
    if (tag === 'input' && !/^(text|email|search|tel|url|number|password|)$/.test(type)) {
      if (!/^(submit|button|reset)$/.test(type)) return;
    }
    let value = '';
    let pcs = cs;
    if (tag === 'select') value = el.selectedOptions?.[0]?.textContent || '';
    else value = el.value || '';
    if (tag === 'input' && type === 'password' && value) value = '•'.repeat(value.length);
    if (!value && el.getAttribute('placeholder')) {
      value = el.getAttribute('placeholder');
      try { pcs = getComputedStyle(el, '::placeholder'); } catch {}
    }
    value = String(value).replace(/\s+/g, ' ').trim();
    if (!value) return;
    const paint = textPaint(el, pcs) || { color: rgba(cs.color) };
    const fontSize = parseFloat(cs.fontSize) || 16;
    const { asc, desc } = fontMetrics(cs);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const bL = parseFloat(cs.borderLeftWidth) || 0;
    const centered = /^(submit|button|reset)$/.test(type) || cs.textAlign === 'center';
    measureCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${fontSize}px ${cs.fontFamily}`;
    const tw = measureCtx.measureText(value).width;
    const left = centered ? r.x + (r.w - tw) / 2 : r.x + bL + padL;
    const h = asc + desc;
    const top = r.y + (r.h - h) / 2;
    addTextLine(el, cs, e, paint, {
      text: value,
      rect: { left: left - window.scrollX, top: top - window.scrollY, width: tw, height: h },
    }, group);
  }

  /* -------------------------------------------------------------- tree walk */

  const SKIP_TAGS = /^(script|style|noscript|template|iframe|head|meta|link|title|object|embed)$/;

  async function walk(el) {
    if (layers.length >= maxLayers) return;
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.test(tag)) return;
    if (el.id === '__ce__' || el.id === 'clonyfy-scroll-reveal-style' || el.id === '__clonyfy_figma_hide__') return;
    if (el.hasAttribute('data-clonyfy-ui') || el.hasAttribute('data-clonyfy-scroll-reveal')
      || el.hasAttribute('data-clonyfy-preview-nav') || el.hasAttribute('data-clonyfy-share-nav')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.contentVisibility === 'hidden') return;
    const e = eff(el);
    if (e.opacity <= 0.02) return;
    const r = absRect(el);
    if (r.y > height + 400 || r.x > width + 400) return;
    const shown = cs.visibility !== 'hidden' && cs.visibility !== 'collapse';
    const group = sectionGroup(el);

    if (tag === 'svg') {
      if (shown && r.w > 0.5 && r.h > 0.5) paintSvg(el, r, e, group);
      return;
    }

    if (shown && el !== document.body) {
      await paintBackground(el, cs, r, e, group);
      paintBorder(el, cs, r, e, group);
      paintOutline(el, cs, r, e, group);
      await paintPseudo(el, '::before', e, r, group);
    }

    if (/^(img|canvas|video)$/.test(tag)) {
      if (shown && r.w > 0.5 && r.h > 0.5) await paintImageEl(el, cs, r, e, group);
      return;
    }
    if (/^(input|textarea|select)$/.test(tag)) {
      if (shown) paintFormText(el, cs, r, e, group);
      return;
    }

    for (const child of el.childNodes) {
      if (layers.length >= maxLayers) break;
      if (child.nodeType === 3) {
        if (shown) paintTextNode(child, el, cs, e, group);
      } else if (child.nodeType === 1) {
        await walk(child);
      }
    }

    if (shown && el !== document.body) await paintPseudo(el, '::after', e, r, group);
  }

  for (const rootEl of [document.documentElement, document.body]) {
    const cs = getComputedStyle(rootEl);
    await paintBackground(rootEl, cs, pageRect, ROOT_EFF, 'Page');
  }
  await walk(document.body);

  /* ------------------------------------------------- blend + dedupe text */

  function solidBehind(el) {
    for (let a = el; a && a.nodeType === 1; a = a.parentElement) {
      const c = rgba(getComputedStyle(a).backgroundColor);
      if (c.a > 0.5) return c;
    }
    return pageBgC;
  }

  const textLayers = layers.filter((l) => l.kind === 'text');
  const near = (a, b) => Math.abs(a.data.x - b.data.x) < 3 && Math.abs(a.data.top - b.data.top) < 3;
  for (const L of textLayers) {
    const d = L.data;
    if (!d.blend || !d.color) continue;
    // Duplicated headline layers (e.g. Stripe's foreground hard-light title over
    // the background title): glyphs overlap exactly, so the visible color is the
    // blend of both. Bake it into one opaque layer.
    const match = textLayers.find((o) => o !== L && !o.removed && !o.data.blend && o.data.text === d.text && near(o, L));
    let backdrop = solidBehind(L.el);
    if (match && match.data.color) {
      backdrop = composite('normal', backdrop, match.data.color, match.data.color.a * match.data.opacity);
      match.removed = true;
    }
    d.color = composite(d.blend, backdrop, d.color, d.color.a * d.opacity);
    d.opacity = 1;
    d.blend = null;
  }
  const seenText = new Map();
  for (const L of textLayers) {
    if (L.removed) continue;
    const key = `${L.data.text}@${Math.round(L.data.x)}@${Math.round(L.data.top)}`;
    if (seenText.has(key)) L.removed = true;
    else seenText.set(key, L);
  }

  for (const L of layers) {
    if (L.kind === 'text') {
      L.opacity = 1;
      const d = L.data;
      const gradFill = d.gradient ? over(rgba(gradientFirstColor(d.gradient.css) || '#000'), d.gradient.under) : null;
      L.scene = {
        type: 'TEXT',
        name: d.text.slice(0, 40),
        x: d.x,
        y: num(d.top - (d.lh - d.h) / 2),
        // Slack so plugins that size text boxes to `w` never re-wrap a
        // pre-split line when Figma substitutes a wider font.
        w: num(Math.max(4, d.w * 1.35 + d.fontSize)),
        h: num(d.lh),
        textWidth: num(Math.max(1, d.w)),
        characters: d.text,
        fill: d.color ? cssRgba(d.color) : cssRgba(gradFill || rgba('#000')),
        fontFamily: d.fontFamily,
        fontSize: num(d.fontSize),
        fontWeight: d.fontWeight,
        fontStyle: d.fontStyle,
        letterSpacing: num(d.letterSpacing),
        lineHeight: d.lh,
        textAlign: 'LEFT',
        textDecoration: d.decoration === 'underline' ? 'underline' : 'none',
        opacity: num(d.opacity),
        autoWidth: true,
      };
    } else if (L.scene) {
      L.scene.opacity = num(L.opacity);
    }
  }

  /* ---------------------------------------------------------- paint order */

  function cmpZ(a, b) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const x = a[i] ?? 0;
      const y = b[i] ?? 0;
      if (x !== y) return x - y;
    }
    return 0;
  }
  const ordered = layers.filter((l) => !l.removed).sort((a, b) => cmpZ(a.z, b.z) || a.order - b.order);

  /*
   * Compatibility with already-installed (older) Clonyfy Import builds, which
   * know only FRAME/RECT/TEXT/IMAGE and drop IMAGE src above 120k chars:
   * - big bitmaps are also emitted as IMAGE tiles under that limit, while the
   *   full bitmap travels as IMAGE_FULL (current plugin uses it, skips tiles);
   * - every SVG gets a following rasterized IMAGE with `svgFallback` (current
   *   plugin skips it when the vector imported fine).
   */
  const LEGACY_SRC = 110_000;
  const legacyBytes = Math.floor(LEGACY_SRC / 1.37);

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function svgFallbackNode(n) {
    if (!(n.w > 0.5 && n.h > 0.5)) return null;
    const url = URL.createObjectURL(new Blob([n.svg], { type: 'image/svg+xml' }));
    try {
      const img = await loadImg(url);
      if (!img) return null;
      const src = encodeBitmap(img, n.w * 2, n.h * 2, 1600, legacyBytes);
      if (!src) return null;
      return { type: 'IMAGE', name: `${n.name}-raster`, x: n.x, y: n.y, w: n.w, h: n.h, src, opacity: n.opacity, objectFit: 'fill', svgFallback: true };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function imageTiles(n) {
    const img = await loadImg(n.src);
    if (!img || !img.naturalWidth) return null;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const k = Math.max(1, Math.min(2, nw / Math.max(1, n.w)));
    const cw = Math.max(1, Math.round(n.w * k));
    const ch = Math.max(1, Math.round(n.h * k));
    const base = document.createElement('canvas');
    base.width = cw;
    base.height = ch;
    const bctx = base.getContext('2d');
    if (!bctx) return null;
    // Bake object-fit so each tile is a plain stretched slice.
    if (n.objectFit === 'cover' || n.objectFit === 'contain') {
      const s = n.objectFit === 'cover' ? Math.max(cw / nw, ch / nh) : Math.min(cw / nw, ch / nh);
      const dw = nw * s;
      const dh = nh * s;
      bctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    } else {
      bctx.drawImage(img, 0, 0, cw, ch);
    }
    let grid = Math.max(2, Math.ceil(Math.sqrt(n.src.length / LEGACY_SRC)) + 1);
    for (; grid <= 10; grid++) {
      const cols = Math.min(grid, Math.max(1, Math.ceil(cw / 32)));
      const rows = Math.min(grid, Math.max(1, Math.ceil(ch / 32)));
      const tiles = [];
      let ok = true;
      for (let r = 0; r < rows && ok; r++) {
        for (let c = 0; c < cols && ok; c++) {
          const x0 = Math.floor((c * cw) / cols);
          const y0 = Math.floor((r * ch) / rows);
          // 1px overlap hides hairline seams between adjacent fills.
          const x1 = Math.min(cw, Math.floor(((c + 1) * cw) / cols) + (c < cols - 1 ? 1 : 0));
          const y1 = Math.min(ch, Math.floor(((r + 1) * ch) / rows) + (r < rows - 1 ? 1 : 0));
          const tc = document.createElement('canvas');
          tc.width = x1 - x0;
          tc.height = y1 - y0;
          tc.getContext('2d').drawImage(base, x0, y0, tc.width, tc.height, 0, 0, tc.width, tc.height);
          const src = encodeBitmap(tc, tc.width, tc.height, 4096, legacyBytes);
          if (!src || src.length > LEGACY_SRC) { ok = false; break; }
          tiles.push({
            type: 'IMAGE', name: `${n.name}-tile-${r}-${c}`,
            x: num(n.x + x0 / k), y: num(n.y + y0 / k), w: num(tc.width / k), h: num(tc.height / k),
            src, opacity: n.opacity, objectFit: 'fill', legacyTile: true,
          });
        }
      }
      if (ok) return tiles;
    }
    return null;
  }

  async function legacyCompatNodes(children) {
    const out = [];
    for (const n of children) {
      if (n.type === 'SVG') {
        out.push(n);
        const fb = await svgFallbackNode(n).catch(() => null);
        if (fb) out.push(fb);
      } else if (n.type === 'IMAGE' && typeof n.src === 'string' && n.src.length > LEGACY_SRC) {
        const tiles = await imageTiles(n).catch(() => null);
        if (tiles && tiles.length) out.push({ ...n, type: 'IMAGE_FULL' }, ...tiles);
        else out.push(n);
      } else out.push(n);
    }
    return out;
  }

  if (format === 'scene') {
    // Consecutive runs per section keep paint order intact.
    const nodes = [];
    let run = null;
    for (const L of ordered) {
      if (!L.scene) continue;
      if (!run || run.name !== L.group) {
        run = { type: 'FRAME', name: L.group, children: [] };
        nodes.push(run);
      }
      run.children.push(L.scene);
    }
    for (const frame of nodes) {
      let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
      for (const c of frame.children) {
        minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x + c.w); maxY = Math.max(maxY, c.y + c.h);
      }
      Object.assign(frame, { x: num(minX), y: num(minY), w: num(Math.max(1, maxX - minX)), h: num(Math.max(1, maxY - minY)) });
    }
    if (!nodes.length) {
      throw new Error('No exportable layers found on this page (empty scene). Check that the clone HTML has visible content.');
    }
    for (const frame of nodes) {
      try { frame.children = await legacyCompatNodes(frame.children); } catch { /* keep as-is */ }
    }
    return {
      kind: 'clonyfy-figma-scene',
      version: 1,
      name: String(options.name || options.route || document.title || 'Clonyfy page'),
      route: options.route || undefined,
      page: { width, height, fill: cssRgba(pageBgC) },
      nodes,
    };
  }

  const clipDefs = new Map();
  function clipRef(clip) {
    const c = clip.rect;
    const key = [c.x, c.y, c.w, c.h, clip.rad ? [clip.rad.tl, clip.rad.tr, clip.rad.br, clip.rad.bl].join('/') : 0].map((v) => (typeof v === 'number' ? num(v) : v)).join('_');
    let id = clipDefs.get(key);
    if (!id) {
      id = `c${clipDefs.size + 1}`;
      clipDefs.set(key, id);
      defs.push(`<clipPath id="${id}">${boxShape(c, clip.rad, '')}</clipPath>`);
    }
    return id;
  }

  const maskDefs = new Map();
  function maskRef(m) {
    if (maskDefs.has(m)) return maskDefs.get(m);
    const r = m.rect;
    // Multiple mask layers composite with `add` by default — approximate with the first.
    const g = gradientDef(m.css[0], r, { alphaMask: true });
    const id = g ? `m${maskDefs.size + 1}` : null;
    if (id) {
      defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}"><rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}" fill="url(#${g.id})"/></mask>`);
    }
    maskDefs.set(m, id);
    return id;
  }

  const body = [];
  let openGroup = null;
  for (const L of ordered) {
    let s = '';
    try { s = L.build(L); } catch { s = ''; }
    if (!s) continue;
    for (let i = L.masks.length - 1; i >= 0; i--) {
      const id = maskRef(L.masks[i]);
      if (id) s = `<g mask="url(#${id})">${s}</g>`;
    }
    if (L.ownClip) s = `<g clip-path="url(#${clipRef(L.ownClip)})">${s}</g>`;
    if (L.clip) s = `<g clip-path="url(#${clipRef(L.clip)})">${s}</g>`;
    if (openGroup !== L.group) {
      if (openGroup !== null) body.push('</g>');
      body.push(`<g id="${svgEsc(L.group)}" data-clonyfy-section="true">`);
      openGroup = L.group;
    }
    body.push(s);
  }
  if (openGroup !== null) body.push('</g>');

  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<title>${svgEsc(document.title || 'Clonyfy export')}</title>`,
    '<desc>Clonyfy scene graph - vector layers from computed styles (no screenshots)</desc>',
  ];
  if (defs.length) parts.push(`<defs>${defs.join('')}</defs>`);
  parts.push(`<rect id="page-background" x="0" y="0" width="${width}" height="${height}"${paintAttr('fill', pageBgC)}/>`);
  parts.push(...body);
  parts.push('</svg>');
  return parts.join('\n');
}
