/**
 * Where a clone really starts: the address the site sends visitors to. A domain that
 * redirects to another one (lovable.com → lovable.dev, example.com → www.example.com,
 * http → https) is cloned as the site it redirects to — otherwise every page and file
 * of the real site counts as "another site" and the clone breaks.
 */
import { safeFetch } from './ssrfGuard.js';
import { CLONYFY_USER_AGENT } from './userAgent.js';

export const REDIRECT_MARKER = '[REDIRECT]';

/** Sign-in / account pages on another domain are not "the site" (SSO, consent walls). */
const SIGN_IN_PATH = /\/(log-?in|sign-?in|sign-?up|auth|oauth2?|sso|accounts?|session|cas)(\/|$|\?)/i;
const META_REFRESH = /<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["']?\s*(\d+)\s*;\s*url=([^"'>\s]+)/i;

function isWebUrl(u: URL): boolean {
  return u.protocol === 'http:' || u.protocol === 'https:';
}

/**
 * Follow the start URL's redirects (HTTP 301/302/303/307/308 and an immediate
 * `<meta http-equiv="refresh">`). Returns the final URL when it is on another site;
 * the original URL otherwise (same-site path redirects behave as before), or when the
 * site can't be reached here (the browser crawl reports that itself).
 */
export async function resolveStartUrl(url: string, timeoutMs = 15_000): Promise<{ url: string; from?: string }> {
  let start: URL;
  try { start = new URL(url); } catch { return { url }; }
  let finalUrl = start.href;
  try {
    const res = await safeFetch(start.href, {
      headers: { 'User-Agent': CLONYFY_USER_AGENT, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    finalUrl = res.url || finalUrl;
    // An instant client-side redirect page (common on parked / legacy domains).
    if (res.ok && /html/i.test(res.headers.get('content-type') || '')) {
      const head = (await res.text().catch(() => '')).slice(0, 64_000);
      const m = head.match(META_REFRESH);
      if (m && Number(m[1]) <= 3) {
        try { finalUrl = new URL(m[2]!.replace(/&amp;/g, '&'), finalUrl).href; } catch { /* keep */ }
      }
    } else {
      await res.body?.cancel().catch(() => {});
    }
  } catch {
    return { url: start.href };
  }
  let end: URL;
  try { end = new URL(finalUrl); } catch { return { url: start.href }; }
  if (!isWebUrl(end) || end.origin === start.origin) return { url: start.href };
  if (SIGN_IN_PATH.test(end.pathname + end.search)) return { url: start.href };
  end.hash = '';
  return { url: end.href, from: start.href };
}
