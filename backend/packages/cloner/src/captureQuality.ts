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
  if (
    /Application Error/i.test(text)
    && /page could not be displayed|Something has gone wrong|This page could not be found/i.test(text)
    && text.length < 800
  ) {
    return true;
  }

  return false;
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
