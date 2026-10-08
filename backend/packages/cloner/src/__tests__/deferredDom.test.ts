import { describe, expect, it } from 'vitest';
import { applyDeferredDomEdits } from '../deferredDom.js';

describe('applyDeferredDomEdits', () => {
  it('replaces a tagged canvas with its captured frames image', () => {
    const html = '<!DOCTYPE html><html><head></head><body><div class="band"><canvas aria-hidden="true" data-clonyfy-defer="c1"></canvas></div></body></html>';
    const out = applyDeferredDomEdits(html, {
      c1: { mode: 'replace', html: '<img src="/_assets/a.png" data-clonyfy-canvas-frames="[&quot;/_assets/a.png&quot;,&quot;/_assets/b.png&quot;]">' },
    });
    expect(out).not.toContain('<canvas');
    expect(out).toContain('<div class="band"><img src="/_assets/a.png"');
    expect(out).toContain('data-clonyfy-canvas-frames');
    expect(out.startsWith('<!DOCTYPE html>')).toBe(true);
  });

  it('replaces only the children for shell captures and drops the marker', () => {
    const html = '<html><body><div id="s" data-clonyfy-defer="s1"><span>lottie</span></div></body></html>';
    const out = applyDeferredDomEdits(html, { s1: { mode: 'children', html: '<img src="/_assets/s.png">' } });
    expect(out).toContain('<div id="s"><img src="/_assets/s.png"></div>');
    expect(out).not.toContain('data-clonyfy-defer');
  });

  it('empties script-built containers', () => {
    const html = '<html><body><ul id="w" data-clonyfy-defer="w1"><li>built by js</li></ul></body></html>';
    const out = applyDeferredDomEdits(html, { w1: { mode: 'children', html: '' } });
    expect(out).toContain('<ul id="w"></ul>');
  });

  it('strips stray markers when the edit is missing and leaves other HTML untouched', () => {
    const html = '<html><body><canvas data-clonyfy-defer="gone"></canvas></body></html>';
    expect(applyDeferredDomEdits(html, { other: { mode: 'replace', html: '' } })).toBe('<html><body><canvas></canvas></body></html>');
    expect(applyDeferredDomEdits('<p>x</p>', {})).toBe('<p>x</p>');
  });
});
