import { describe, expect, it } from 'vitest';
import {
  isFrameworkErrorHtml,
  isThinSpaShell,
  normalizePathname,
  pathnameOfUrl,
  pathnamesMatch,
  shouldReplaceCapturedHtml,
} from '../captureQuality.js';

describe('normalizePathname / pathnamesMatch', () => {
  it('treats trailing slash and index.html as the same route', () => {
    expect(pathnamesMatch('/apps', '/apps/')).toBe(true);
    expect(pathnamesMatch('/apps/', '/apps/index.html')).toBe(true);
    expect(pathnamesMatch('/', '/index.html')).toBe(true);
  });

  it('distinguishes different product pages', () => {
    expect(pathnamesMatch('/apps', '/')).toBe(false);
    expect(pathnamesMatch('/apps', '/payments')).toBe(false);
  });

  it('reads pathnames from full URLs', () => {
    expect(pathnameOfUrl('https://stripe.com/apps?x=1')).toBe('/apps');
    expect(normalizePathname('/Payments/')).toBe('/payments');
  });
});

describe('isFrameworkErrorHtml', () => {
  it('flags the Next.js client-side crash page (griffin.com)', () => {
    const html = '<html><body><div id="__next"><div><h2>Application error: a client-side exception has occurred (see the browser console for more information).</h2></div></div><script src="/_assets/a.js"></script></body></html>';
    expect(isFrameworkErrorHtml(html)).toBe(true);
    expect(isThinSpaShell(html)).toBe(true);
  });

  it('does not flag real pages that mention errors in long copy', () => {
    const copy = 'Banking for businesses. '.repeat(60) + 'Application error handling is built in.';
    expect(isFrameworkErrorHtml(`<html><body><main>${copy}</main></body></html>`)).toBe(false);
  });
});

describe('isThinSpaShell', () => {
  it('flags empty Next.js roots', () => {
    expect(isThinSpaShell('<!doctype html><html><body><div id="__next"></div></body></html>')).toBe(true);
    expect(isThinSpaShell('<html><body><div id="root"></div><script src="/app.js"></script></body></html>')).toBe(true);
  });

  it('accepts real page content', () => {
    const html = `<!doctype html><html><body><div id="__next">
      <main><h1>Stripe Apps</h1><p>Build apps on Stripe with our platform toolkit and partner program.</p>
      <p>More marketing copy so this is clearly not an empty shell document for capture.</p>
      </main></div></body></html>`;
    expect(isThinSpaShell(html)).toBe(false);
  });

  it('flags short application error boundaries', () => {
    expect(
      isThinSpaShell(
        '<html><body><h1>Application Error</h1><p>Something has gone wrong and this page could not be displayed.</p></body></html>',
      ),
    ).toBe(true);
  });
});

describe('shouldReplaceCapturedHtml', () => {
  const rich = `<!doctype html><html><body><div id="__next"><h1>Apps</h1><p>${'content '.repeat(40)}</p></div></body></html>`;
  const shell = '<!doctype html><html><body><div id="__next"></div></body></html>';

  it('does not overwrite a good page with a shell', () => {
    expect(shouldReplaceCapturedHtml(rich, shell)).toBe(false);
  });

  it('replaces a shell with a real page', () => {
    expect(shouldReplaceCapturedHtml(shell, rich)).toBe(true);
  });
});
