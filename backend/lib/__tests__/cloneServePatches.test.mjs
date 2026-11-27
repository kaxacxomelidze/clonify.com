import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  restoreUiLayerClasses,
  upgradeStaticBakeCss,
  bakeStaticMediaVisibilityHtml,
  stripRevealClasses,
  stripTrackingNoscript,
} from '../cloneServePatches.js';

// Original server markup (nuts.com shape) and the snapshot an older clone saved:
// the old strip removed `invisible`/`opacity-0` and cut variant tails.
const SERVER = `<html><body><header><nav class="relative">
<div class="dropdown-overlay pointer-events-none invisible absolute left-0 top-full z-[80] h-screen w-full bg-black bg-opacity-60 opacity-0" aria-hidden="true"></div>
<button class="js-cta pointer-events-none invisible absolute left-0 top-1/2 opacity-0">Shop</button>
</nav></header>
<div class="js-mobile-search-backdrop invisible fixed inset-0 z-[90] bg-black bg-opacity-60 opacity-0 [&.is-open]:visible [&.is-open]:translate-y-0"></div>
<main><h2 class="opacity-0 translate-y-8">Reveal on scroll</h2><img class="absolute opacity-0" src="/a.png"></main>
</body></html>`;
const OLD_CLONE = `<html><head><style id="clonyfy-static-media-bake">.opacity-0,[class*="opacity-0"]:not([aria-hidden="true"]){opacity:1!important;visibility:visible!important}
.invisible:not([aria-hidden="true"]){visibility:visible!important}
img,picture,video,source{opacity:1!important;visibility:visible!important}
img[hidden]{display:revert!important}</style></head><body><header><nav class="relative">
<div class="dropdown-overlay pointer-events-none absolute left-0 top-full z-[80] h-screen w-full bg-black bg-opacity-60" aria-hidden="true"></div>
<button class="js-cta pointer-events-none absolute left-0 top-1/2" style="opacity: 1 !important; visibility: visible !important;">Shop</button>
</nav></header>
<div class="js-mobile-search-backdrop fixed inset-0 z-[90] bg-black bg-opacity-60 [&amp;.is-open]:visible [&amp;.is-open]:"></div>
<main><h2 class="">Reveal on scroll</h2><img class="absolute" src="/a.png"></main>
</body></html>`;

test('restores the hiding classes of menu backdrops and buttons in old clones', () => {
  const out = restoreUiLayerClasses(OLD_CLONE, SERVER);
  assert.match(out, /class="dropdown-overlay pointer-events-none invisible absolute [^"]*opacity-0" aria-hidden="true" data-clonyfy-ui-hidden="1"/);
  assert.match(out, /class="js-mobile-search-backdrop invisible fixed [^"]*opacity-0 \[&amp;\.is-open\]:visible \[&amp;\.is-open\]:translate-y-0" data-clonyfy-ui-hidden="1"/);
  // The capture's forced reveal is dropped so the classes apply again.
  assert.match(out, /<button class="js-cta [^"]*invisible[^"]*" style="" data-clonyfy-ui-hidden="1">Shop<\/button>/);
  // Scroll-reveal content and a non-UI absolute image stay revealed.
  assert.match(out, /<h2 class="">Reveal on scroll<\/h2>/);
  assert.match(out, /<img class="absolute" src="\/a.png">/);
});

test('leaves layers alone that the site itself opened, and new clones', () => {
  const opened = OLD_CLONE.replace('style="opacity: 1 !important; visibility: visible !important;"', 'style="opacity: 1;"');
  assert.match(restoreUiLayerClasses(opened, SERVER), /<button class="js-cta pointer-events-none absolute left-0 top-1\/2" style="opacity: 1;">/);
  const fresh = `${OLD_CLONE}<i data-clonyfy-ui-hidden="1"></i>`;
  assert.equal(restoreUiLayerClasses(fresh, SERVER), fresh);
});

test('old bake CSS no longer forces marked layers visible', () => {
  const out = upgradeStaticBakeCss(OLD_CLONE);
  const css = out.match(/<style id="clonyfy-static-media-bake">([\s\S]*?)<\/style>/)[1];
  assert.match(css, /\.opacity-0:not\(\[data-clonyfy-ui-hidden\]\):not\(\[data-clonyfy-ui-hidden\] \*\),\[class\*="opacity-0"\]/);
  assert.match(css, /\.invisible:not\(\[aria-hidden="true"\]\):not\(\[data-clonyfy-ui-hidden\]\)/);
  assert.match(css, /img:not\(\[data-clonyfy-ui-hidden\]\)/);
  assert.match(css, /img\[hidden\]\{display:revert!important\}/);
  assert.equal(upgradeStaticBakeCss(out), out);
  assert.equal(bakeStaticMediaVisibilityHtml(OLD_CLONE), out);
});

test('strip keeps marked layers and variant states', () => {
  const html = '<div class="invisible fixed opacity-0" data-clonyfy-ui-hidden="1"></div><p class="opacity-0 lg:invisible [&>b]:x">t</p>';
  assert.equal(stripRevealClasses(html), '<div class="invisible fixed opacity-0" data-clonyfy-ui-hidden="1"></div><p class="lg:invisible [&>b]:x">t</p>');
});

test('editor drops tag-manager noscript frames and pixels, keeps image fallbacks', () => {
  const html = '<body><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-X" height="0"></iframe></noscript>'
    + '<noscript><img src="/hero.jpg" alt=""></noscript>'
    + '<noscript><img height="1" src="https://www.facebook.com/tr?id=1&ev=PageView"></noscript></body>';
  assert.equal(stripTrackingNoscript(html), '<body><noscript><img src="/hero.jpg" alt=""></noscript></body>');
});
