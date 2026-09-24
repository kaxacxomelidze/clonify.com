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
  it('caps query variants per path but not plain paths', () => {
    const limiter = createQueryVariantLimiter(2);
    expect(limiter.allow('https://a.com/p?x=1')).toBe(true);
    expect(limiter.allow('https://a.com/p?x=2')).toBe(true);
    expect(limiter.allow('https://a.com/p?x=3')).toBe(false);
    expect(limiter.allow('https://a.com/other')).toBe(true);
    expect(limiter.allow('https://a.com/other2')).toBe(true);
    expect(limiter.allow('https://a.com/other3')).toBe(true);
  });
});
