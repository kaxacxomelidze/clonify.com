import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockedAddressError, isPrivateIp, isPublicUrl, safeFetch } from '../ssrfGuard.js';

describe('isPrivateIp', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.20.0.2', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:172.20.0.4',
  ])('blocks %s', (ip) => expect(isPrivateIp(ip)).toBe(true));

  it.each(['8.8.8.8', '49.12.145.162', '2606:4700::1111'])('allows %s', (ip) =>
    expect(isPrivateIp(ip)).toBe(false));
});

describe('isPublicUrl', () => {
  it.each([
    'http://127.0.0.1/', 'http://2130706433/', 'http://0x7f.0.0.1/', 'http://127.1/',
    'http://[::1]/', 'http://169.254.169.254/latest/meta-data/', 'http://localhost:5000/',
    'http://backend:5000/api/health', 'http://clonify-postgres:5432/', 'http://foo.internal/',
    'file:///etc/passwd', 'gopher://example.com/',
  ])('rejects %s', async (url) => expect(await isPublicUrl(url)).toBe(false));

  it('allows data: URLs and public IP literals', async () => {
    expect(await isPublicUrl('data:text/plain,hi')).toBe(true);
    expect(await isPublicUrl('https://8.8.8.8/')).toBe(true);
  });
});

describe('safeFetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  const redirect = (location: string, status = 302) =>
    new Response(null, { status, headers: { location } });

  it('refuses a private start URL without making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(safeFetch('http://127.0.0.1:5000/')).rejects.toBeInstanceOf(BlockedAddressError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a redirect hop into a private address', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(redirect('http://169.254.169.254/latest/meta-data/'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(safeFetch('http://8.8.8.8/start')).rejects.toBeInstanceOf(BlockedAddressError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('follows public redirects and returns the final response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(redirect('/next', 301))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await safeFetch('http://8.8.8.8/start');
    expect(await res.text()).toBe('ok');
    expect(fetchMock.mock.calls[1][0]).toBe('http://8.8.8.8/next');
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
  });

  it('turns a 303 into a GET without a body', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(redirect('http://8.8.4.4/done', 303))
      .mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    await safeFetch('http://8.8.8.8/form', { method: 'POST', body: 'x=1' });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'GET', body: undefined });
  });
});
