import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function load(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        let v = l.slice(i + 1).trim();
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1);
        }
        return [l.slice(0, i).trim(), v];
      }),
  );
}

const health = await fetch('https://clonyfy.com/api/health');
console.log('health', await health.json());

for (const label of ['production', 'local']) {
  const env = load(join(root, label === 'production' ? '.env.production' : '.env'));
  const pw = env.ADMIN_PASSWORD || '';
  const res = await fetch('https://clonyfy.com/api/admin/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw }),
  });
  const text = await res.text();
  console.log(label, {
    status: res.status,
    pwLen: pw.length,
    pwHash8: createHash('sha256').update(pw).digest('hex').slice(0, 8),
    body: text.slice(0, 160),
    hasLocalDb: !!env.LOCAL_DB_HOST,
    hasSupabaseDb: !!env.SUPABASE_DB_URL,
  });
}
