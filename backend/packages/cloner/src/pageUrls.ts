import { extname } from 'path';

const TRACKING_PARAM = /^(utm_|fbclid|gclid|msclkid|_ga|_gl|mc_eid|yclid|dclid|zanpid|igshid|twclid|li_fat_id|ttclid)/i;

const NON_PAGE_EXTS = new Set([
  '.7z', '.aac', '.avi', '.avif', '.bin', '.bmp', '.css', '.csv', '.doc', '.docx',
  '.eot', '.exe', '.gif', '.gz', '.ico', '.jpeg', '.jpg', '.js', '.json', '.map',
  '.mjs', '.mov', '.mp3', '.mp4', '.ogg', '.ogv', '.otf', '.pdf', '.png', '.ppt',
  '.pptx', '.rar', '.rss', '.svg', '.tar', '.tgz', '.ttf', '.txt', '.wav', '.webm',
  '.webp', '.woff', '.woff2', '.xls', '.xlsx', '.xml', '.zip',
]);

const PAGE_EXTS = new Set([
  '.asp', '.aspx', '.htm', '.html', '.jsp', '.php', '.shtml', '.xhtml',
]);

export const AUTH_PATH = /^\/(login|logout|signin|sign-in|sign-out|signout|register|signup|sign-up|forgot-password|reset-password|change-password|verify-email|confirm-email|auth|oauth|sso|account\/activate|account\/confirm)(\/|$|\?)/i;

export function stripTrackingParams(href: string): string {
  try {
    const u = new URL(href);
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) u.searchParams.delete(key);
    }
    return u.href;
  } catch {
    return href;
  }
}

/** Past this, a URL is almost always a crawler trap (query strings echoed back into links). */
const MAX_PAGE_URL_LENGTH = 512;
const MAX_QUERY_PARAMS = 12;

/** Decode the HTML entities that show up inside raw href attributes (`&amp;` etc.). */
export function decodeHtmlAttr(value: string): string {
  return String(value || '').replace(/&(?:amp|#0*38|#x0*26);/gi, '&')
    .replace(/&(?:quot|#0*34|#x0*22);/gi, '"')
    .replace(/&(?:apos|#0*39|#x0*27);/gi, "'")
    .replace(/&(?:lt|#0*60|#x0*3c);/gi, '<')
    .replace(/&(?:gt|#0*62|#x0*3e);/gi, '>');
}

/**
 * Collapse query strings that grow on every hop: keys mangled into `amp;cur`
 * by double-escaped `&amp;amp;` links, and repeated keys appended by
 * "current URL + &cur=X" switchers. Last value wins, like PHP/most servers.
 */
function collapseQuery(u: URL): void {
  if (!u.search) return;
  const merged = new Map<string, string>();
  let changed = false;
  for (const [rawKey, value] of u.searchParams) {
    const key = rawKey.replace(/^(?:amp;)+/i, '');
    if (key !== rawKey || !key || merged.has(key)) changed = true;
    if (!key) continue;
    merged.delete(key);
    merged.set(key, value);
  }
  // Leave untouched queries byte-for-byte so link rewriting still matches.
  if (!changed) return;
  u.search = '';
  for (const [key, value] of merged) u.searchParams.append(key, value);
}

export function normalizePageUrl(input: string, baseUrl?: string): string | null {
  const raw = decodeHtmlAttr(String(input || '').trim());
  if (!raw || raw.startsWith('#')) return null;
  if (/^(mailto|tel|sms|javascript|data|blob):/i.test(raw)) return null;

  try {
    const u = new URL(raw, baseUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname || ['http', 'https'].includes(u.hostname.toLowerCase())) return null;
    if (AUTH_PATH.test(u.pathname)) return null;

    u.hash = '';
    collapseQuery(u);
    if ([...u.searchParams.keys()].length > MAX_QUERY_PARAMS) return null;
    if (u.href.length > MAX_PAGE_URL_LENGTH) return null;
    if (u.pathname === '/index.html') {
      u.pathname = '/';
    } else if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }

    const ext = extname(u.pathname).toLowerCase();
    if (NON_PAGE_EXTS.has(ext) && !PAGE_EXTS.has(ext)) return null;
    return stripTrackingParams(u.href);
  } catch {
    return null;
  }
}

export function isLikelyPageUrl(input: string, baseUrl?: string): boolean {
  return normalizePageUrl(input, baseUrl) !== null;
}
