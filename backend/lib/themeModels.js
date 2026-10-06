/**
 * Site-wide style models ("themes") for cloned sites.
 *
 * A model restyles colors, typography, corner radius and shadows across every
 * page. `themeEngine` reads each element's computed colors, sorts them into
 * roles (page background, surfaces, inverse sections, accents, text, borders)
 * and maps those roles onto the model palette through one generated
 * stylesheet plus `data-cth` attribute tokens. It never touches inline styles,
 * so removing the stylesheet and attributes restores the original look.
 *
 * The engine is serialized with Function#toString (editor script + exported
 * pages), so it must not reference anything outside its own body.
 */

const SOFT = '0 1px 2px rgba(0,0,0,.06), 0 6px 20px rgba(0,0,0,.07)';
const DEEP = '0 12px 32px rgba(0,0,0,.45)';

export const THEME_MODELS = [
  // ── Minimal ────────────────────────────────────────────────────────────
  {
    id: 'paper', name: 'Paper', group: 'Minimal',
    colors: { bg: '#ffffff', surface: '#f6f6f4', surface2: '#ececea', inverse: '#111111', inverseText: '#ffffff', inverseMuted: '#b5b5b5', text: '#111111', muted: '#6b6b6b', border: '#e4e4e2', accent: '#111111', accent2: '#555555', onAccent: '#ffffff' },
    fonts: { heading: 'Inter', body: 'Inter', google: ['Inter:wght@400;500;600;700'] },
    radius: '10px', btnRadius: '8px', shadow: SOFT,
  },
  {
    id: 'mono', name: 'Mono', group: 'Minimal',
    colors: { bg: '#fafafa', surface: '#f0f0f0', surface2: '#e2e2e2', inverse: '#1c1c1c', inverseText: '#fafafa', inverseMuted: '#a3a3a3', text: '#1c1c1c', muted: '#737373', border: '#d9d9d9', accent: '#404040', accent2: '#8a8a8a', onAccent: '#ffffff' },
    fonts: { heading: 'IBM Plex Sans', body: 'IBM Plex Sans', google: ['IBM+Plex+Sans:wght@400;500;600;700'] },
    radius: '4px', btnRadius: '4px', shadow: 'none',
  },
  {
    id: 'nordic', name: 'Nordic', group: 'Minimal',
    colors: { bg: '#f4f6f8', surface: '#e9eef2', surface2: '#dbe3ea', inverse: '#22303c', inverseText: '#f4f6f8', inverseMuted: '#a9b6c2', text: '#1f2a35', muted: '#5d6b78', border: '#d3dce4', accent: '#4a6fa5', accent2: '#7fa38f', onAccent: '#ffffff' },
    fonts: { heading: 'Manrope', body: 'Manrope', google: ['Manrope:wght@400;500;600;700'] },
    radius: '12px', btnRadius: '10px', shadow: SOFT,
  },
  {
    id: 'sand', name: 'Sand', group: 'Minimal',
    colors: { bg: '#f7f1e8', surface: '#efe5d6', surface2: '#e4d6c1', inverse: '#2e2620', inverseText: '#f7f1e8', inverseMuted: '#c2b39f', text: '#2e2620', muted: '#7a6a5a', border: '#e0d2bd', accent: '#c0603c', accent2: '#8a9a5b', onAccent: '#ffffff' },
    fonts: { heading: 'Fraunces', body: 'DM Sans', google: ['Fraunces:wght@400;600;700', 'DM+Sans:wght@400;500;700'] },
    radius: '14px', btnRadius: '999px', shadow: '0 8px 24px rgba(80,50,20,.10)',
  },

  // ── Dark ───────────────────────────────────────────────────────────────
  {
    id: 'midnight', name: 'Midnight', group: 'Dark',
    colors: { bg: '#0b1120', surface: '#111a2e', surface2: '#1a2540', inverse: '#e8edf7', inverseText: '#0b1120', inverseMuted: '#475569', text: '#e8edf7', muted: '#94a3b8', border: '#1f2b45', accent: '#3b82f6', accent2: '#22d3ee', onAccent: '#ffffff' },
    fonts: { heading: 'Inter', body: 'Inter', google: ['Inter:wght@400;500;600;700'] },
    radius: '12px', btnRadius: '10px', shadow: DEEP,
  },
  {
    id: 'obsidian', name: 'Obsidian', group: 'Dark',
    colors: { bg: '#000000', surface: '#0d0d0d', surface2: '#1a1a1a', inverse: '#f5f5f5', inverseText: '#000000', inverseMuted: '#555555', text: '#f5f5f5', muted: '#9a9a9a', border: '#222222', accent: '#d4ff3f', accent2: '#ffffff', onAccent: '#000000' },
    fonts: { heading: 'Space Grotesk', body: 'Space Grotesk', google: ['Space+Grotesk:wght@400;500;600;700'] },
    radius: '8px', btnRadius: '999px', shadow: 'none',
  },
  {
    id: 'graphite', name: 'Graphite', group: 'Dark',
    colors: { bg: '#1c1d21', surface: '#25272c', surface2: '#2f3238', inverse: '#f2f2f2', inverseText: '#1c1d21', inverseMuted: '#5c5f66', text: '#ececec', muted: '#a0a3a9', border: '#34373e', accent: '#ff7a1a', accent2: '#ffc145', onAccent: '#1c1d21' },
    fonts: { heading: 'Sora', body: 'Inter', google: ['Sora:wght@400;600;700', 'Inter:wght@400;500;600'] },
    radius: '10px', btnRadius: '8px', shadow: '0 8px 24px rgba(0,0,0,.4)',
  },
  {
    id: 'dracula', name: 'Dracula', group: 'Dark',
    colors: { bg: '#1e1b2e', surface: '#282438', surface2: '#332e47', inverse: '#f8f8f2', inverseText: '#1e1b2e', inverseMuted: '#6c6783', text: '#f8f8f2', muted: '#b3aed0', border: '#3a3452', accent: '#ff79c6', accent2: '#8be9fd', onAccent: '#1e1b2e' },
    fonts: { heading: 'Outfit', body: 'Outfit', google: ['Outfit:wght@400;500;600;700'] },
    radius: '14px', btnRadius: '12px', shadow: '0 10px 30px rgba(0,0,0,.4)',
  },

  // ── Corporate ──────────────────────────────────────────────────────────
  {
    id: 'enterprise', name: 'Enterprise', group: 'Corporate',
    colors: { bg: '#ffffff', surface: '#f4f7fb', surface2: '#e6edf6', inverse: '#0f2a4a', inverseText: '#ffffff', inverseMuted: '#9fb3cc', text: '#0f1d2e', muted: '#5b6b80', border: '#dbe3ee', accent: '#0a66c2', accent2: '#00a3e0', onAccent: '#ffffff' },
    fonts: { heading: 'Roboto', body: 'Roboto', google: ['Roboto:wght@400;500;700'] },
    radius: '6px', btnRadius: '6px', shadow: '0 2px 8px rgba(15,42,74,.08)',
  },
  {
    id: 'fintech', name: 'Fintech', group: 'Corporate',
    colors: { bg: '#f6fbf8', surface: '#eaf5ef', surface2: '#d7ece0', inverse: '#0b2e22', inverseText: '#f6fbf8', inverseMuted: '#8fb5a4', text: '#0d241b', muted: '#4f6b5f', border: '#cfe3d8', accent: '#10b981', accent2: '#0ea5e9', onAccent: '#ffffff' },
    fonts: { heading: 'Plus Jakarta Sans', body: 'Plus Jakarta Sans', google: ['Plus+Jakarta+Sans:wght@400;500;600;700'] },
    radius: '12px', btnRadius: '10px', shadow: '0 6px 20px rgba(11,46,34,.08)',
  },
  {
    id: 'consulting', name: 'Consulting', group: 'Corporate',
    colors: { bg: '#fbfaf7', surface: '#f1eee6', surface2: '#e5dfd1', inverse: '#14213d', inverseText: '#fbfaf7', inverseMuted: '#a7b0c2', text: '#14213d', muted: '#5a6378', border: '#e2dccd', accent: '#b08d57', accent2: '#3d5a80', onAccent: '#ffffff' },
    fonts: { heading: 'Libre Baskerville', body: 'Lato', google: ['Libre+Baskerville:wght@400;700', 'Lato:wght@400;700'] },
    radius: '4px', btnRadius: '2px', shadow: '0 2px 10px rgba(20,33,61,.07)',
  },
  {
    id: 'healthcare', name: 'Healthcare', group: 'Corporate',
    colors: { bg: '#ffffff', surface: '#f0f9fa', surface2: '#dff1f3', inverse: '#0c3b47', inverseText: '#ffffff', inverseMuted: '#8db8c1', text: '#10313a', muted: '#557780', border: '#d5ebee', accent: '#0891b2', accent2: '#22c55e', onAccent: '#ffffff' },
    fonts: { heading: 'Nunito Sans', body: 'Nunito Sans', google: ['Nunito+Sans:wght@400;600;700'] },
    radius: '16px', btnRadius: '999px', shadow: SOFT,
  },

  // ── Vibrant ────────────────────────────────────────────────────────────
  {
    id: 'candy', name: 'Candy', group: 'Vibrant',
    colors: { bg: '#fff7fb', surface: '#ffeaf4', surface2: '#f9d9ff', inverse: '#3b0a45', inverseText: '#fff7fb', inverseMuted: '#d9a6e6', text: '#3b0a45', muted: '#8a5a94', border: '#f5d0e6', accent: '#ff4fa3', accent2: '#9b5cff', onAccent: '#ffffff' },
    fonts: { heading: 'Fredoka', body: 'Nunito', google: ['Fredoka:wght@400;500;600;700', 'Nunito:wght@400;600;700'] },
    radius: '20px', btnRadius: '999px', shadow: '0 10px 24px rgba(255,79,163,.18)',
  },
  {
    id: 'sunset', name: 'Sunset', group: 'Vibrant',
    colors: { bg: '#fff8f2', surface: '#ffeedd', surface2: '#ffdcc2', inverse: '#2b1320', inverseText: '#fff8f2', inverseMuted: '#d7a78f', text: '#2b1320', muted: '#7d5560', border: '#f6d6c0', accent: '#ff6b3d', accent2: '#e8457c', onAccent: '#ffffff' },
    fonts: { heading: 'Poppins', body: 'Poppins', google: ['Poppins:wght@400;500;600;700'] },
    radius: '16px', btnRadius: '999px', shadow: '0 10px 28px rgba(255,107,61,.16)',
  },
  {
    id: 'tropical', name: 'Tropical', group: 'Vibrant',
    colors: { bg: '#f2fbf9', surface: '#dff5f0', surface2: '#c6ece3', inverse: '#053b3a', inverseText: '#f2fbf9', inverseMuted: '#86bdb6', text: '#08302f', muted: '#4c7471', border: '#c9e9e2', accent: '#00b3a4', accent2: '#ffc93c', onAccent: '#ffffff' },
    fonts: { heading: 'Rubik', body: 'Rubik', google: ['Rubik:wght@400;500;600;700'] },
    radius: '14px', btnRadius: '12px', shadow: '0 8px 22px rgba(5,59,58,.10)',
  },
  {
    id: 'pop', name: 'Pop', group: 'Vibrant',
    colors: { bg: '#fffbea', surface: '#fff3c4', surface2: '#ffe680', inverse: '#111111', inverseText: '#fffbea', inverseMuted: '#b9b39a', text: '#111111', muted: '#55524a', border: '#111111', accent: '#ff3b30', accent2: '#2f6bff', onAccent: '#ffffff' },
    fonts: { heading: 'Archivo Black', body: 'Archivo', google: ['Archivo+Black', 'Archivo:wght@400;500;700'] },
    radius: '6px', btnRadius: '6px', shadow: '4px 4px 0 #111111',
    btnBorder: '2px solid #111111', cardBorder: '2px solid #111111',
  },

  // ── Luxury ─────────────────────────────────────────────────────────────
  {
    id: 'noir-gold', name: 'Noir Gold', group: 'Luxury',
    colors: { bg: '#0c0b09', surface: '#15130f', surface2: '#1f1c16', inverse: '#f3ead7', inverseText: '#0c0b09', inverseMuted: '#6e6553', text: '#f3ead7', muted: '#a99f8a', border: '#2b261d', accent: '#c9a24d', accent2: '#e6d3a3', onAccent: '#0c0b09' },
    fonts: { heading: 'Playfair Display', body: 'Lato', google: ['Playfair+Display:wght@400;600;700', 'Lato:wght@400;700'] },
    radius: '2px', btnRadius: '0px', shadow: 'none', headingTracking: '0.01em',
  },
  {
    id: 'ivory', name: 'Ivory Serif', group: 'Luxury',
    colors: { bg: '#fbf8f1', surface: '#f3eee2', surface2: '#e8e0cd', inverse: '#1f3a2e', inverseText: '#fbf8f1', inverseMuted: '#a6b8ad', text: '#1f2a24', muted: '#66706a', border: '#e3dccb', accent: '#1f5c45', accent2: '#b0874f', onAccent: '#ffffff' },
    fonts: { heading: 'Cormorant Garamond', body: 'Jost', google: ['Cormorant+Garamond:wght@500;600;700', 'Jost:wght@400;500;600'] },
    radius: '0px', btnRadius: '0px', shadow: 'none', headingWeight: '600',
  },
  {
    id: 'champagne', name: 'Champagne', group: 'Luxury',
    colors: { bg: '#fdf6f3', surface: '#f8e9e3', surface2: '#f1d9cf', inverse: '#3a2a2d', inverseText: '#fdf6f3', inverseMuted: '#c7a9a6', text: '#3a2a2d', muted: '#8a6f70', border: '#efd9d0', accent: '#b76e79', accent2: '#d4a373', onAccent: '#ffffff' },
    fonts: { heading: 'Marcellus', body: 'Raleway', google: ['Marcellus', 'Raleway:wght@400;500;600;700'] },
    radius: '18px', btnRadius: '999px', shadow: '0 10px 30px rgba(183,110,121,.14)',
  },
  {
    id: 'royal', name: 'Royal', group: 'Luxury',
    colors: { bg: '#140c24', surface: '#1d1233', surface2: '#2a1b47', inverse: '#f4ecff', inverseText: '#140c24', inverseMuted: '#6b5a8a', text: '#f4ecff', muted: '#b8a7d6', border: '#2f2150', accent: '#d4af37', accent2: '#9d6bff', onAccent: '#140c24' },
    fonts: { heading: 'Cinzel', body: 'Nunito Sans', google: ['Cinzel:wght@400;600;700', 'Nunito+Sans:wght@400;600;700'] },
    radius: '10px', btnRadius: '6px', shadow: DEEP,
  },

  // ── Tech ───────────────────────────────────────────────────────────────
  {
    id: 'neon', name: 'Neon Cyber', group: 'Tech',
    colors: { bg: '#05040a', surface: '#0d0b17', surface2: '#161226', inverse: '#e9f8ff', inverseText: '#05040a', inverseMuted: '#4d5a66', text: '#e9f8ff', muted: '#8ea3b5', border: '#1f1a38', accent: '#00f0ff', accent2: '#ff2bd6', onAccent: '#05040a' },
    fonts: { heading: 'Orbitron', body: 'Exo 2', google: ['Orbitron:wght@500;700', 'Exo+2:wght@400;500;600'] },
    radius: '6px', btnRadius: '4px', shadow: '0 0 24px rgba(0,240,255,.35)',
  },
  {
    id: 'terminal', name: 'Terminal', group: 'Tech',
    colors: { bg: '#0a0f0a', surface: '#0f170f', surface2: '#142014', inverse: '#c8ffc8', inverseText: '#0a0f0a', inverseMuted: '#3c5a3c', text: '#b6f5b6', muted: '#6fae6f', border: '#1d3a1d', accent: '#39ff14', accent2: '#ffd400', onAccent: '#0a0f0a' },
    fonts: { heading: 'JetBrains Mono', body: 'JetBrains Mono', google: ['JetBrains+Mono:wght@400;500;700'] },
    radius: '0px', btnRadius: '0px', shadow: 'none',
  },
  {
    id: 'brutalist', name: 'Brutalist', group: 'Tech',
    colors: { bg: '#ffffff', surface: '#f2f2f2', surface2: '#e6e6e6', inverse: '#000000', inverseText: '#ffffff', inverseMuted: '#bbbbbb', text: '#000000', muted: '#333333', border: '#000000', accent: '#ffde00', accent2: '#ff5c00', onAccent: '#000000' },
    fonts: { heading: 'Space Grotesk', body: 'Space Grotesk', google: ['Space+Grotesk:wght@400;500;700'] },
    radius: '0px', btnRadius: '0px', shadow: '6px 6px 0 #000000',
    btnBorder: '3px solid #000000', cardBorder: '3px solid #000000', headingCase: 'uppercase', headingWeight: '700',
  },
  {
    id: 'aurora', name: 'Aurora', group: 'Tech',
    colors: { bg: '#061a1f', surface: '#0b252c', surface2: '#11323a', inverse: '#e6fffa', inverseText: '#061a1f', inverseMuted: '#4b6b6f', text: '#e6fffa', muted: '#94bdb9', border: '#16404a', accent: '#2dd4bf', accent2: '#a78bfa', onAccent: '#061a1f' },
    fonts: { heading: 'Sora', body: 'Manrope', google: ['Sora:wght@400;600;700', 'Manrope:wght@400;500;600'] },
    radius: '16px', btnRadius: '999px', shadow: '0 12px 40px rgba(45,212,191,.15)',
  },
];

