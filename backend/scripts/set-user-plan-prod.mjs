/**
 * Set a user's plan on production (Supabase), not local Docker DB.
 *
 * Prefers PostgREST via SUPABASE_SERVICE_KEY; falls back to SUPABASE_DB_URL.
 * Scale → stored as unlimited.
 *
 * Usage: node scripts/set-user-plan-prod.mjs <email> [plan]
 * Loads credentials from .env.production only.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const email = String(process.argv[2] || '').trim().toLowerCase();
const requested = String(process.argv[3] || 'scale').trim().toLowerCase();
const PLAN_ALIASES = { scale: 'unlimited', enterprise: 'unlimited', pro: 'growth', popular: 'growth' };
const plan = PLAN_ALIASES[requested] || requested;

if (!email) {
  console.error('Usage: node scripts/set-user-plan-prod.mjs <email> [plan]');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(join(root, '.env.production'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const renews = new Date();
renews.setFullYear(renews.getFullYear() + 1);
const renewsIso = renews.toISOString();
const patchFields = {
  plan,
  billing_interval: 'monthly',
  plan_renews_at: renewsIso,
  cancel_at_period_end: 0,
  renewal_reminder_sent: 0,
  usage_alert_sent: 0,
};

async function viaRest() {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_KEY;
  if (!base || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing');
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  const get = await fetch(
    `${base}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,email,plan,plan_renews_at,billing_interval,blocked`,
    { headers },
  );
  if (!get.ok) throw new Error(`REST GET ${get.status}: ${(await get.text()).slice(0, 200)}`);
  const rows = await get.json();
  if (!Array.isArray(rows) || !rows.length) {
    const like = await fetch(
      `${base}/rest/v1/users?email=ilike.*${encodeURIComponent(email.split('@')[0])}*&select=id,email,plan&limit=10`,
      { headers },
    );
    console.error('USER_NOT_FOUND', email);
    console.error('candidates', await like.json());
    process.exit(1);
  }
  console.log('via=rest before', rows[0]);
  const patch = await fetch(`${base}/rest/v1/users?id=eq.${encodeURIComponent(rows[0].id)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patchFields),
  });
  if (!patch.ok) throw new Error(`REST PATCH ${patch.status}: ${(await patch.text()).slice(0, 200)}`);
  const after = await patch.json();
  console.log('after', after[0] || after);
  const del = await fetch(`${base}/rest/v1/sessions?user_id=eq.${encodeURIComponent(rows[0].id)}`, {
    method: 'DELETE',
    headers,
  });
  console.log('sessions_delete', del.status);
}

async function viaPg() {
  const url = env.SUPABASE_DB_URL;
  if (!url) throw new Error('SUPABASE_DB_URL missing');
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const before = await client.query(
    'select id, email, plan, plan_renews_at, billing_interval, blocked from users where lower(email)=lower($1)',
    [email],
  );
  if (!before.rows.length) {
    console.error('USER_NOT_FOUND', email);
    await client.end();
    process.exit(1);
  }
  console.log('via=pg before', before.rows[0]);
  const after = await client.query(
    `update users
     set plan=$1, billing_interval=$2, plan_renews_at=$3,
         cancel_at_period_end=0, renewal_reminder_sent=0, usage_alert_sent=0
     where id=$4
     returning id, email, plan, plan_renews_at, billing_interval`,
    [plan, 'monthly', renewsIso, before.rows[0].id],
  );
  console.log('after', after.rows[0]);
  try {
    const cleared = await client.query('delete from sessions where user_id=$1', [before.rows[0].id]);
    console.log('sessions_cleared', cleared.rowCount);
  } catch (err) {
    console.log('sessions_clear_skipped', err.message);
  }
  await client.end();
}

try {
  await viaRest();
} catch (err) {
  console.error('rest_failed', err.message);
  await viaPg();
}
console.log('done', { requested, storedAs: plan, renews: renewsIso });
