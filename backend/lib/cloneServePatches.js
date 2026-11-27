/**
 * Canonical HTML patches for Run Preview and Export Code.
 * Save As–level: keep text + images visible; never re-hide content.
 * Animation replay (CSS keyframes + scroll entrance) lives in clonePreviewRuntime.
 */
import { carouselFixInlineScript, CAROUSEL_SKIP_SELECTOR } from './carousel-fix.js';

// One start tag; quoted values may hold `>` (Tailwind `[&>svg]:size-4`).
const START_TAG_RE = /<[a-zA-Z][\w:-]*(?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>/g;
// Whole class tokens only: `lg:invisible` or `[&.is-open]:translate-y-0` are deliberate states.
const REVEAL_TOKEN_RE = /^(?:opacity-0|invisible|translate-y-(?:\d+|full)|delay-\d+)$/;

/**
 * Remove "hidden until JS" utility classes (scroll-reveal starts) from every tag except
 * interface layers the cloner marked `data-clonyfy-ui-hidden` (menus, backdrops, modals):
 * those stay hidden until the visitor opens them, exactly as on the live site.
 */
export function stripRevealClasses(html) {
  return String(html || '').replace(START_TAG_RE, (tag) => {
    if (/\sdata-clonyfy-ui-hidden\b/i.test(tag)) return tag;
    return tag.replace(/\bclass=(["'])([^"']*)\1/gi, (_m, q, cls) => {
      const next = String(cls).split(/\s+/).filter((t) => t && !REVEAL_TOKEN_RE.test(t)).join(' ');
      return `class=${q}${next}${q}`;
    });
  });
}

/** Not inside an interface layer that stays hidden until opened (see stripRevealClasses). */
const UI = ':not([data-clonyfy-ui-hidden]):not([data-clonyfy-ui-hidden] *)';

const UI_HINT_RE = /(?:^|[\s_-])(?:drop-?down|mega-?menu|sub-?menu|fly-?out|pop-?over|pop-?up|modal|drawer|backdrop|overlay|tooltip|off-?canvas|lightbox|dialog|search-results?)(?=[\s_-]|$)/i;
const ENTITIES = { amp: '&', quot: '"', '#39': "'", apos: "'", lt: '<', gt: '>' };
const decodeAttr = (v) => String(v).replace(/&(amp|quot|#39|apos|lt|gt);/g, (_m, e) => ENTITIES[e]);
const encodeAttr = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const classTokens = (v) => decodeAttr(v).split(/\s+/).filter(Boolean);
// The class list older clones were saved with: their strip also cut variant tails
// (`[&.is-open]:translate-y-0` → `[&.is-open]:`), so match through the same transform.
const legacyKey = (cls) => decodeAttr(cls)
  .replace(/\bopacity-0\b/g, '')
  .replace(/\binvisible\b/g, '')
  .replace(/\btranslate-y-(?:\d+|full)\b/g, '')
  .replace(/\bdelay-\d+\b/g, '')
  .split(/\s+/).filter(Boolean).join(' ');
function attrOf(tag, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\`]+))`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}

/**
 * Clones captured before interface layers were marked lost the `invisible`/`opacity-0`
 * classes that keep menu backdrops, dropdowns and drawers closed (nuts.com: grey screen).
 * Put them back from the page's original server markup: an element is restored only
 * when its remaining classes identify it unambiguously and it is UI chrome (fixed, a
 * dialog/menu role, or absolute with a menu/overlay name or inside header/nav).
 * Clones with the marker (or the new bake CSS) were captured with this already.
 */
export function restoreUiLayerClasses(html, serverHtml) {
  const out = String(html || '');
  if (!out || !serverHtml || out.includes('data-clonyfy-ui-hidden')) return out;
  const src = String(serverHtml);
  const chrome = [];
  for (const m of src.matchAll(/<(header|nav)\b[\s\S]*?<\/\1\s*>/gi)) chrome.push([m.index, m.index + m[0].length]);
  const inChrome = (i) => chrome.some(([a, b]) => i >= a && i < b);
  // key (classes without reveal utilities) → original class list, or null when ambiguous.
  const originals = new Map();
  const other = new Set();
  for (const m of src.matchAll(START_TAG_RE)) {
    const tag = m[0];
    const cls = attrOf(tag, 'class');
    if (!cls) continue;
    const tokens = classTokens(cls);
    const key = legacyKey(cls);
    if (!key) continue;
    const hidden = tokens.includes('invisible') || tokens.includes('opacity-0');
    const role = attrOf(tag, 'role') || '';
    const layer = hidden && (
      tokens.includes('fixed')
      || /^<dialog\b/i.test(tag)
      || /^(?:dialog|alertdialog|menu|listbox|tooltip)$/i.test(role)
      || attrOf(tag, 'aria-modal') === 'true'
      || (tokens.includes('absolute') && (UI_HINT_RE.test(`${tokens.join(' ')} ${attrOf(tag, 'id') || ''}`) || inChrome(m.index)))
    );
    if (!layer) { other.add(key); continue; }
    const orig = tokens.join(' ');
    originals.set(key, originals.has(key) && originals.get(key) !== orig ? null : orig);
  }
  for (const key of other) originals.delete(key);
  if (![...originals.values()].some(Boolean)) return out;
  return out.replace(START_TAG_RE, (tag) => {
    const cls = attrOf(tag, 'class');
    if (!cls) return tag;
    const orig = originals.get(legacyKey(cls));
    if (!orig) return tag;
    let next = tag;
    const style = attrOf(tag, 'style');
    if (style != null) {
      const decls = decodeAttr(style).split(';').map((d) => d.trim()).filter(Boolean);
      // Shown by the site's own script at capture (plain inline style): it is open, keep it.
      if (decls.some((d) => /^(?:opacity\s*:\s*1|visibility\s*:\s*visible)$/i.test(d))) return tag;
      // Drop the capture's forced reveal so the original classes apply again.
      const kept = decls.filter((d) => !/^(?:opacity\s*:\s*1|visibility\s*:\s*visible|transform\s*:\s*none)\s*!\s*important$/i.test(d));
      next = next.replace(/(\sstyle\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/i, `$1"${encodeAttr(kept.join('; '))}"`);
    }
    next = next.replace(/(\sclass\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/i, `$1"${encodeAttr(orig)}"`);
    return next.replace(/\s*(\/?)>$/, ' data-clonyfy-ui-hidden="1"$1>');
  });
}

/**
 * Bake CSS saved into older clones forces every `.opacity-0` / `.invisible` visible,
 * which would override the restored classes above. Exclude marked layers from those
 * rules, whatever version of the bake the clone carries.
 */
export function upgradeStaticBakeCss(html) {
  return String(html || '').replace(
    /(<style[^>]*\bid=["']clonyfy-static-media-bake["'][^>]*>)([\s\S]*?)(<\/style>)/i,
    (m, open, css, close) => {
      if (css.includes('data-clonyfy-ui-hidden')) return m;
      const next = css.replace(/([^{}]+)\{([^{}]*)\}/g, (rule, sel, body) => {
        const forced = /opacity-0|\.invisible|\[style\*="(?:opacity|visibility)|(?:^|,)\s*(?:img|picture|video|source)\s*(?:,|$)/.test(sel.trim());
        if (!forced || !/opacity\s*:\s*1|visibility\s*:\s*visible/.test(body)) return rule;
        return `${sel.split(',').map((s) => `${s.trim()}${UI}`).join(',')}{${body}}`;
      });
      return `${open}${next}${close}`;
    },
  );
}

const TRACKER_RE = /googletagmanager\.com|doubleclick\.net|facebook\.com\/tr|bat\.bing\.com|px\.ads\.linkedin\.com|analytics\.tiktok\.com|ct\.pinterest\.com|google-analytics\.com/i;

/**
 * The editor canvas runs without scripts, so `<noscript>` blocks render there. Tag
 * managers ship a `<noscript><iframe>` that can hold the canvas's load event for ~30s
 * (nuts.com: Google Tag Manager), and tracking pixels fire from the editor. Drop those;
 * other noscript content (image fallbacks) stays.
 */
export function stripTrackingNoscript(html) {
  return String(html || '').replace(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi, (m, inner) => (
    /<iframe\b/i.test(inner) || TRACKER_RE.test(inner) ? '' : m
  ));
}

/**
 * Bake Save As visibility into HTML (works without site JS).
 * Strips common hide-until-JS utility classes and forces text/media visible.
 * Does NOT force transform:none on AOS / Framer nodes — the animation runtime
 * replays those entrances without original site JS.
 */
export function bakeStaticMediaVisibilityHtml(html) {
  let out = String(html || '');
  if (!out) return out;
  if (/id=["']clonyfy-static-media-bake["']/.test(out)) return upgradeStaticBakeCss(out);
  out = out.replace(/\sloading=(["'])lazy\1/gi, ' loading="eager"');
  out = stripRevealClasses(out);
  const bakeCss = `<style id="clonyfy-static-media-bake">html,body,#__next,#root{opacity:1!important;visibility:visible!important}html.js,html.no-js,body.preload,body.loading,body.no-js{opacity:1!important;visibility:visible!important}[data-clonyfy-stack-hidden],[data-clonyfy-stack-hidden] *{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}.opacity-0${UI},[class*="opacity-0"]:not([aria-hidden="true"]):not([data-clonyfy-anim]):not([data-clonyfy-stack-hidden])${UI}{opacity:1!important;visibility:visible!important}.invisible:not([aria-hidden="true"]):not([data-clonyfy-anim]):not([data-clonyfy-stack-hidden])${UI}{visibility:visible!important}[style*="opacity:0"]:not([aria-hidden="true"]):not([data-clonyfy-anim]):not([data-clonyfy-stack-hidden])${UI},[style*="opacity: 0"]:not([aria-hidden="true"]):not([data-clonyfy-anim]):not([data-clonyfy-stack-hidden])${UI}{opacity:1!important;visibility:visible!important}[style*="visibility:hidden"]:not([aria-hidden="true"]):not([data-clonyfy-anim]):not([data-clonyfy-stack-hidden])${UI},[style*="visibility: hidden"]:not([aria-hidden="true"]):not([data-clonyfy-anim]):not([data-clonyfy-stack-hidden])${UI}{visibility:visible!important}[data-aos]:not([aria-hidden="true"]):not([data-clonyfy-stack-hidden]),[data-framer-appear-id]:not([aria-hidden="true"]):not([data-clonyfy-stack-hidden]){opacity:1;visibility:visible}img${UI},picture${UI},video${UI},source${UI}{opacity:1!important;visibility:visible!important}[data-clonyfy-ui-off]{opacity:0!important;visibility:hidden!important;pointer-events:none!important}img[hidden],picture[hidden],video[hidden]{display:revert!important}.hero-section-container,.hero-section__layout{isolation:auto!important}.hero-section__background,.hero-wave-animation,.hero-wave-animation__layout,.hero-wave-animation__contents{z-index:1!important;pointer-events:none!important}.hero-section__title--background,.hero-section__title--foreground,.hero-section__actions,[class*="title--foreground"],[class*="title--background"]{position:relative!important;z-index:3!important}.hero-section__title--foreground,[class*="title--foreground"]{display:block!important;visibility:visible!important;opacity:1!important;mix-blend-mode:hard-light!important;color:rgba(0,14,255,.5)!important}.hero-section__title--foreground .hero-section__title-main{color:#2d2564!important}.hero-section__title--foreground .hero-section__title-copy{color:rgba(0,14,255,.55)!important}.hero-section__title--background .hero-section__title-main{color:#061b31!important}.hero-section__title--background .hero-section__title-copy{color:#81b81a!important}.hero-logo-wall-section,.hero-logo-section{position:relative!important;z-index:2!important}.hero-wave-animation img[data-clonyfy-canvas-capture]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;object-fit:contain!important;object-position:70% center!important}</style>`;
  if (/<head[^>]*>/i.test(out)) out = out.replace(/<head[^>]*>/i, (m) => `${m}${bakeCss}`);
  else if (/<html[^>]*>/i.test(out)) out = out.replace(/<html[^>]*>/i, (m) => `${m}<head>${bakeCss}</head>`);
  else out = bakeCss + out;
  return out;
}

export function buildVisibilityPatchHtml(baseHref = '/', { includeBase = true } = {}) {
  const base = String(baseHref || '/').endsWith('/') ? baseHref : `${baseHref}/`;
  const CS = CAROUSEL_SKIP_SELECTOR.replace(/'/g, "\\'");
  const baseTag = includeBase ? `<base href="${base}">` : '';
  // Keep text/media visible. Leave AOS/Framer transforms alone so the animation
  // runtime can replay entrances. Skip only aria-hidden inactive carousel layers.
  return `${baseTag}<style id="__clonyfy_visibility_css__">html,body,#__next,#root{opacity:1!important;visibility:visible!important}html.js,html.no-js,body.preload,body.loading,body.no-js{opacity:1!important;visibility:visible!important}[data-clonyfy-stack-hidden],[data-clonyfy-stack-hidden] *{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}.opacity-0${UI},[class*="opacity-0"]:not([aria-hidden="true"]):not([data-clonyfy-anim]):not([data-clonyfy-stack-hidden])${UI}{opacity:1!important;visibility:visible!important}[data-aos]:not([aria-hidden="true"]):not([data-clonyfy-stack-hidden]),[style*="opacity:0"]:not([aria-hidden="true"]):not([data-clonyfy-anim]):not([data-clonyfy-stack-hidden])${UI},[style*="opacity: 0"]:not([aria-hidden="true"]):not([data-clonyfy-anim]):not([data-clonyfy-stack-hidden])${UI}{opacity:1;visibility:visible}img${UI},picture${UI},video${UI},source${UI}{opacity:1!important;visibility:visible!important}[data-clonyfy-ui-off]{opacity:0!important;visibility:hidden!important;pointer-events:none!important}.hero-section-container,.hero-section__layout{isolation:auto!important}.hero-section__background,.hero-wave-animation,.hero-wave-animation__layout,.hero-wave-animation__contents{z-index:1!important;pointer-events:none!important}.hero-section__title--background,.hero-section__title--foreground,.hero-section__actions,[class*="title--foreground"],[class*="title--background"]{position:relative!important;z-index:3!important}.hero-section__title--foreground,[class*="title--foreground"]{display:block!important;visibility:visible!important;opacity:1!important;mix-blend-mode:hard-light!important;color:rgba(0,14,255,.5)!important}.hero-section__title--foreground .hero-section__title-main{color:#2d2564!important}.hero-section__title--foreground .hero-section__title-copy{color:rgba(0,14,255,.55)!important}.hero-section__title--background .hero-section__title-main{color:#061b31!important}.hero-section__title--background .hero-section__title-copy{color:#81b81a!important}.hero-logo-wall-section,.hero-logo-section{position:relative!important;z-index:2!important}.hero-wave-animation img[data-clonyfy-canvas-capture]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;object-fit:contain!important;object-position:70% center!important}</style><script id="__clonyfy_visibility_script__">(function(){var CS='${CS}';function shouldResetTransform(t){if(!t||t==='none')return false;if(/translateY\\([^)]*-?\\d{2,}/.test(t))return true;if(/translate3d\\([^)]*,\\s*-?\\d{2,}/.test(t))return true;return false;}function isHeroBlend(el){try{var cls=String(el&&el.className||'');if(/title--foreground|title--background|hero-section__title/i.test(cls))return true;var cs=window.getComputedStyle(el);if(cs.mixBlendMode&&cs.mixBlendMode!=='normal')return true;}catch(e){}return false;}function isInactiveLayer(el){try{if(el.getAttribute&&el.getAttribute('data-clonyfy-stack-hidden'))return true;if(el.closest&&el.closest('[data-clonyfy-stack-hidden],[data-clonyfy-ui-hidden],[data-clonyfy-ui-off]'))return true;if(isHeroBlend(el))return false;if(el.getAttribute&&el.getAttribute('aria-hidden')==='true')return true;if(el.closest&&el.closest('[aria-hidden="true"]')&&!el.closest('.hero-section__title--foreground,[class*="title--foreground"]'))return true;}catch(e){}return false;}function hasLiveMotion(el){try{var cs=window.getComputedStyle(el);var name=String(cs.animationName||'');if(name&&name!=='none'){var play=String(cs.animationPlayState||'');if(play!=='paused')return true;}var cls=String(el.className||'');if(/\\b(marquee|ticker|ken-burns|kenburns)\\b/i.test(cls))return true;if(el.closest&&el.closest('.marquee-inner,[class*="marquee"],[class*="ticker"]'))return true;if(el.hasAttribute&&(el.hasAttribute('data-aos')||el.hasAttribute('data-clonyfy-anim')||el.hasAttribute('data-framer-appear-id')))return true;}catch(e){}return false;}function revealLazyMedia(){try{document.querySelectorAll('img[loading="lazy"],source[loading="lazy"]').forEach(function(img){try{img.loading='eager';if(img.dataset&&img.dataset.src&&!img.getAttribute('src'))img.src=img.dataset.src;}catch(e){}});document.querySelectorAll('img,picture,video').forEach(function(el){try{if(isInactiveLayer(el))return;var cs=window.getComputedStyle(el);if(cs.opacity==='0'||parseFloat(cs.opacity)<0.05)el.style.setProperty('opacity','1','important');if(cs.visibility==='hidden')el.style.setProperty('visibility','visible','important');var p=el.parentElement;for(var i=0;p&&i<6;i++,p=p.parentElement){if(p.closest&&p.closest(CS))break;if(isInactiveLayer(p))break;var pcs=window.getComputedStyle(p);if(pcs.opacity==='0'||parseFloat(pcs.opacity)<0.05)p.style.setProperty('opacity','1','important');if(pcs.visibility==='hidden')p.style.setProperty('visibility','visible','important');}}catch(e){}});}catch(e){}}var UI_HINT=/(?:^|[\\s_-])(?:drop-?down|mega-?menu|sub-?menu|fly-?out|pop-?over|pop-?up|modal|drawer|backdrop|overlay|tooltip|off-?canvas|lightbox|dialog|search-results?)(?=[\\s_-]|$)/i;function alphaOf(c){c=String(c||'');if(!c||c==='transparent')return 0;var m=/\\/\\s*([\\d.]+)(%)?\\s*\\)$/.exec(c);if(m)return m[2]?parseFloat(m[1])/100:parseFloat(m[1]);m=/^rgba\\(([^)]+)\\)$/.exec(c);if(m){var p=m[1].split(',');if(p.length===4)return parseFloat(p[3]);}return 1;}function uiOff(el){el.setAttribute('data-clonyfy-ui-off','1');el.style.setProperty('opacity','0','important');el.style.setProperty('visibility','hidden','important');el.style.setProperty('pointer-events','none','important');}function shown(cs){return cs.display!=='none'&&cs.visibility!=='hidden'&&parseFloat(cs.opacity)>=0.05;}var CONTENT_TAGS=/^(IMG|SVG|VIDEO|CANVAS|IFRAME|PICTURE|INPUT|BUTTON|A|SELECT|TEXTAREA)$/;function ownText(n){for(var c=n.firstChild;c;c=c.nextSibling){if(c.nodeType===3&&/\\S/.test(c.nodeValue||''))return true;}return false;}function showsContent(el,vw,vh){if(ownText(el))return true;var ns=el.getElementsByTagName('*');if(ns.length>400)return true;for(var i=0;i<ns.length;i++){var n=ns[i];if(!CONTENT_TAGS.test(String(n.tagName).toUpperCase())&&!ownText(n))continue;var r=n.getBoundingClientRect();if(r.width<1||r.height<1||r.bottom<=0||r.top>=vh||r.right<=0||r.left>=vw)continue;var cs=getComputedStyle(n);if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)<0.05)continue;return true;}return false;}function isStrayBackdrop(el,cs,vw,vh){if(!shown(cs))return false;var z=parseInt(cs.zIndex,10);if(!isNaN(z)&&z<0)return false;var hint=String(typeof el.className==='string'?el.className:'')+' '+(el.id||'');if(!(z>=1)&&!UI_HINT.test(hint))return false;if(cs.backgroundImage&&cs.backgroundImage!=='none')return false;var a=alphaOf(cs.backgroundColor),o=parseFloat(cs.opacity);var bf=cs.backdropFilter||cs.webkitBackdropFilter||'none';if(!((a>0.05&&a<0.98)||(a>=0.98&&o<0.98)||(a<=0.05&&bf!=='none')))return false;var r=el.getBoundingClientRect();if(r.width<vw*0.85)return false;if(cs.position==='fixed'){if(Math.min(r.bottom,vh)-Math.max(r.top,0)<vh*0.5)return false;}else{if(r.height<vh*0.8)return false;var op=el.offsetParent;if(!op||op===document.body||op===document.documentElement)return false;if(r.bottom-op.getBoundingClientRect().bottom<vh*0.5)return false;}if(showsContent(el,vw,vh))return false;var par=el.parentElement;if(par&&par!==document.body){var pcs=getComputedStyle(par);if(pcs.backgroundImage&&pcs.backgroundImage!=='none')return false;var ms=par.querySelectorAll('video,img,canvas,picture');for(var i=0;i<ms.length&&i<40;i++){var mr=ms[i].getBoundingClientRect();if(mr.width>=vw*0.5&&mr.height>=vh*0.4)return false;}}return true;}function hideStrayUiLayers(){try{if(!document.body||window.__clonyfyLiveScripts)return;var vw=window.innerWidth,vh=window.innerHeight;if(!vw||!vh)return;document.querySelectorAll('[aria-expanded="false"][aria-controls]').forEach(function(t){var tr=t.getBoundingClientRect();if(tr.width<1||tr.height<1)return;String(t.getAttribute('aria-controls')||'').split(/\\s+/).forEach(function(id){if(!id)return;var p=document.getElementById(id);if(!p||p.contains(t)||p.closest('[data-clonyfy-ui],[data-clonyfy-ui-hidden],[data-clonyfy-ui-off]'))return;var cs=getComputedStyle(p);if(!shown(cs))return;if(cs.position!=='absolute'&&cs.position!=='fixed')return;uiOff(p);});});var all=document.body.getElementsByTagName('*');for(var i=0;i<all.length;i++){var el=all[i];if(el.hasAttribute('data-clonyfy-ui-off')||el.hasAttribute('data-clonyfy-ui-hidden'))continue;var cs=getComputedStyle(el);if(cs.position!=='fixed'&&cs.position!=='absolute')continue;if(el.closest('[data-clonyfy-ui],[data-clonyfy-ui-off],[data-clonyfy-ui-hidden],[data-clonyfy-stack-hidden]'))continue;if(isStrayBackdrop(el,cs,vw,vh))uiOff(el);}}catch(e){}}function reveal(){try{hideStrayUiLayers();revealLazyMedia();document.querySelectorAll('[style*="opacity:0"],[style*="opacity: 0"],.opacity-0,[class*="opacity-0"],.invisible').forEach(function(el){if(el.classList&&el.classList.contains('clonyfy-reveal'))return;if(el.hasAttribute&&el.hasAttribute('data-clonyfy-anim'))return;if(isInactiveLayer(el))return;if(el.closest&&el.closest(CS))return;var r=el.getBoundingClientRect();if(r.width<2||r.height<2)return;if(el.classList){el.classList.remove('opacity-0','invisible');for(var i=el.classList.length-1;i>=0;i--){var c=el.classList[i];if(/^translate-y-(?:\\d+|full)$/.test(c)||/^delay-\\d+$/.test(c))el.classList.remove(c);}}el.style.setProperty('opacity','1','important');el.style.setProperty('visibility','visible','important');});document.querySelectorAll('[data-aos],[data-framer-appear-id]').forEach(function(el){if(isInactiveLayer(el))return;if(el.closest&&el.closest(CS))return;el.classList.add('aos-animate');if(parseFloat(getComputedStyle(el).opacity)<0.05)el.style.opacity='1';});document.querySelectorAll('[style*="visibility:hidden"],[style*="visibility: hidden"]').forEach(function(el){if(el.hasAttribute&&el.hasAttribute('data-clonyfy-anim'))return;if(isInactiveLayer(el))return;if(el.closest&&el.closest(CS))return;var r=el.getBoundingClientRect();if(r.width>=2&&r.height>=2)el.style.visibility='visible';});document.querySelectorAll('video').forEach(function(v){try{v.setAttribute('playsinline','');v.setAttribute('muted','');v.muted=true;if(v.getAttribute('autoplay')!==null){var p=v.play();if(p&&p.catch)p.catch(function(){});}}catch(e){}});document.querySelectorAll('[style*="transform"]').forEach(function(el){if(el.classList&&el.classList.contains('clonyfy-reveal'))return;if(el.closest&&el.closest(CS))return;if(isInactiveLayer(el))return;if(hasLiveMotion(el))return;var t=el.style.transform;if(shouldResetTransform(t))el.style.transform='none';});}catch(e){}}try{var h=document.documentElement;['loading','no-js','is-loading','preload'].forEach(function(c){h.classList.remove(c)});h.classList.add('js','clonyfy-preview');reveal();document.addEventListener('DOMContentLoaded',reveal);window.addEventListener('load',reveal);setTimeout(reveal,400);setTimeout(reveal,1200);setTimeout(reveal,2800);${carouselFixInlineScript()}}catch(e){}})();</script>`;
}

/** Legacy hook — animation replay is always injected via clonePreviewRuntime. */
export function buildScrollAnimationsPatchHtml() {
  return '';
}
