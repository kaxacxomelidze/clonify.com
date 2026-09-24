import { lookup } from 'dns/promises';

// SSRF guard for everything the cloner fetches. The API validates the clone
// target once, but a public page can still point subresources, redirects or
// crawled links at internal hosts (Docker services, 169.254.169.254, …), and a
// domain can re-resolve to a private IP after that first check.

const DNS_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_REDIRECTS = 10;
const dnsCache = new Map<string, { publicOnly: boolean; expires: number }>();

export class BlockedAddressError extends Error {
  constructor(url: string) {
    super(`Blocked request to a private or internal address: ${url}`);
    this.name = 'BlockedAddressError';
  }
}

export function isPrivateIp(ip: string): boolean {
  ip = String(ip || '').toLowerCase().trim().replace(/^\[|\]$/g, '');
  if (!ip) return true;
  if (ip.includes(':')) {
    if (ip === '::1' || ip === '::') return true;
    if (/^(fe[89ab]|fc|fd)/.test(ip)) return true;              // link-local, unique-local
    const mapped = ip.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);                    // IPv4-mapped / NAT64
    return false;
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const [a, b, c] = parts;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||                           // CGNAT
    (a === 169 && b === 254) ||                                     // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||                            // incl. Docker bridge networks
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224                                                        // multicast / reserved
  );
}

function isBlockedHostname(host: string): boolean {
  host = host.toLowerCase().replace(/\.$/, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (['.local', '.internal', '.lan', '.home', '.intranet', '.corp'].some((s) => host.endsWith(s))) return true;
  // Single-label names are Docker service names (backend, clonify-postgres, …), never public sites.
  return !host.includes('.') && !host.includes(':');
}

/** True when the URL may be fetched: http(s) to a host that resolves only to public IPs. */
export async function isPublicUrl(rawUrl: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol === 'data:' || url.protocol === 'blob:') return true; // no network involved
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  // WHATWG URL already normalises decimal/hex/short IPv4 forms (e.g. 2130706433 → 127.0.0.1).
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (/^[\d.]+$/.test(host) || host.includes(':')) return !isPrivateIp(host);
  if (isBlockedHostname(host)) return false;

  const cached = dnsCache.get(host);
  if (cached && cached.expires > Date.now()) return cached.publicOnly;
  let publicOnly = false;
  try {
    const addrs = await lookup(host, { all: true, verbatim: true });
    publicOnly = addrs.length > 0 && addrs.every(({ address }) => !isPrivateIp(address));
  } catch {
    publicOnly = false; // unresolvable: the request would fail anyway
  }
  dnsCache.set(host, { publicOnly, expires: Date.now() + DNS_CACHE_TTL_MS });
  return publicOnly;
}

/**
 * fetch() that refuses private/internal destinations and re-checks every
 * redirect hop instead of letting fetch follow them blindly.
 */
export async function safeFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  let url = String(input);
  let method = (init.method || 'GET').toUpperCase();
  let body = init.body;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isPublicUrl(url))) throw new BlockedAddressError(url);
    const res = await fetch(url, { ...init, method, body, redirect: 'manual' });
    const location = res.headers.get('location');
    if (![301, 302, 303, 307, 308].includes(res.status) || !location || init.redirect === 'manual') {
      return res;
    }
    await res.body?.cancel().catch(() => {});
    url = new URL(location, url).toString();
    if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === 'POST')) {
      method = 'GET';
      body = undefined;
    }
  }
  throw new Error(`Too many redirects: ${String(input)}`);
}
