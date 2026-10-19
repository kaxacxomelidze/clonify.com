import { describe, expect, it } from 'vitest';
import { findCredentialLeaks, sanitizeHelperBundle } from '../helperSanitize.js';

const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

/** A bundle carrying every kind of credential a careless capture could pick up. */
function dirtyBundle() {
  return {
    v: 1,
    url: `https://www.example.com/homes?access_token=abc123&page=2&sid=s9`,
    title: 'Homes',
    serverHtml: `<html><head><meta name="csrf-token" content="tok-1"></head><body><script>window.__T="${JWT}"</script></body></html>`,
    domSnapshot: `<html><head><meta name="csrf-token" content="tok-1"></head><body>`
      + `<form><input type="password" name="pw" value="hunter2"><input type="hidden" name="authenticity_token" value="xyz">`
      + `<input type="text" name="q" value="seattle"></form><p>Bearer abcdefghijklmnopqrstuvwx</p>${'<p>Listing</p>'.repeat(30)}</body></html>`,
    // Fields that must never travel at all.
    cookies: [{ name: 'session', value: 'secret' }],
    localStorage: { token: 'x' },
    sessionStorage: { auth: 'y' },
    requestHeaders: { Authorization: 'Bearer abcdefghijklmnopqrstuvwxyz', Cookie: 'a=b' },
    assets: [
      { url: 'https://cdn.example.com/app.css?v=3', contentType: 'text/css', data: Buffer.from('body{}').toString('base64'), headers: { 'set-cookie': 'a=b' } },
      { url: 'https://cdn.example.com/photo.jpg?token=leak&w=400', contentType: 'image/jpeg' },
    ],
    networkRecord: [
      {
        method: 'GET',
        url: 'https://www.example.com/api/search?api_key=k1&q=seattle',
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [{ id: 1, price: 500000 }], session: { id: 's' }, user: { access_token: 'at', email: 'a@b.c', refreshToken: 'rt' }, note: `Bearer abcdefghijklmnopqrstuvwxyz` }),
        responseHeaders: { 'Set-Cookie': 'sid=1; HttpOnly' },
        requestHeaders: { authorization: 'Bearer x', 'x-csrf-token': 't' },
      },
      { method: 'POST', url: 'https://www.example.com/api/login', status: 200, contentType: 'application/json', body: '{"password":"hunter2"}', postData: 'password=hunter2' },
      { method: 'GET', url: 'https://www.example.com/api/config', status: 200, contentType: 'text/plain', body: `jwt=${JWT}` },
    ],
  };
}

describe('Clonyfy Helper bundle stripping', () => {
  it('the test bundle really does carry credentials (the check below is meaningful)', () => {
    expect(findCredentialLeaks(dirtyBundle()).length).toBeGreaterThan(10);
  });

  it('leaves no Set-Cookie, Authorization, cookie, token or storage data', () => {
    const clean = sanitizeHelperBundle(dirtyBundle());
    expect(findCredentialLeaks(clean)).toEqual([]);
    const text = JSON.stringify(clean);
    for (const needle of ['Set-Cookie', 'set-cookie', 'Authorization', 'authorization', 'hunter2', 'access_token', 'api_key',
      'refreshToken', 'authenticity_token" value', 'tok-1', 'csrf-token', JWT, 'localStorage', 'sessionStorage', 'cookies', 'Cookie']) {
      expect(text, `"${needle}" survived`).not.toContain(needle);
    }
  });

  it('drops requests that sent data (logins, form posts) and keeps only GET responses', () => {
    const clean = sanitizeHelperBundle(dirtyBundle());
    expect(clean.networkRecord.map((n) => n.method)).toEqual(['GET', 'GET']);
    expect(clean.networkRecord.some((n) => n.url.includes('/api/login'))).toBe(false);
  });

  it('keeps the public page: content, public data, assets and harmless query parameters', () => {
    const clean = sanitizeHelperBundle(dirtyBundle());
    expect(clean.domSnapshot).toContain('<p>Listing</p>');
    expect(clean.domSnapshot).toContain('value="seattle"');
    expect(clean.url).toBe('https://www.example.com/homes?page=2');
    expect(clean.assets[0]).toEqual({ url: 'https://cdn.example.com/app.css?v=3', contentType: 'text/css', data: Buffer.from('body{}').toString('base64') });
    expect(clean.assets[1]!.url).toBe('https://cdn.example.com/photo.jpg?w=400');
    const search = JSON.parse(clean.networkRecord[0]!.body!);
    expect(search.results).toEqual([{ id: 1, price: 500000 }]);
    expect(search.user).toEqual({ email: 'a@b.c' });
    expect(clean.networkRecord[0]!.url).toBe('https://www.example.com/api/search?q=seattle');
  });
});

describe('Clonyfy Helper extension stripping (what runs in the user browser)', () => {
  it('leaves no credential, and matches the server-side stripping exactly', async () => {
    // @ts-expect-error — plain JS module shipped in the extension
    const { sanitizeBundle } = await import('../../../../../extension/sanitize.js');
    const fromExtension = sanitizeBundle(dirtyBundle());
    expect(findCredentialLeaks(fromExtension)).toEqual([]);
    expect(fromExtension).toEqual(sanitizeHelperBundle(dirtyBundle()));
  });
});

describe('Clonyfy Helper multi-page bundles', () => {
  const multi = () => {
    const b = dirtyBundle();
    return {
      ...b,
      pages: [
        { url: b.url, title: 'Homes', serverHtml: b.serverHtml, domSnapshot: b.domSnapshot, networkRecord: b.networkRecord, cookies: 'x=1' },
        { url: 'https://www.example.com/rent?session=abc', title: 'Rent', serverHtml: '<meta name="csrf-token" content="t2">', domSnapshot: `<input type="password" value="hunter2">${'<p>Rentals</p>'.repeat(30)}`,
          networkRecord: [{ method: 'GET', url: 'https://www.example.com/api/rentals?token=t', status: 200, contentType: 'application/json', body: '{"items":[1],"auth":{"jwt":"x"}}', responseHeaders: { 'set-cookie': 'a' } }] },
      ],
    };
  };

  it('strips credentials from every page, on the server and in the extension alike', async () => {
    expect(findCredentialLeaks(multi()).length).toBeGreaterThan(10);
    const clean = sanitizeHelperBundle(multi());
    expect(findCredentialLeaks(clean)).toEqual([]);
    expect(clean.pages.map((p) => p.url)).toEqual(['https://www.example.com/homes?page=2', 'https://www.example.com/rent']);
    expect(clean.pages[1]!.domSnapshot).toContain('<p>Rentals</p>');
    expect(JSON.parse(clean.pages[1]!.networkRecord[0]!.body!)).toEqual({ items: [1] });
    // @ts-expect-error — plain JS module shipped in the extension
    const { sanitizeBundle } = await import('../../../../../extension/sanitize.js');
    expect(sanitizeBundle(multi())).toEqual(clean);
  });

  it('a one-page bundle (older helper) still yields its page', () => {
    const clean = sanitizeHelperBundle(dirtyBundle());
    expect(clean.pages).toHaveLength(1);
    expect(clean.pages[0]!.domSnapshot).toContain('<p>Listing</p>');
  });
});
