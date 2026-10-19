/**
 * Clonyfy Helper bundles: what the browser extension captured in the user's own tab.
 *
 * Only the public, front-end layer may leave the browser (and reach this server): the
 * rendered page, its server HTML, its static files, and the public responses the page
 * rendered from. Never cookies, auth headers, tokens, storage or account data. The
 * extension strips these before sending (extension/sanitize.js); the server strips again
 * here and refuses a bundle that still carries any (see findCredentialLeaks).
 */

export interface HelperAsset {
  url: string;
  contentType: string;
  /** base64 bytes read in the user's tab; absent → the server downloads the public file. */
  data?: string;
}

export interface HelperNetworkEntry {
  method: string;
  url: string;
  status: number;
  contentType: string;
  body: string | null;
}

/** One captured page (the helper follows links up to the clone's page budget). */
export interface HelperPage {
  url: string;
  title?: string;
  serverHtml: string;
  domSnapshot: string;
  networkRecord: HelperNetworkEntry[];
}

export interface HelperBundle {
  v: 1;
  /** The page as loaded in the tab (after redirects). */
  url: string;
  title?: string;
  capturedAt?: string;
  /** Main document response as the site served it — what its own JS hydrates. */
  serverHtml: string;
  /** document.documentElement.outerHTML after load + hydration + settle. */
  domSnapshot: string;
  assets: HelperAsset[];
  networkRecord: HelperNetworkEntry[];
  /** Every captured page, the first one being the page above. Files are shared in `assets`. */
  pages: HelperPage[];
}

/** Header names that carry credentials or session state. */
export const SENSITIVE_HEADER = /^(cookie|set-cookie|set-cookie2|authorization|proxy-authorization|www-authenticate|x-(?:csrf|xsrf)-token|x-auth[\w-]*|x-api-key|x-access-token|x-amz-security-token)$/i;

/** Object keys / query parameters / form fields that carry credentials. */
export const SENSITIVE_KEY = /^(?:access[_-]?token|refresh[_-]?token|id[_-]?token|auth[_-]?token|token|auth|authorization|session|session[_-]?id|sessionid|sid|jsessionid|phpsessid|cookie|cookies|set[_-]?cookie|password|passwd|pwd|secret|client[_-]?secret|api[_-]?key|apikey|csrf|csrf[_-]?token|xsrf|xsrf[_-]?token|_csrf|authenticity[_-]?token|jwt|bearer|credentials?|localstorage|sessionstorage)$/i;

/** A JSON Web Token anywhere in text. */
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
/** "Bearer <token>" anywhere in text. */
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi;

const REMOVED = '[removed]';

function scrubText(text: string): string {
  return text.replace(JWT, REMOVED).replace(BEARER, REMOVED);
}

/** Drop credential query parameters from a URL (public CDN signatures stay). */
export function scrubUrl(raw: string): string {
  let u: URL;
  try { u = new URL(raw); } catch { return scrubText(String(raw || '')); }
  u.username = '';
  u.password = '';
  for (const key of [...u.searchParams.keys()]) {
    if (SENSITIVE_KEY.test(key)) u.searchParams.delete(key);
  }
  return scrubText(u.toString());
}

function scrubJson(value: unknown, depth = 0): unknown {
  if (depth > 40) return null;
  if (typeof value === 'string') return scrubText(value);
  if (Array.isArray(value)) return value.map((v) => scrubJson(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(k) || SENSITIVE_HEADER.test(k)) continue;
      out[k] = scrubJson(v, depth + 1);
    }
    return out;
  }
  return value;
}

