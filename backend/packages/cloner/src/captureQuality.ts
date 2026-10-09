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

/** Framework hydration payloads that the app reads at startup. */
const HYDRATION_MARKER = /\$_TSR|__remixContext|__staticRouterHydrationData|__reactRouterContext|window\.__NUXT__|__APOLLO_STATE__|__INITIAL_STATE__|__PRELOADED_STATE__|self\.__next_f|__sveltekit/;
const SELF_REMOVE = /currentScript\??\.remove\(\)|currentScript\??\.parentNode\??\.removeChild|\.remove\(\)/;

/**
 * SSR frameworks (TanStack Start, Remix, streaming React…) ship their hydration data
 * in inline scripts that delete themselves after running, so a post-load snapshot
 * lacks them and the app crashes when the clone runs its JS again. Re-add inline
 * scripts from the server HTML that are missing from the snapshot and either remove
 * themselves or carry hydration data — in their original order, at the top of <body>.
 */
export function restoreSelfRemovingScripts(snapshotHtml: string, serverHtml: string): string {
  const snapshot = String(snapshotHtml || '');
  const server = String(serverHtml || '');
  if (!snapshot || !server) return snapshot;
  const restored: string[] = [];
  for (const m of server.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] || '';
    const body = (m[2] || '').trim();
    if (!body || /\bsrc\s*=/i.test(attrs)) continue;
    if (/\btype\s*=\s*["']?(?:application\/(?:ld\+)?json|importmap|speculationrules)/i.test(attrs)) continue;
    if (!SELF_REMOVE.test(body) && !HYDRATION_MARKER.test(body)) continue;
    if (snapshot.includes(body.slice(0, 160))) continue; // still present — nothing to restore
    restored.push(`<script${attrs} data-clonyfy-restored-ssr>${m[2]}</script>`);
  }
  if (!restored.length) return snapshot;
  const bodyOpen = snapshot.match(/<body\b[^>]*>/i);
  if (!bodyOpen || bodyOpen.index === undefined) return restored.join('') + snapshot;
  const at = bodyOpen.index + bodyOpen[0].length;
  return snapshot.slice(0, at) + restored.join('') + snapshot.slice(at);
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
