// Whop payments: checkout creation, membership management and webhook verification.
// API reference: https://docs.whop.com/api-reference (v1, bearer auth).
import { createHmac, timingSafeEqual } from 'crypto';

const WHOP_API_BASE = (process.env.WHOP_API_BASE || 'https://api.whop.com/api/v1').replace(/\/+$/, '');
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

const PLAN_ENV = {
  starter: { monthly: 'WHOP_PLAN_STARTER_MONTHLY', annual: 'WHOP_PLAN_STARTER_ANNUAL' },
  growth: { monthly: 'WHOP_PLAN_GROWTH_MONTHLY', annual: 'WHOP_PLAN_GROWTH_ANNUAL' },
  unlimited: { monthly: 'WHOP_PLAN_SCALE_MONTHLY', annual: 'WHOP_PLAN_SCALE_ANNUAL' },
};

export function whopApiKey() {
  return String(process.env.WHOP_API_KEY || '').trim();
}

export function whopWebhookSecret() {
  return String(process.env.WHOP_WEBHOOK_SECRET || '').trim();
}

/** Whop plan id (plan_xxx) for one of our plans + billing interval, or '' when not configured. */
export function whopPlanId(plan, interval = 'monthly') {
  const envName = PLAN_ENV[plan]?.[interval === 'annual' ? 'annual' : 'monthly'];
  return envName ? String(process.env[envName] || '').trim() : '';
}

/**
 * Retired plan ids that existing memberships may still renew on, as
 * "plan_x:starter,plan_y:growth:annual" (interval defaults to monthly).
 */
function legacyWhopPlans() {
  return String(process.env.WHOP_LEGACY_PLANS || '')
    .split(',')
    .map((entry) => entry.trim().split(':'))
    .filter(([id, plan]) => id && PLAN_ENV[plan]);
}

/** Reverse lookup: which of our plans/intervals a Whop plan id belongs to. */
export function planFromWhopPlanId(whopPlan) {
  const id = String(whopPlan || '').trim();
  if (!id) return null;
  for (const [plan, intervals] of Object.entries(PLAN_ENV)) {
    for (const [interval, envName] of Object.entries(intervals)) {
      if (String(process.env[envName] || '').trim() === id) return { plan, interval };
    }
  }
  for (const [legacyId, plan, interval] of legacyWhopPlans()) {
    if (legacyId === id) return { plan, interval: interval === 'annual' ? 'annual' : 'monthly' };
  }
  return null;
}

/** Human-readable reason Whop checkout can't run, or '' when it can. */
export function whopUnavailableReason(plan = null, interval = 'monthly') {
  if (!whopApiKey()) return 'Whop is not configured (WHOP_API_KEY missing).';
  if (plan && !whopPlanId(plan, interval)) return `No Whop plan is set up for ${plan} (${interval}).`;
  return '';
}

export function whopConfigured() {
  return !!whopApiKey() && Object.keys(PLAN_ENV).some((p) => whopPlanId(p, 'monthly') || whopPlanId(p, 'annual'));
}

async function whopRequest(method, path, body) {
  const key = whopApiKey();
  if (!key) throw new Error('Whop is not configured');
  const res = await fetch(`${WHOP_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || text.slice(0, 200) || res.statusText;
    const err = new Error(`Whop API ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function absoluteWhopUrl(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://whop.com${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Creates a hosted checkout for an existing Whop plan. Returns { id, url }. */
export async function createWhopCheckout({ planId, metadata, redirectUrl }) {
  const data = await whopRequest('POST', '/checkout_configurations', {
    mode: 'payment',
    plan_id: planId,
    metadata,
    redirect_url: redirectUrl,
  });
  const url = absoluteWhopUrl(data?.purchase_url);
  if (!url) throw new Error('Whop did not return a checkout URL');
  return { id: data.id, url };
}

export function retrieveWhopMembership(membershipId) {
  return whopRequest('GET', `/memberships/${encodeURIComponent(membershipId)}`);
}

/** Most recent memberships (newest first) — used to match a just-finished checkout. */
export async function listRecentWhopMemberships(limit = 50) {
  const data = await whopRequest('GET', `/memberships?first=${limit}&order=created_at&direction=desc`);
  return Array.isArray(data?.data) ? data.data : [];
}

let accountIdPromise = null;
/** The biz_ account this API key belongs to (list endpoints need it). */
export function whopAccountId() {
  if (process.env.WHOP_ACCOUNT_ID) return Promise.resolve(process.env.WHOP_ACCOUNT_ID);
  accountIdPromise ??= whopRequest('GET', '/accounts/me')
    .then((a) => a?.id)
    .catch((err) => { accountIdPromise = null; throw err; });
  return accountIdPromise;
}

/** Most recent payments (newest first), with their status and checkout id. */
export async function listRecentWhopPayments(limit = 50) {
  const accountId = await whopAccountId();
  const data = await whopRequest('GET', `/payments?account_id=${encodeURIComponent(accountId)}&first=${limit}`);
  return Array.isArray(data?.data) ? data.data : [];
}

export function retrieveWhopPayment(paymentId) {
  return whopRequest('GET', `/payments/${encodeURIComponent(paymentId)}`);
}

export function cancelWhopMembership(membershipId, mode = 'at_period_end') {
  return whopRequest('POST', `/memberships/${encodeURIComponent(membershipId)}/cancel`, {
    cancellation_mode: mode,
  });
}

export function whopManageUrl(membership) {
  return absoluteWhopUrl(membership?.manage_url) || 'https://whop.com/@me/settings/memberships/';
}

/**
 * Verifies a Whop webhook (Standard Webhooks: HMAC-SHA256 over
 * `${webhook-id}.${webhook-timestamp}.${rawBody}`, keyed with the `ws_…` secret as-is).
 * Returns the parsed event or throws.
 */
export function verifyWhopWebhook(rawBody, headers, secret = whopWebhookSecret(), nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret) throw new Error('Whop webhook secret not configured');
  const id = String(headers['webhook-id'] || '');
  const timestamp = String(headers['webhook-timestamp'] || '');
  const signatureHeader = String(headers['webhook-signature'] || '');
  if (!id || !timestamp || !signatureHeader) throw new Error('Missing webhook signature headers');
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error('Webhook timestamp outside tolerance');
  }
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const expected = createHmac('sha256', secret).update(`${id}.${timestamp}.${body}`).digest();
  // Header may hold several space-separated "v1,<base64>" signatures (secret rotation).
  const ok = signatureHeader.split(' ').some((part) => {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) return false;
    const given = Buffer.from(sig, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!ok) throw new Error('Invalid webhook signature');
  return { id, event: JSON.parse(body) };
}