function scrubBody(body: string | null, contentType: string): string | null {
  if (body == null) return null;
  const text = String(body);
  if (/json/i.test(contentType) || /^\s*[[{]/.test(text)) {
    try { return JSON.stringify(scrubJson(JSON.parse(text))); } catch { /* not JSON */ }
  }
  return scrubText(text);
}

/** Remove credential-bearing markup from captured HTML (CSRF metas, secret form values, tokens). */
export function scrubHtml(html: string): string {
  let out = String(html || '');
  // <meta name="csrf-token" content="…">
  out = out.replace(/<meta\b[^>]*\bname\s*=\s*["']?(?:csrf[-_]?token|csrf[-_]?param|xsrf[-_]?token|_csrf)["']?[^>]*>/gi, '');
  // Password fields and hidden credential fields keep their markup but lose the value.
  out = out.replace(/<input\b[^>]*>/gi, (tag) => {
    const type = (tag.match(/\btype\s*=\s*["']?([\w-]+)/i)?.[1] || '').toLowerCase();
    const name = tag.match(/\bname\s*=\s*["']?([^"'\s>]+)/i)?.[1] || '';
    const sensitive = type === 'password' || (type === 'hidden' && (SENSITIVE_KEY.test(name) || /token|csrf|xsrf|session|auth/i.test(name)));
    return sensitive ? tag.replace(/\svalue\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, '') : tag;
  });
  return scrubText(out);
}

/**
 * Keep only the fields a bundle may carry, with every credential removed. Unknown
 * fields (cookies, storage, headers…) are dropped by construction.
 */
export function sanitizeHelperBundle(input: unknown): HelperBundle {
  const b = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const assets = Array.isArray(b.assets) ? b.assets : [];
  const network = Array.isArray(b.networkRecord) ? b.networkRecord : [];
  const pages = scrubPages(Array.isArray(b.pages) ? b.pages : []);
  return {
    v: 1,
    url: scrubUrl(str(b.url)),
    title: str(b.title).slice(0, 300),
    capturedAt: str(b.capturedAt).slice(0, 40),
    serverHtml: scrubHtml(str(b.serverHtml)),
    domSnapshot: scrubHtml(str(b.domSnapshot)),
    assets: assets
      .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object' && typeof (a as { url?: unknown }).url === 'string')
      .map((a) => {
        const asset: HelperAsset = { url: scrubUrl(str(a.url)), contentType: str(a.contentType).slice(0, 120) };
        if (typeof a.data === 'string' && a.data) asset.data = a.data;
        return asset;
      }),
    networkRecord: scrubNetwork(network),
    pages: pages.length ? pages : (b.domSnapshot ? [{
      url: scrubUrl(str(b.url)),
      title: str(b.title).slice(0, 300),
      serverHtml: scrubHtml(str(b.serverHtml)),
      domSnapshot: scrubHtml(str(b.domSnapshot)),
      networkRecord: scrubNetwork(network),
    }] : []),
  };
}

const MAX_PAGES = 60;

function scrubNetwork(list: unknown[]): HelperNetworkEntry[] {
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return list
    .filter((n): n is Record<string, unknown> => !!n && typeof n === 'object' && typeof (n as { url?: unknown }).url === 'string')
    // Only what the page READ: request bodies (form posts, logins) never leave the browser.
    .filter((n) => String(n.method || 'GET').toUpperCase() === 'GET')
    .map((n) => {
      const contentType = str(n.contentType).slice(0, 120);
      return {
        method: 'GET',
        url: scrubUrl(str(n.url)),
        status: Number(n.status) || 0,
        contentType,
        body: scrubBody(typeof n.body === 'string' ? n.body : null, contentType),
      };
    });
}

function scrubPages(list: unknown[]): HelperPage[] {
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return list
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object' && typeof (p as { url?: unknown }).url === 'string')
    .slice(0, MAX_PAGES)
    .map((p) => ({
      url: scrubUrl(str(p.url)),
      title: str(p.title).slice(0, 300),
      serverHtml: scrubHtml(str(p.serverHtml)),
      domSnapshot: scrubHtml(str(p.domSnapshot)),
      networkRecord: scrubNetwork(Array.isArray(p.networkRecord) ? p.networkRecord : []),
    }));
}

/**
 * Every place a credential could survive in a bundle — empty means clean. The server
 * refuses bundles with leaks; the unit test proves sanitizeHelperBundle leaves none.
 */
export function findCredentialLeaks(input: unknown): string[] {
  const leaks: string[] = [];
  const walk = (value: unknown, path: string, depth: number) => {
    if (depth > 60) return;
    if (typeof value === 'string') {
      if (new RegExp(JWT.source).test(value)) leaks.push(`${path}: JSON Web Token`);
      if (new RegExp(BEARER.source, 'i').test(value)) leaks.push(`${path}: Bearer token`);
      if (/^https?:\/\//i.test(value)) {
        try {
          for (const key of new URL(value).searchParams.keys()) {
            if (SENSITIVE_KEY.test(key)) leaks.push(`${path}: query parameter "${key}"`);
          }
        } catch { /* not a URL */ }
      }
      // JSON bodies are checked by key, like objects.
      if (/^\s*[[{]/.test(value)) {
        try { walk(JSON.parse(value), `${path}<json>`, depth + 1); } catch { /* not JSON */ }
      }
      if (/<meta\b[^>]*name\s*=\s*["']?csrf/i.test(value)) leaks.push(`${path}: CSRF meta tag`);
      if (/<input\b[^>]*type\s*=\s*["']?password[^>]*\svalue\s*=\s*["']?[^"'\s>]/i.test(value)) leaks.push(`${path}: password field value`);
      return;
    }
    if (Array.isArray(value)) { value.forEach((v, i) => walk(v, `${path}[${i}]`, depth + 1)); return; }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (SENSITIVE_HEADER.test(k) || SENSITIVE_KEY.test(k)) leaks.push(`${path}.${k}: credential field`);
        // Base64 file bytes are opaque content, not credentials.
        if (k === 'data' && /assets\[\d+\]$/.test(path)) continue;
        walk(v, `${path}.${k}`, depth + 1);
      }
    }
  };
  walk(input, 'bundle', 0);
  return leaks;
}
