#!/usr/bin/env node
/**
 * Local Postgres for development (Docker).
 *
 *   npm run db:local:up     start container (port 5433) + apply scripts/local-schema.sql
 *   npm run db:local:down   stop the container (data is kept in the named volume)
 *   npm run db:local:reset  delete container + volume, then recreate
 *
 * Matches LOCAL_DB_* defaults in .env: host localhost, port 5433,
 * user/db clonyfy, password clonyfy_local.
 */
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NAME = 'clonyfy-local-pg';
const VOLUME = 'clonyfy-local-pgdata';
const PORT = process.env.LOCAL_DB_PORT || '5433';
const USER = 'clonyfy';
const PASSWORD = 'clonyfy_local';
const DB = 'clonyfy';

function docker(args, opts = {}) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
}

function exists() {
  return docker(['ps', '-a', '--filter', `name=^${NAME}$`, '--format', '{{.Names}}']) === NAME;
}

function running() {
  return docker(['ps', '--filter', `name=^${NAME}$`, '--format', '{{.Names}}']) === NAME;
}

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try {
      docker(['exec', NAME, 'pg_isready', '-U', USER, '-d', DB]);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('Postgres did not become ready in 60s');
}

function applySchema() {
  const sql = readFileSync(join(__dirname, 'local-schema.sql'), 'utf8');
  docker(['exec', '-i', NAME, 'psql', '-v', 'ON_ERROR_STOP=1', '-q', '-U', USER, '-d', DB], { input: sql });
}

async function up() {
  if (!exists()) {
    console.log(`Creating ${NAME} on localhost:${PORT}…`);
    docker([
      'run', '-d', '--name', NAME,
      '-e', `POSTGRES_USER=${USER}`,
      '-e', `POSTGRES_PASSWORD=${PASSWORD}`,
      '-e', `POSTGRES_DB=${DB}`,
      '-p', `${PORT}:5432`,
      '-v', `${VOLUME}:/var/lib/postgresql/data`,
      '--restart', 'unless-stopped',
      'postgres:16-alpine',
    ]);
  } else if (!running()) {
    console.log(`Starting ${NAME}…`);
    docker(['start', NAME]);
  }
  await waitReady();
  applySchema();
  console.log(`Local DB ready: postgres://${USER}:***@localhost:${PORT}/${DB}`);
}

function down() {
  if (running()) docker(['stop', NAME]);
  console.log(`${NAME} stopped.`);
}

async function reset() {
  if (exists()) docker(['rm', '-f', NAME]);
  try { docker(['volume', 'rm', VOLUME]); } catch { /* not present */ }
  await up();
}

const cmd = process.argv[2] || 'up';
try {
  if (cmd === 'up') await up();
  else if (cmd === 'down') down();
  else if (cmd === 'reset') await reset();
  else throw new Error(`Unknown command: ${cmd}`);
} catch (err) {
  console.error(err.stderr?.toString?.() || err.message || err);
  process.exit(1);
}
