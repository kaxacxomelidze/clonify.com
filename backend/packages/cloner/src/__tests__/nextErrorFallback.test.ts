import { describe, expect, it } from 'vitest';
import { serverHtmlHasContent, stripNextRuntimeScripts } from '../capture.js';

const body = '<main><h1>Griffin</h1><p>' + 'Banking as a service. '.repeat(20) + '</p></main>';

describe('serverHtmlHasContent', () => {
  it('accepts real server-rendered pages', () =>
    expect(serverHtmlHasContent(`<html><body>${body}</body></html>`)).toBe(true));
  it('rejects the Next.js client-side exception screen', () =>
    expect(serverHtmlHasContent('<html id="__next_error__"><body>Application error: a client-side exception has occurred</body></html>')).toBe(false));
  it('rejects empty shells', () =>
    expect(serverHtmlHasContent('<html><body><div id="__next"></div><script>var a=1</script></body></html>')).toBe(false));
});

describe('stripNextRuntimeScripts', () => {
  const html = `<html><head>
<link rel="preload" as="script" href="/_next/static/chunks/main-abc.js">
<link rel="stylesheet" href="/_next/static/css/app.css">
<script src="/_next/static/chunks/webpack-1.js" async=""></script>
<script src="https://www.googletagmanager.com/gtm.js"></script>
</head><body>${body}
<script>self.__next_f.push([1,"payload"])</script>
<script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>
<script>window.dataLayer=[]</script>
</body></html>`;
  const out = stripNextRuntimeScripts(html);

  it('removes Next.js chunks, flight data and preloads', () => {
    expect(out).not.toContain('webpack-1.js');
    expect(out).not.toContain('__next_f');
    expect(out).not.toContain('__NEXT_DATA__');
    expect(out).not.toContain('main-abc.js');
  });
  it('keeps content, stylesheets and unrelated scripts', () => {
    expect(out).toContain('Banking as a service.');
    expect(out).toContain('/_next/static/css/app.css');
    expect(out).toContain('gtm.js');
    expect(out).toContain('window.dataLayer=[]');
  });
});
