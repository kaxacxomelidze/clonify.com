/**
 * Capture quality gates — keep wrong/empty HTML out of route-map entries.
 * Pure helpers (no Playwright) so unit tests can cover enterprise fidelity rules.
 */

/** Normalize a pathname for equality checks (trailing slash, index.html, case). */
export function normalizePathname(pathname: string): string {
  let p = String(pathname || '/').trim() || '/';
  try { p = decodeURIComponent(p); } catch { /* keep raw */ }
  p = p.replace(/\/index\.html?$/i, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  if (p === '/index') p = '/';
  return p.toLowerCase() || '/';
}

export function pathnamesMatch(a: string, b: string): boolean {
  return normalizePathname(a) === normalizePathname(b);
}

/** Pathname from a full URL (or path) for drift checks. */
export function pathnameOfUrl(url: string): string {
  try {
    if (/^https?:\/\//i.test(url)) return new URL(url).pathname || '/';
    if (url.startsWith('/')) return url.split(/[?#]/)[0] || '/';
    return new URL(url, 'https://example.invalid').pathname || '/';
  } catch {
    return '/';
  }
}

/**
 * Detect thin SPA shells / soft-404 documents that look like HTML but have no
 * real page content. Preview neutralizes site JS, so these stay blank forever.
 */
export function isThinSpaShell(html: string): boolean {
  const raw = String(html || '');
  if (!raw) return true;

  const withoutNoise = raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  if (/<div\s+id=["'](?:__next|root|app|__nuxt)["']\s*>\s*<\/div>/i.test(withoutNoise)) {
    return true;
  }

  const text = withoutNoise
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const hasSpaRoot = /id=["'](?:__next|root|app|__nuxt)["']/i.test(raw);
  // Almost no readable copy — typical unhydrated Next/React shell.
  if (text.length < 120 && hasSpaRoot) return true;
  if (text.length < 40 && raw.length < 12_000) return true;

  // Soft framework error pages sometimes sneak into captures.
  if (isFrameworkErrorText(text)) return true;

  return false;
}

/**
 * Next.js / Remix / Shopify error boundaries that replace the page when client JS
 * crashes, e.g. Next's "Application error: a client-side exception has occurred".
 */
export function isFrameworkErrorText(text: string): boolean {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length >= 800) return false;
  if (/Application error: a (client|server)-side exception has occurred/i.test(t)) return true;
  return /Application Error/i.test(t)
    && /page could not be displayed|Something has gone wrong|This page could not be found/i.test(t);
}

export function isFrameworkErrorHtml(html: string): boolean {
  const raw = String(html || '');
  if (/<html[^>]*\bid=["']__next_error__["']/i.test(raw)) return true;
  const text = raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return isFrameworkErrorText(text);
}

/**
 * Same check inside the browser via `page.evaluate(fn)` — must stay self-contained.
 */
export function isFrameworkErrorPageInDocument(): boolean {
  if (document.documentElement?.id === '__next_error__') return true;
  if (document.getElementById('__next_error__')) return true;
  const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
  if (text.length >= 800) return false;
  if (/This page could not( be found| load|)/i.test(text) && text.length < 400) return true;
  if (/Application error: a (client|server)-side exception has occurred/i.test(text)) return true;
  return /Application Error/i.test(text)
    && /page could not be displayed|Something has gone wrong/i.test(text);
}

/**
 * Prefer keeping an existing capture when a later write for the same route is
 * thinner (query-variant race / failed re-capture).
 */
export function shouldReplaceCapturedHtml(existing: string, candidate: string): boolean {
  if (!existing) return true;
  if (!candidate) return false;
  const existingShell = isThinSpaShell(existing);
  const candidateShell = isThinSpaShell(candidate);
  if (existingShell && !candidateShell) return true;
  if (!existingShell && candidateShell) return false;
  // Prefer the richer document when both pass (or both fail) the shell check.
  return candidate.length >= existing.length * 0.85;
}