const MODELS_BY_ID = new Map(THEME_MODELS.map((m) => [m.id, m]));

export function getThemeModel(id) {
  return id ? MODELS_BY_ID.get(String(id)) || null : null;
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/* ------------------------------------------------------------------ engine */

export function themeEngine(doc, model, opts) {
  opts = opts || {};
  var STYLE_ID = '__clonyfy_theme_style__';
  var FONT_ID = '__clonyfy_theme_font__';
  var ATTR = 'data-cth';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var MAX_ELEMENTS = 9000;
  var root = doc && doc.documentElement;
  if (!root || !doc.body) return null;
  var win = doc.defaultView || window;

  if (root.__clonyfyThemeObserver) {
    try { root.__clonyfyThemeObserver.disconnect(); } catch (e) { /* ignore */ }
    root.__clonyfyThemeObserver = null;
  }

  function removeNode(n) { if (n && n.parentNode) n.parentNode.removeChild(n); }
  // Without this, CSS transitions make getComputedStyle report the previous theme's colors.
  removeNode(doc.getElementById('__clonyfy_theme_freeze__'));
  var freeze = doc.createElement('style');
  freeze.id = '__clonyfy_theme_freeze__';
  freeze.textContent = '*,*::before,*::after{transition:none!important}';
  (doc.head || root).appendChild(freeze);
  function unfreeze() {
    try { void win.getComputedStyle(doc.body).color; } catch (e) { /* ignore */ }
    removeNode(freeze);
  }
  removeNode(doc.getElementById(STYLE_ID));
  removeNode(doc.getElementById(FONT_ID));
  var tagged = doc.querySelectorAll('[' + ATTR + ']');
  for (var ti = 0; ti < tagged.length; ti++) tagged[ti].removeAttribute(ATTR);
  root.removeAttribute('data-cth-theme');
  if (!model || !model.colors) { unfreeze(); return null; }

  var C = model.colors;

  function gcs(el) {
    try { return win.getComputedStyle(el); } catch (e) {
      try { return window.getComputedStyle(el); } catch (e2) { return null; }
    }
  }
  function num(s, pctScale) {
    if (s == null || s === 'none') return 0;
    var n = parseFloat(s);
    if (isNaN(n)) return 0;
    return /%$/.test(s) ? (n / 100) * pctScale : n;
  }
  function alphaOf(s) {
    if (s == null) return 1;
    var a = num(s, 1);
    return isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
  }
  function gamma(v) {
    v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, v)) * 255);
  }
  function fromOklab(L, A, B, alpha) {
    var l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
    var m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
    var s = Math.pow(L - 0.0894841775 * A - 1.2914855480 * B, 3);
    return {
      r: gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      g: gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      b: gamma(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
      a: alpha,
    };
  }
  function parse(v) {
    var str = String(v || '');
    var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/i.exec(str);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: alphaOf(m[4]) };
    m = /(oklab|oklch)\(\s*([-\d.e]+%?|none)\s+([-\d.e]+%?|none)\s+([-\d.e]+%?|none)(?:\s*\/\s*([\d.]+%?))?\s*\)/i.exec(str);
    if (m) {
      var L = num(m[2], 1), a = alphaOf(m[5]);
      if (m[1].toLowerCase() === 'oklch') {
        var Cc = num(m[3], 0.4), h = num(m[4], 1) * Math.PI / 180;
        return fromOklab(L, Cc * Math.cos(h), Cc * Math.sin(h), a);
      }
      return fromOklab(L, num(m[3], 0.4), num(m[4], 0.4), a);
    }
    m = /color\(\s*srgb\s+([-\d.e]+%?)\s+([-\d.e]+%?)\s+([-\d.e]+%?)(?:\s*\/\s*([\d.]+%?))?\s*\)/i.exec(str);
    if (m) {
      var c8 = function (x) { return Math.round(Math.max(0, Math.min(1, num(x, 1))) * 255); };
      return { r: c8(m[1]), g: c8(m[2]), b: c8(m[3]), a: alphaOf(m[4]) };
    }
    return null;
  }
  var COLOR_RE = /(?:rgba?|oklab|oklch|color)\([^()]*\)/gi;
  function lstar(c) {
    function ch(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    var y = 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
    return (y <= 0.008856 ? y * 903.3 : 116 * Math.cbrt(y) - 16) / 100;
  }
  function hsl(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return { h: 0, s: 0, l: l };
    var d = mx - mn;
    var s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    var h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: h * 60, s: s, l: l };
  }
  function chroma(c) {
    if (!c) return null;
    var x = hsl(c);
    return x.s >= 0.3 && x.l > 0.14 && x.l < 0.9 ? x : null;
  }
  function blend(top, under) {
    var a = top.a;
    return { r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1 };
  }
  function rgbTriplet(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16);
    if (isNaN(n)) return '0,0,0';
    return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  }
  function splitLayers(str) {
    var out = [], depth = 0, quote = '', start = 0;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = ''; continue; }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      else if (ch === ',' && depth === 0) { out.push(str.slice(start, i).trim()); start = i + 1; }
    }
    out.push(str.slice(start).trim());
    return out;
  }
  function gradientLayers(str) {
    return splitLayers(str).filter(function (l) { return /gradient\(/i.test(l) && !/^\s*url\(/i.test(l); });
  }
  function tok(prefix, role, alpha) {
    if (alpha == null || alpha >= 0.95) return prefix + '-' + role;
    var q = Math.max(5, Math.min(90, Math.round(alpha * 20) * 5));
    return prefix + '-' + role + '-' + q;
  }

  var white = { r: 255, g: 255, b: 255, a: 1 };
  var base = white;
  var htmlBg = parse((gcs(root) || {}).backgroundColor);
  if (htmlBg && htmlBg.a > 0.05) base = blend(htmlBg, white);
  var bodyBg = parse((gcs(doc.body) || {}).backgroundColor);
  if (bodyBg && bodyBg.a > 0.05) base = blend(bodyBg, base);
  var baseL = lstar(base);

  var SKIP = /^(SCRIPT|STYLE|LINK|META|NOSCRIPT|TEMPLATE|HEAD|TITLE|BR|WBR|SOURCE|TRACK|PARAM)$/;
  var MEDIA = /^(IMG|VIDEO|CANVAS|IFRAME|OBJECT|EMBED|PICTURE|AUDIO)$/;
  var BTN_CLASS = /(^|[\s_-])(btn|button|cta)([\s_-]|$)/i;

  // Page background = largest neutral painted area (often a full-page wrapper, not <body>).
  var baseVotes = {};
  function vote(l, w) {
    var key = Math.round(l * 20);
    var v = baseVotes[key] || (baseVotes[key] = { w: 0, l: 0 });
    v.w += w;
    v.l += l * w;
  }
  try { vote(baseL, (doc.body.scrollWidth || 1000) * Math.min(doc.body.scrollHeight || 1000, 4000) * 0.35); } catch (e) { /* ignore */ }

  var effMap = new Map();
  effMap.set(root, { col: base, role: 'bg' });
  var hueBins = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var accentBins = null;
  var accent2Bins = null;
  var used = {};
  var tagCount = 0;

  function binOf(h) { return Math.floor((((h % 360) + 360) % 360) / 30) % 12; }
  function binDist(a, b) { var d = Math.abs(a - b) % 12; return Math.min(d, 12 - d); }
  function hueRole(h) {
    var b = binOf(h);
    if (!accentBins) return 'accent';
    if (accentBins.indexOf(b) >= 0) return 'accent';
    if (accent2Bins && accent2Bins.indexOf(b) >= 0) return 'accent2';
    var da = 99, db = 99;
    for (var i = 0; i < accentBins.length; i++) da = Math.min(da, binDist(b, accentBins[i]));
    if (accent2Bins) for (var j = 0; j < accent2Bins.length; j++) db = Math.min(db, binDist(b, accent2Bins[j]));
    return da <= db ? 'accent' : 'accent2';
  }
  function neutralRole(comp) {
    var d = Math.abs(lstar(comp) - baseL);
    return d < 0.03 ? 'bg' : d < 0.16 ? 'surface' : d < 0.42 ? 'surface2' : 'inverse';
  }
  function effFor(el) {
    var p = el && el.parentElement;
    while (p) {
      var e = effMap.get(p);
      if (e) return e;
      p = p.parentElement;
    }
    return effMap.get(root);
  }

  function collect(list) {
    var recs = [];
    for (var i = 0; i < list.length && recs.length < MAX_ELEMENTS; i++) {
      var el = list[i];
      if (!el || el.nodeType !== 1) continue;
      var tag = String(el.tagName || '').toUpperCase();
      if (SKIP.test(tag)) continue;
      if (el.closest && el.closest('[data-clonyfy-ui]')) continue;
      var cs = gcs(el);
      if (!cs) continue;
      var parentEff = effMap.get(el.parentElement) || effFor(el);
      var svg = el.namespaceURI === SVGNS;
      var media = MEDIA.test(tag);
      var rec = { el: el, cs: cs, tag: tag, svg: svg, media: media, parentEff: parentEff, eff: parentEff };
      var bg = !svg && !media ? parse(cs.backgroundColor) : null;
      if (bg && bg.a > 0.04) {
        var comp = blend(bg, parentEff.col);
        rec.bg = bg;
        rec.bgComp = comp;
        rec.eff = { col: comp, role: null };
        var bch = chroma(bg.a >= 0.5 ? bg : comp);
        var area = 0;
        try {
          var rect = el.getBoundingClientRect();
          area = rect.width * rect.height;
        } catch (e) { /* ignore */ }
        if (bch) hueBins[binOf(bch.h)] += 1500 + Math.min(250000, area);
        else if (baseVotes && bg.a >= 0.92) vote(lstar(comp), Math.min(8e6, area));
      }
      effMap.set(el, rec.eff);
      rec.color = parse(cs.color);
      var tch = chroma(rec.color);
      if (tch && !media) hueBins[binOf(tch.h)] += 400;
      var bgImg = String(cs.backgroundImage || '');
      if (!svg && /gradient\(/i.test(bgImg)) {
        rec.gradStr = bgImg;
        rec.gradHasUrl = /url\(/i.test(bgImg);
        var stops = gradientLayers(bgImg).join(',').match(COLOR_RE) || [];
        for (var s = 0; s < stops.length; s++) {
          var sp = parse(stops[s]);
          var sc = chroma(sp);
          if (sc) { rec.gradChroma = true; hueBins[binOf(sc.h)] += 2000 * Math.max(0.2, sp.a); }
        }
      }
      if (!svg && !media) {
        for (var pi = 0; pi < 2; pi++) {
          var pcs = null;
          try { pcs = win.getComputedStyle(el, pi ? '::after' : '::before'); } catch (e) { pcs = null; }
          if (!pcs || pcs.content === 'none' || pcs.content === 'normal') continue;
          var pbg = parse(pcs.backgroundColor);
          if (pbg && pbg.a > 0.04) rec[pi ? 'pa' : 'pb'] = pbg;
        }
        var blendMode = cs.mixBlendMode;
        rec.blend = !!blendMode && blendMode !== 'normal';
      } else if (svg) {
        rec.svgDef = !!(el.closest && el.closest('mask,clipPath,pattern,defs,symbol,marker,linearGradient,radialGradient'));
      }
      rec.buttonish = tag === 'BUTTON'
        || (tag === 'INPUT' && /^(submit|button|reset)$/i.test(el.getAttribute('type') || ''))
        || el.getAttribute('role') === 'button'
        || ((tag === 'A' || tag === 'DIV' || tag === 'SPAN') && BTN_CLASS.test(String(el.getAttribute('class') || '')));
      rec.formField = (tag === 'INPUT' && !/^(submit|button|reset|checkbox|radio|range|color|file|image|hidden)$/i.test(el.getAttribute('type') || ''))
        || tag === 'TEXTAREA' || tag === 'SELECT';
      recs.push(rec);
    }
    return recs;
  }

  function resolveClusters() {
    var top = -1, topW = 0;
    for (var i = 0; i < 12; i++) if (hueBins[i] > topW) { topW = hueBins[i]; top = i; }
    if (top < 0) { accentBins = null; accent2Bins = null; return; }
    accentBins = [(top + 11) % 12, top, (top + 1) % 12];
    var sec = -1, secW = 0;
    for (var j = 0; j < 12; j++) {
      if (binDist(j, top) < 2) continue;
      if (hueBins[j] > secW) { secW = hueBins[j]; sec = j; }
    }
    accent2Bins = sec < 0 ? null : [(sec + 11) % 12, sec, (sec + 1) % 12].filter(function (b) {
      return accentBins.indexOf(b) < 0;
    });
  }

  var gradRules = {};
  var gradIds = {};
  var gradCount = 0;
  function stopRole(c) {
    var ch = chroma(c);
    if (ch) return hueRole(ch.h);
    var d = Math.abs(lstar(c) - baseL);
    return d < 0.03 ? 'bg' : d < 0.16 ? 'surface' : d < 0.42 ? 'surface2' : 'inverse';
  }
  /** Same gradient geometry and alpha, stop colors swapped for theme roles; url() layers kept. */
  function gradientToken(str) {
    if (gradIds[str]) return gradIds[str];
    if (gradCount >= 400) return null;
    var mapped = splitLayers(str).map(function (layer) {
      if (!/gradient\(/i.test(layer) || /^\s*url\(/i.test(layer)) return layer;
      return layer.replace(COLOR_RE, function (stop) {
        var c = parse(stop);
        if (!c) return stop;
        if (c.a < 0.02) return 'rgba(var(--ct-bg-rgb),0)';
        var a = Math.round(c.a * 100) / 100;
        return 'rgba(var(--ct-' + stopRole(c) + '-rgb),' + a + ')';
      });
    }).join(', ');
    var id = 'gx' + (gradCount++);
    gradIds[str] = id;
    gradRules[id] = mapped;
    return id;
  }

  /** Fill/stroke: chromatic → accent hues; neutral ink → text roles by contrast. */
  function inkRole(c, eff, effRole, accentCtx) {
    var ch = chroma(c);
    if (accentCtx) return 'onAccent';
    if (ch) return hueRole(ch.h);
    var ctx = Math.abs(lstar(c) - lstar(eff.col));
    var baseC = Math.abs(lstar(c) - baseL);
    if (ctx >= 0.35) return effRole === 'inverse' ? (ctx > 0.5 ? 'inverseText' : 'inverseMuted') : (ctx > 0.55 ? 'text' : 'muted');
    if (baseC >= 0.35) return baseC > 0.55 ? 'text' : 'muted';
    return null;
  }
  function pseudoRole(c, eff) {
    var ch = chroma(c.a >= 0.5 ? c : blend(c, eff.col));
    if (ch) return hueRole(ch.h);
    if (c.a < 0.92) return Math.abs(lstar(c) - baseL) > 0.5 ? 'text' : 'bg';
    return neutralRole(blend(c, eff.col));
  }

  function assign(recs) {
    for (var i = 0; i < recs.length; i++) {
      var rec = recs[i];
      var el = rec.el, cs = rec.cs;
      var tokens = [];
      var eff = rec.eff, peff = rec.parentEff;

      if (rec.bg) {
        var bch = chroma(rec.bg.a >= 0.5 ? rec.bg : rec.bgComp);
        if (bch) {
          var hr = hueRole(bch.h);
          tokens.push(tok('b', hr, rec.bg.a));
          eff.role = hr;
        } else if (rec.bg.a < 0.92) {
          var towardText = Math.abs(lstar(rec.bg) - baseL) > 0.5;
          tokens.push(tok('b', towardText ? 'text' : 'bg', rec.bg.a));
          eff.role = peff.role || 'bg';
        } else {
          var nr = neutralRole(rec.bgComp);
          if (nr === 'inverse' && rec.buttonish) nr = 'accent';
          tokens.push(tok('b', nr, 1));
          eff.role = nr;
        }
      }
      var effRole = eff.role || peff.role || 'bg';
      var accentCtx = effRole === 'accent' || effRole === 'accent2';

      if (!rec.media && rec.color && rec.color.a > 0.05) {
        var tc = rec.color, tr = null;
        var tch = chroma(tc);
        if (accentCtx) tr = 'onAccent';
        else if (tch) tr = hueRole(tch.h);
        else {
          var contrast = Math.abs(lstar(tc) - lstar(eff.col));
          var baseContrast = Math.abs(lstar(tc) - baseL);
          // Positioned text (fixed headers, overlays) often doesn't sit on its DOM parent's background.
          if (contrast < 0.35 && baseContrast >= 0.35) tr = baseContrast > 0.55 ? 'text' : 'muted';
          else if (contrast >= 0.08) {
            if (effRole === 'inverse') tr = contrast > 0.5 ? 'inverseText' : 'inverseMuted';
            else tr = contrast > 0.55 ? 'text' : 'muted';
          }
        }
        if (tr) tokens.push(tok('t', tr, tc.a));
      }

      if (rec.svg) {
        if (!rec.svgDef) {
          var fill = parse(cs.fill);
          var fr = fill && fill.a > 0.05 ? inkRole(fill, eff, effRole, accentCtx) : null;
          if (fr) tokens.push(tok('f', fr, fill.a));
          var stroke = parse(cs.stroke);
          var sr = stroke && stroke.a > 0.05 ? inkRole(stroke, eff, effRole, accentCtx) : null;
          if (sr) tokens.push(tok('k', sr, stroke.a));
        }
      } else {
        if (rec.pb) tokens.push(tok('pb', pseudoRole(rec.pb, eff), rec.pb.a));
        if (rec.pa) tokens.push(tok('pa', pseudoRole(rec.pa, eff), rec.pa.a));
        var bw = cs.borderTopStyle !== 'none' ? parseFloat(cs.borderTopWidth) || 0 : 0;
        var bc = cs.borderTopColor;
        if (!bw && cs.borderBottomStyle !== 'none') { bw = parseFloat(cs.borderBottomWidth) || 0; bc = cs.borderBottomColor; }
        if (!bw && cs.borderLeftStyle !== 'none') { bw = parseFloat(cs.borderLeftWidth) || 0; bc = cs.borderLeftColor; }
        if (bw > 0) {
          var bcol = parse(bc);
          if (bcol && bcol.a > 0.05) {
            var bcc = chroma(bcol);
            tokens.push(tok('d', bcc ? hueRole(bcc.h) : (effRole === 'inverse' ? 'inverseMuted' : 'border'), bcol.a));
          }
        }
        if (rec.gradStr) {
          var gArea = 0;
          try { var gr = el.getBoundingClientRect(); gArea = gr.width * gr.height; } catch (e) { /* ignore */ }
          if (rec.gradChroma && !rec.gradHasUrl && (rec.buttonish || (gArea > 0 && gArea < 30000))) tokens.push('g');
          else {
            var gTok = gradientToken(rec.gradStr);
            if (gTok) tokens.push(gTok);
          }
        }

        var radRaw = String(cs.borderTopLeftRadius || '');
        var rad = parseFloat(radRaw) || 0;
        var isPct = /%$/.test(radRaw);
        var rect = null;
        if ((rec.buttonish && rec.bg) || rad > 0) {
          try { rect = el.getBoundingClientRect(); } catch (e) { rect = null; }
        }
        var half = rect ? Math.min(rect.width, rect.height) / 2 : 0;
        var squareish = rect && rect.width > 0 && Math.abs(rect.width - rect.height) < 4;
        var circle = isPct ? rad >= 40 : (half > 0 && rad >= half - 1);
        if (rec.buttonish && rec.bg && !(circle && squareish)) tokens.push('rb');
        else if (rad > 0 && !circle) tokens.push(rec.formField ? 'ri' : 'r');

        if (cs.boxShadow && cs.boxShadow !== 'none') tokens.push('sh');
      }

      if (rec.blend && tokens.length) tokens.push('mb');
      if (tokens.length) {
        var prev = el.getAttribute(ATTR);
        el.setAttribute(ATTR, prev ? prev + ' ' + tokens.join(' ') : tokens.join(' '));
        tagCount++;
        for (var t = 0; t < tokens.length; t++) used[tokens[t]] = 1;
      }
    }
  }

  function fontStack(name, fallback) {
    return "'" + String(name || '').replace(/'/g, '') + "', " + fallback;
  }

  function buildCss() {
    var F = model.fonts || {};
    var vars = [];
    for (var role in C) {
      if (!Object.prototype.hasOwnProperty.call(C, role)) continue;
      vars.push('--ct-' + role + ':' + C[role]);
      vars.push('--ct-' + role + '-rgb:' + rgbTriplet(C[role]));
    }
    vars.push('--ct-radius:' + (model.radius || '8px'));
    vars.push('--ct-radius-btn:' + (model.btnRadius || model.radius || '8px'));
    vars.push('--ct-radius-input:' + (model.inputRadius || model.radius || '8px'));
    vars.push('--ct-shadow:' + (model.shadow || 'none'));
    vars.push('--ct-font-body:' + fontStack(F.body, 'system-ui, -apple-system, "Segoe UI", sans-serif'));
    vars.push('--ct-font-heading:' + fontStack(F.heading || F.body, 'system-ui, -apple-system, "Segoe UI", sans-serif'));

    var css = ':root{' + vars.join(';') + '}';
    css += 'html,body{background-color:var(--ct-bg)!important}';
    css += 'body{color:var(--ct-text)!important}';
    var PROPS = { b: 'background-color', t: 'color', d: 'border-color', f: 'fill', k: 'stroke', pb: 'background-color', pa: 'background-color' };
    var PSEUDO = { pb: '::before', pa: '::after' };
    for (var key in used) {
      var m = /^(pb|pa|[btdfk])-([A-Za-z0-9]+)(?:-(\d+))?$/.exec(key);
      if (!m || !C[m[2]]) continue;
      var value = m[3] ? 'rgba(var(--ct-' + m[2] + '-rgb),' + (parseInt(m[3], 10) / 100) + ')' : 'var(--ct-' + m[2] + ')';
      css += '[' + ATTR + '~="' + key + '"]' + (PSEUDO[m[1]] || '') + '{' + PROPS[m[1]] + ':' + value + '!important}';
    }
    css += '[' + ATTR + '~="mb"]{mix-blend-mode:normal!important}';
    css += '[' + ATTR + '~="g"]{background-image:linear-gradient(135deg,var(--ct-accent),var(--ct-accent2))!important}';
    for (var gid in gradRules) {
      if (used[gid]) css += '[' + ATTR + '~="' + gid + '"]{background-image:' + gradRules[gid] + '!important}';
    }
    css += '[' + ATTR + '~="r"]{border-radius:var(--ct-radius)!important}';
    css += '[' + ATTR + '~="rb"]{border-radius:var(--ct-radius-btn)!important}';
    css += '[' + ATTR + '~="ri"]{border-radius:var(--ct-radius-input)!important}';
    css += '[' + ATTR + '~="sh"]{box-shadow:var(--ct-shadow)!important}';
    if (model.btnBorder) css += '[' + ATTR + '~="rb"]{border:' + model.btnBorder + '!important}';
    if (model.cardBorder) css += '[' + ATTR + '~="r"][' + ATTR + '~="sh"]{border:' + model.cardBorder + '!important}';
    css += '[' + ATTR + '~="b-accent"]:hover,[' + ATTR + '~="b-accent2"]:hover{filter:brightness(1.08) saturate(1.05)}';
    css += '::selection{background:rgba(var(--ct-accent-rgb),.3)}';
    css += 'input::placeholder,textarea::placeholder{color:var(--ct-muted)!important}';
    css += 'body,body :not(i):not(svg):not(svg *):not(code):not(pre):not(kbd):not(samp)'
      + ':not([class*="icon" i]):not([class*="fa-"]):not([class*="material" i]):not([class*="glyph" i])'
      + '{font-family:var(--ct-font-body)!important}';
    var heading = 'font-family:var(--ct-font-heading)!important';
    if (model.headingWeight) heading += ';font-weight:' + model.headingWeight + '!important';
    if (model.headingTracking) heading += ';letter-spacing:' + model.headingTracking + '!important';
    if (model.headingCase) heading += ';text-transform:' + model.headingCase + '!important';
    // :not(#…) lifts specificity above the body font rule's long :not() chain.
    css += 'h1:not(#__cth),h2:not(#__cth),h3:not(#__cth),h4:not(#__cth),h5:not(#__cth),h6:not(#__cth){' + heading + '}';
    return css;
  }

  function writeCss() {
    var style = doc.getElementById(STYLE_ID);
    if (!style) {
      style = doc.createElement('style');
      style.id = STYLE_ID;
      (doc.head || root).appendChild(style);
    }
    style.textContent = buildCss();
  }

  var F = model.fonts || {};
  if (F.google && F.google.length) {
    var link = doc.createElement('link');
    link.id = FONT_ID;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?' + F.google.map(function (f) { return 'family=' + f; }).join('&') + '&display=swap';
    (doc.head || root).appendChild(link);
  }

  var initial = [doc.body];
  var all = doc.body.querySelectorAll('*');
  for (var k = 0; k < all.length && initial.length < MAX_ELEMENTS; k++) initial.push(all[k]);
  var recs = collect(initial);
  var best = null;
  for (var bk in baseVotes) if (!best || baseVotes[bk].w > best.w) best = baseVotes[bk];
  if (best && best.w > 0) baseL = best.l / best.w;
  baseVotes = null;
  resolveClusters();
  assign(recs);
  writeCss();
  root.setAttribute('data-cth-theme', String(model.id || ''));
  unfreeze();

  if (opts.observe && typeof MutationObserver === 'function') {
    var pending = [];
    var scheduled = false;
    var flush = function () {
      scheduled = false;
      var batch = pending;
      pending = [];
      var list = [];
      for (var i = 0; i < batch.length; i++) {
        var n = batch[i];
        if (!n.isConnected || n.hasAttribute(ATTR)) continue;
        list.push(n);
        var inner = n.querySelectorAll('*');
        for (var j = 0; j < inner.length && list.length < 2000; j++) list.push(inner[j]);
      }
      if (!list.length) return;
      var before = Object.keys(used).length;
      assign(collect(list));
      if (Object.keys(used).length !== before) writeCss();
    };
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) if (added[j].nodeType === 1) pending.push(added[j]);
      }
      if (pending.length && !scheduled) {
        scheduled = true;
        if (win.requestAnimationFrame) win.requestAnimationFrame(flush);
        else setTimeout(flush, 16);
      }
    });
    obs.observe(doc.body, { childList: true, subtree: true });
    root.__clonyfyThemeObserver = obs;
  }

  return { elements: tagCount, tokens: Object.keys(used).length, baseL: Math.round(baseL * 100) / 100 };
}

/* ---------------------------------------------------------------- builders */

/** Inline script stored in every captured page while a model is active (exports run it). */
export function buildThemeScript(model) {
  if (!model) return '';
  return `<script data-clonyfy-theme data-theme-id="${String(model.id).replace(/[^a-z0-9-]/gi, '')}">(function(){`
    + `var d=document,r=d.documentElement,M=${safeJson(model)},E=${themeEngine.toString()};`
    + `r.setAttribute('data-cth-pending','');`
    + `var p=d.createElement('style');p.id='__clonyfy_theme_pending__';p.textContent='html[data-cth-pending]{opacity:0!important}';`
    + `(d.head||r).appendChild(p);`
    + `function done(){r.removeAttribute('data-cth-pending');var x=d.getElementById('__clonyfy_theme_pending__');if(x&&x.parentNode)x.parentNode.removeChild(x);}`
    + `function run(){try{E(d,M,{observe:true});}catch(e){}done();}`
    + `setTimeout(done,2500);`
    + `if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',run,{once:true});else run();`
    + `})();</script>`;
}

/** Browser module for the editor: defines window.ClonyfyTheme = { models, apply(doc, id) }. */
export function buildThemeEngineModule() {
  return `(function(){var E=${themeEngine.toString()};var M=${safeJson(THEME_MODELS)};`
    + `function find(id){for(var i=0;i<M.length;i++)if(M[i].id===id)return M[i];return null;}`
    + `window.ClonyfyTheme={models:M,apply:function(doc,id){return E(doc,find(id),{observe:false});}};`
    + `})();`;
}

const THEME_SCRIPT_RE = /<script\b[^>]*\bdata-clonyfy-theme(?![-\w])[^>]*>[\s\S]*?<\/script>/gi;

/** Remove runtime-only theme output (tokens, generated stylesheet, font link). */
export function stripThemeArtifacts(html) {
  return String(html || '')
    .replace(/\sdata-cth(?:-theme|-pending)?\s*=\s*(["'])[^"']*\1/gi, '')
    .replace(/\sdata-cth-pending(?=[\s>])/gi, '')
    .replace(/<style\b[^>]*\bid\s*=\s*["']__clonyfy_theme_(?:style|pending|freeze)__["'][^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<link\b[^>]*\bid\s*=\s*["']__clonyfy_theme_font__["'][^>]*>/gi, '');
}

/** Replace any stored theme script with the given model's (or remove it when model is null). */
export function applyThemeScriptToHtml(html, model) {
  let out = stripThemeArtifacts(html).replace(THEME_SCRIPT_RE, '');
  const script = buildThemeScript(model);
  if (!script) return out;
  if (/<\/head>/i.test(out)) return out.replace(/<\/head>/i, `${script}</head>`);
  if (/<head\b[^>]*>/i.test(out)) return out.replace(/(<head\b[^>]*>)/i, `$1${script}`);
  return script + out;
}
