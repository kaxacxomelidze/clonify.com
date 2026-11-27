import { describe, it, expect } from 'vitest';
import { bakeStaticMediaVisibility, stripRevealClasses } from '../capture.js';

describe('bakeStaticMediaVisibility — Save As level', () => {
  it('strips opacity-0 utility classes and injects visibility bake CSS', () => {
    const html = `<html><head></head><body><h1 class="opacity-0 translate-y-4">Hello</h1><img loading="lazy" src="https://cdn.example.com/a.jpg"></body></html>`;
    const out = bakeStaticMediaVisibility(html);
    expect(out).toContain('clonyfy-static-media-bake');
    expect(out).toContain('loading="eager"');
    expect(out).not.toMatch(/class="[^"]*\bopacity-0\b/);
    expect(out).toContain('Hello');
    expect(out).toMatch(/img:not\(\[data-clonyfy-ui-hidden\]\)[^{]*,picture[^{]*,video[^{]*,source[^{]*\{opacity:1/);
  });

  it('is idempotent', () => {
    const html = `<html><head></head><body><p class="opacity-0">Text</p></body></html>`;
    const once = bakeStaticMediaVisibility(html);
    const twice = bakeStaticMediaVisibility(once);
    expect(twice).toBe(once);
  });

  it('keeps menus, backdrops and modals hidden (nuts.com grey screen)', () => {
    const html = `<html><head></head><body>`
      + `<div class="dropdown-overlay invisible fixed inset-0 bg-black bg-opacity-60 opacity-0" data-clonyfy-ui-hidden="1"></div>`
      + `<section class="opacity-0 translate-y-8">Reveal me</section></body></html>`;
    const out = bakeStaticMediaVisibility(html);
    expect(out).toContain('class="dropdown-overlay invisible fixed inset-0 bg-black bg-opacity-60 opacity-0" data-clonyfy-ui-hidden="1"');
    expect(out).toContain('<section class="">Reveal me</section>');
    // Every rule that forces hidden content visible skips marked layers.
    const css = out.match(/<style id="clonyfy-static-media-bake">([\s\S]*?)<\/style>/)![1];
    for (const rule of css.split('}').filter((r) => /\.opacity-0|\.invisible|\[style\*="(?:opacity|visibility)/.test(r))) {
      expect(rule).toContain(':not([data-clonyfy-ui-hidden] *)');
    }
  });
});

describe('stripRevealClasses', () => {
  it('removes whole reveal tokens only, keeping variant states', () => {
    const html = `<div class="opacity-0 lg:invisible [&.is-open]:translate-y-0 -translate-y-1/2 delay-300 group-hover:opacity-0">x</div>`;
    expect(stripRevealClasses(html)).toBe(`<div class="lg:invisible [&.is-open]:translate-y-0 -translate-y-1/2 group-hover:opacity-0">x</div>`);
  });

  it('handles `>` inside quoted Tailwind values', () => {
    const html = `<a class="[&>svg]:size-4 invisible" href="/x">y</a>`;
    expect(stripRevealClasses(html)).toBe(`<a class="[&>svg]:size-4" href="/x">y</a>`);
  });
});
