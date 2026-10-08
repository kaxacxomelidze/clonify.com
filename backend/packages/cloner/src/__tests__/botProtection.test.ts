import { describe, expect, it } from 'vitest';
import { botProtectionMessage, detectBotProtection, noteBotProtection, takeBotProtection } from '../botProtection.js';

describe('detectBotProtection', () => {
  it('recognizes a Cloudflare managed challenge', () => {
    const html = '<html><head><title>Just a moment...</title></head><body><script src="/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1"></script></body></html>';
    expect(detectBotProtection(403, { server: 'cloudflare', 'cf-ray': 'a475f8973e39b015-FRA' }, html)).toBe('Cloudflare');
    expect(detectBotProtection(200, { 'cf-mitigated': 'challenge' }, '')).toBe('Cloudflare');
  });

  it('recognizes other vendors', () => {
    expect(detectBotProtection(403, {}, '<script src="https://ct.captcha-delivery.com/c.js"></script>')).toBe('DataDome');
    expect(detectBotProtection(403, {}, '<div id="px-captcha"></div>')).toBe('PerimeterX (HUMAN)');
  });

  it('ignores ordinary errors and normal pages', () => {
    expect(detectBotProtection(404, { server: 'cloudflare' }, '<h1>Not found</h1>')).toBeNull();
    expect(detectBotProtection(403, { server: 'nginx' }, '<h1>Forbidden</h1>')).toBeNull();
    expect(detectBotProtection(200, { server: 'cloudflare' }, '<title>Home</title>')).toBeNull();
  });
});

describe('bot protection findings', () => {
  it('is reported once per origin with an actionable message', () => {
    noteBotProtection('https://lovable.com/', 'Cloudflare');
    expect(takeBotProtection('https://lovable.com')).toBe('Cloudflare');
    expect(takeBotProtection('https://lovable.com')).toBeNull();
    const msg = botProtectionMessage('https://lovable.com/', 'Cloudflare');
    expect(msg).toContain('lovable.com is protected by Cloudflare');
    expect(msg).not.toMatch(/uncheck/i);
  });
});
