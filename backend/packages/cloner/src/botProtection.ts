/**
 * Recognize bot-protection challenge responses (Cloudflare, DataDome, PerimeterX,
 * Akamai, Imperva…). These sites deliberately refuse automated browsers; retrying or
 * falling back to a plain fetch cannot succeed, so the clone should stop early with an
 * honest explanation instead of a generic "captured 0 pages".
 *
 * Detection only — Clonyfy does not attempt to bypass these protections.
 */

export class BotProtectionError extends Error {
  readonly vendor: string;
  constructor(vendor: string, status: number) {
    super(`Blocked by ${vendor} bot protection (HTTP ${status})`);
    this.name = 'BotProtectionError';
    this.vendor = vendor;
  }
}

const BLOCK_STATUSES = new Set([401, 403, 429, 503]);

/** Returns the protection vendor name when a response is a bot challenge/block page. */
export function detectBotProtection(
  status: number,
  headers: Record<string, string>,
  body: string,
): string | null {
  const h = (name: string) => String(headers[name] ?? headers[name.toLowerCase()] ?? '').toLowerCase();
  const html = String(body || '').slice(0, 60_000);

  // Cloudflare marks managed challenges explicitly, even on 200s.
  if (h('cf-mitigated') === 'challenge') return 'Cloudflare';
  if (!BLOCK_STATUSES.has(status)) return null;

  if (
    h('server').includes('cloudflare')
    && (/cdn-cgi\/challenge-platform|_cf_chl_opt|cf-browser-verification|Just a moment\.\.\./i.test(html) || h('cf-ray'))
  ) {
    return 'Cloudflare';
  }
  if (/captcha-delivery\.com|datadome/i.test(html) || h('x-datadome') || h('server').includes('datadome')) return 'DataDome';
  if (/px-captcha|perimeterx|_pxhd/i.test(html)) return 'PerimeterX (HUMAN)';
  if (/_Incapsula_Resource|incapsula|imperva/i.test(html) || h('x-iinfo')) return 'Imperva';
  if (h('server').includes('akamaighost') && /Access Denied/i.test(html)) return 'Akamai';
  if (/<title>\s*(Attention Required|Access denied|Just a moment)/i.test(html)) return 'bot protection';
  return null;
}

/** Bot-protection findings per site origin for the current run (read by runClone). */
const findings = new Map<string, string>();

export function noteBotProtection(url: string, vendor: string) {
  try { findings.set(new URL(url).origin, vendor); } catch { /* ignore */ }
}

export function takeBotProtection(url: string): string | null {
  try {
    const origin = new URL(url).origin;
    const vendor = findings.get(origin) ?? null;
    findings.delete(origin);
    return vendor;
  } catch {
    return null;
  }
}

export function botProtectionMessage(url: string, vendor: string) {
  let host = url;
  try { host = new URL(url).hostname; } catch { /* keep raw */ }
  return `${host} is protected by ${vendor}, which blocks automated browsers — so it can't be cloned. `
    + 'This is the site owner\'s security setting, not a temporary error: retrying or changing the robots.txt option won\'t help. '
    + 'If you own this site, clone it from a staging or preview URL that isn\'t behind the bot check, or allow-list the cloning server in your protection settings.';
}
