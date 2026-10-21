import { beforeEach, describe, expect, it, vi } from 'vitest';

// The network layer: a fake safeFetch that "lands" on a given final URL.
let landing: { url: string; status?: number; type?: string; html?: string } | Error;
vi.mock('../ssrfGuard.js', () => ({
  safeFetch: vi.fn(async () => {
    if (landing instanceof Error) throw landing;
    const { url, status = 200, type = 'text/html; charset=utf-8', html = '<html></html>' } = landing;
    return {
      url,
      status,
      ok: status >= 200 && status < 300,
      headers: new Headers({ 'content-type': type }),
      text: async () => html,
      body: null,
    };
  }),
}));

const { resolveStartUrl } = await import('../startUrl.js');

describe('resolveStartUrl', () => {
  beforeEach(() => { landing = { url: 'https://example.com/' }; });

  it('clones the site a domain redirects to (lovable.com → lovable.dev)', async () => {
    landing = { url: 'https://lovable.dev/' };
    expect(await resolveStartUrl('https://lovable.com/')).toEqual({ url: 'https://lovable.dev/', from: 'https://lovable.com/' });
  });

  it('follows bare → www and http → https', async () => {
    landing = { url: 'https://www.example.com/' };
    expect((await resolveStartUrl('http://example.com/')).url).toBe('https://www.example.com/');
  });

  it('keeps the start URL when the site is the same (path redirects behave as before)', async () => {
    landing = { url: 'https://example.com/en/' };
    expect(await resolveStartUrl('https://example.com/')).toEqual({ url: 'https://example.com/' });
  });

  it('does not clone a sign-in page on another domain', async () => {
    landing = { url: 'https://accounts.example-sso.com/login?next=%2F' };
    expect(await resolveStartUrl('https://app.example.com/')).toEqual({ url: 'https://app.example.com/' });
  });

  it('follows an instant meta-refresh redirect page', async () => {
    landing = { url: 'https://old-brand.com/', html: '<meta http-equiv="refresh" content="0; url=https://new-brand.com/">' };
    expect((await resolveStartUrl('https://old-brand.com/')).url).toBe('https://new-brand.com/');
  });

  it('ignores a slow meta refresh (a timed notice, not a redirect)', async () => {
    landing = { url: 'https://example.com/', html: '<meta http-equiv="refresh" content="30; url=https://other.com/">' };
    expect((await resolveStartUrl('https://example.com/')).url).toBe('https://example.com/');
  });

  it('follows the redirect even when the redirected site then refuses our request (blocked sites)', async () => {
    landing = { url: 'https://lovable.dev/', status: 403 };
    expect((await resolveStartUrl('https://lovable.com/')).url).toBe('https://lovable.dev/');
  });

  it('keeps the start URL when the site cannot be reached', async () => {
    landing = new Error('ECONNREFUSED');
    expect(await resolveStartUrl('https://down.example.com/')).toEqual({ url: 'https://down.example.com/' });
  });
});
