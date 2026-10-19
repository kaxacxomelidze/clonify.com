/**
 * Strip everything account-scoped from a capture BEFORE it leaves the browser.
 * Only the public, front-end layer may be sent: the rendered page, its server HTML, its
 * static files and the public responses it rendered from. Never cookies, auth headers,
 * tokens, storage or form secrets. Mirrors backend/packages/cloner/src/helperSanitize.ts
 * (the server strips again and refuses bundles that still carry any).
 */

export const SENSITIVE_HEADER = /^(cookie|set-cookie|set-cookie2|authorization|proxy-authorization|www-authenticate|x-(?:csrf|xsrf)-token|x-auth[\w-]*|x-api-key|x-access-token|x-amz-security-token)$/i;

export const SENSITIVE_KEY = /^(?:access[_-]?token|refresh[_-]?token|id[_-]?token|auth[_-]?token|token|auth|authorization|session|session[_-]?id|sessionid|sid|jsessionid|phpsessid|cookie|cookies|set[_-]?cookie|password|passwd|pwd|secret|client[_-]?secret|api[_-]?key|apikey|csrf|csrf[_-]?token|xsrf|xsrf[_-]?token|_csrf|authenticity[_-]?token|jwt|bearer|credentials?|localstorage|sessionstorage)$/i;

const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi;
const REMOVED = '[removed]';

function scrubText(text) {
  return String(text).replace(JWT, REMOVED).replace(BEARER, REMOVED);
}

export function scrubUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return scrubText(String(raw || '')); }
  u.username = '';
  u.password = '';
  for (const key of [...u.searchParams.keys()]) {
    if (SENSITIVE_KEY.test(key)) u.searchParams.delete(key);
  }
  return scrubText(u.toString());
}

function scrubJson(value, depth = 0) {
  if (depth > 40) return null;
  if (typeof value === 'string') return scrubText(value);
  if (Array.isArray(value)) return value.map((v) => scrubJson(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(k) || SENSITIVE_HEADER.test(k)) continue;
      out[k] = scrubJson(v, depth + 1);
    }
    return out;
  }
  return value;
}

function scrubBody(body, contentType) {
  if (body == null) return null;
  const text = String(body);
  if (/json/i.test(contentType) || /^\s*[[{]/.test(text)) {
    try { return JSON.stringify(scrubJson(JSON.parse(text))); } catch { /* not JSON */ }
  }
  return scrubText(text);
}

export function scrubHtml(html) {
  let out = String(html || '');
  out = out.replace(/<meta\b[^>]*\bname\s*=\s*["']?(?:csrf[-_]?token|csrf[-_]?param|xsrf[-_]?token|_csrf)["']?[^>]*>/gi, '');
  out = out.replace(/<input\b[^>]*>/gi, (tag) => {
    const type = ((tag.match(/\btype\s*=\s*["']?([\w-]+)/i) || [])[1] || '').toLowerCase();
    const name = (tag.match(/\bname\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '';
    const sensitive = type === 'password' || (type === 'hidden' && (SENSITIVE_KEY.test(name) || /token|csrf|xsrf|session|auth/i.test(name)));
    return sensitive ? tag.replace(/\svalue\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, '') : tag;
  });
  return scrubText(out);
}

/** Whitelisted fields only, every credential removed. */
export function sanitizeBundle(input) {
  const b = input && typeof input === 'object' ? input : {};
  const str = (v) => (typeof v === 'string' ? v : '');
  const pages = scrubPages(b.pages);
  return {
    v: 1,
    url: scrubUrl(str(b.url)),
    title: str(b.title).slice(0, 300),
    capturedAt: str(b.capturedAt).slice(0, 40),
    serverHtml: scrubHtml(str(b.serverHtml)),
    domSnapshot: scrubHtml(str(b.domSnapshot)),
    assets: (Array.isArray(b.assets) ? b.assets : [])
      .filter((a) => a && typeof a.url === 'string')
      .map((a) => {
        const asset = { url: scrubUrl(a.url), contentType: str(a.contentType).slice(0, 120) };
        if (typeof a.data === 'string' && a.data) asset.data = a.data;
        return asset;
      }),
    networkRecord: scrubNetwork(b.networkRecord),
    pages: pages.length ? pages : (b.domSnapshot ? [{
      url: scrubUrl(str(b.url)),
      title: str(b.title).slice(0, 300),
      serverHtml: scrubHtml(str(b.serverHtml)),
      domSnapshot: scrubHtml(str(b.domSnapshot)),
      networkRecord: scrubNetwork(b.networkRecord),
    }] : []),
  };
}

const MAX_PAGES = 60;

function scrubNetwork(list) {
  const str = (v) => (typeof v === 'string' ? v : '');
  return (Array.isArray(list) ? list : [])
    .filter((n) => n && typeof n.url === 'string' && String(n.method || 'GET').toUpperCase() === 'GET')
    .map((n) => {
      const contentType = str(n.contentType).slice(0, 120);
      return { method: 'GET', url: scrubUrl(n.url), status: Number(n.status) || 0, contentType, body: scrubBody(typeof n.body === 'string' ? n.body : null, contentType) };
    });
}

function scrubPages(list) {
  const str = (v) => (typeof v === 'string' ? v : '');
  return (Array.isArray(list) ? list : [])
    .filter((p) => p && typeof p.url === 'string')
    .slice(0, MAX_PAGES)
    .map((p) => ({
      url: scrubUrl(p.url),
      title: str(p.title).slice(0, 300),
      serverHtml: scrubHtml(str(p.serverHtml)),
      domSnapshot: scrubHtml(str(p.domSnapshot)),
      networkRecord: scrubNetwork(p.networkRecord),
    }));
}
