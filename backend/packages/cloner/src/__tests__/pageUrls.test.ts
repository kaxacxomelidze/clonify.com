import { describe, expect, it } from 'vitest';
import { normalizePageUrl } from '../pageUrls.js';
import { createQueryVariantLimiter } from '../crawler.js';

describe('normalizePageUrl crawler-trap hardening', () => {
  it('decodes &amp; in raw href attributes', () => {
    expect(normalizePageUrl('/blog.php?cat=a&amp;cur=USD', 'https://leader.med/'))
      .toBe('https://leader.med/blog.php?cat=a&cur=USD');
  });

  it('collapses double-escaped amp; keys and repeated params (last wins)', () => {
    const trap = 'https://leader.med/blog.php?cat=automation&amp;amp%3Bamp%3Bcur=EUR&amp;amp%3Bcur=GEL&amp;cur=USD';
    expect(normalizePageUrl(trap)).toBe('https://leader.med/blog.php?cat=automation&cur=USD');
  });

  it('keeps ordinary query strings byte-for-byte', () => {
    expect(normalizePageUrl('https://a.com/p?x=1%20&y=b')).toBe('https://a.com/p?x=1%20&y=b');
  });

  it('rejects absurdly long URLs', () => {
    expect(normalizePageUrl(`https://a.com/p?q=${'x'.repeat(600)}`)).toBeNull();
  });
});

describe('createQueryVariantLimiter', () => {
  it('allows one URL per path (query variants overwrite the same route)', () => {
    const limiter = createQueryVariantLimiter();
    expect(limiter.allow('https://a.com/')).toBe(true);
    expect(limiter.allow('https://a.com/?cur=GEL')).toBe(false);
    expect(limiter.allow('https://a.com/blog.php?cat=a')).toBe(true);
    expect(limiter.allow('https://a.com/blog.php?cat=b')).toBe(false);
    expect(limiter.allow('https://a.com/clinic/login.php')).toBe(true);
  });

  it('honours a higher limit', () => {
    const limiter = createQueryVariantLimiter(2);
    expect(limiter.allow('https://a.com/p?x=1')).toBe(true);
    expect(limiter.allow('https://a.com/p?x=2')).toBe(true);
    expect(limiter.allow('https://a.com/p?x=3')).toBe(false);
  });
});

describe('findScriptBuiltContainers', () => {
  it('finds empty containers that inline scripts fill', async () => {
    const { findScriptBuiltContainers } = await import('../capture.js');
    const html = `<div class="sgf-cc" data-sgf-cc="country"></div><ul id="menu"> </ul><div id="static"></div>
      <script>document.querySelectorAll('[data-sgf-cc]').forEach(build); document.getElementById('menu')</script>
      <script src="/x.js"></script>`;
    expect(findScriptBuiltContainers(html)).toEqual(['div[data-sgf-cc="country"]', '[id="menu"]']);
  });

  it('ignores pages without inline scripts', async () => {
    const { findScriptBuiltContainers } = await import('../capture.js');
    expect(findScriptBuiltContainers('<div id="a"></div><script src="a.js"></script>')).toEqual([]);
  });
});
