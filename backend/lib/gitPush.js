// Push a clone to GitHub with real git instead of one REST call per file.
//
// Why: the REST path (POST /git/blobs per file) burns one API request per file, so clones
// with thousands of files hit GitHub's ~5000 req/h token limit mid-push and leave half a
// site behind. `git push` sends everything as one packfile and is not subject to that limit.
//
// Limits handled so nothing is skipped:
//   - files over GitHub's 100 MB hard limit are uploaded through Git LFS (batch API, no
//     git-lfs binary needed) and committed as LFS pointers + a .gitattributes rule;
//   - GitHub rejects single pushes over 2 GB, so very large clones are pushed as a chain of
//     commits, each under CLONYFY_GIT_PUSH_CHUNK_MB (default 1024 MB).
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { createReadStream, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { request as httpsRequest } from 'https';
import { request as httpRequest } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';

export const LFS_THRESHOLD_BYTES = 95 * 1024 * 1024;
const DEFAULT_CHUNK_BYTES = Math.max(50, parseInt(process.env.CLONYFY_GIT_PUSH_CHUNK_MB || '1024', 10) || 1024) * 1024 * 1024;

let gitProbe = null;
/** True when a usable git binary is on PATH (false on serverless hosts). */
export function gitAvailable() {
  if (!gitProbe) {
    gitProbe = new Promise((resolve) => {
      try {
        const p = spawn('git', ['--version'], { stdio: 'ignore' });
        p.on('error', () => resolve(false));
        p.on('close', (code) => resolve(code === 0));
      } catch {
        resolve(false);
      }
    });
  }
  return gitProbe;
}

function scrub(text, secrets) {
  let out = String(text || '');
  for (const s of secrets) if (s) out = out.split(s).join('***');
  return out;
}

function run(args, { cwd, env, input, secrets = [] }) {
  return new Promise((resolve, reject) => {
    const p = spawn('git', args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [];
    const err = [];
    p.stdout.on('data', (c) => out.push(c));
    p.stderr.on('data', (c) => err.push(c));
    p.on('error', reject);
    p.on('close', (code) => {
      const stdout = Buffer.concat(out).toString('utf8');
      const stderr = scrub(Buffer.concat(err).toString('utf8'), secrets);
      if (code === 0) return resolve(stdout);
      const e = new Error(`git ${args[0]} failed: ${stderr.trim() || `exit ${code}`}`);
      if (/authentication failed|could not read username|invalid username or password|403/i.test(stderr)) {
        e.message = 'Bad credentials (git push was rejected by GitHub)';
        e.statusCode = 401;
      } else if (/non-fast-forward|fetch first|rejected/i.test(stderr)) {
        e.message = 'The GitHub branch changed while pushing. Push again.';
        e.statusCode = 409;
      } else if (/repository not found/i.test(stderr)) {
        e.message = 'Not Found: GitHub repository (git push)';
        e.statusCode = 404;
      }
      reject(e);
    });
    if (input != null) p.stdin.end(input);
    else p.stdin.end();
  });
}

function sha256File(abs) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(abs).on('data', (c) => h.update(c)).on('error', reject).on('end', () => resolve(h.digest('hex')));
  });
}

function httpJSON(url, { method = 'POST', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body == null ? null : Buffer.from(JSON.stringify(body));
    const req = (u.protocol === 'http:' ? httpRequest : httpsRequest)(u, {
      method,
      headers: { ...headers, ...(payload ? { 'Content-Length': payload.length } : {}) },
    }, (r) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = {};
        try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { message: text }; }
        if (r.statusCode >= 200 && r.statusCode < 300) return resolve(parsed);
        const e = new Error(parsed.message || `HTTP ${r.statusCode}`);
        e.statusCode = r.statusCode;
        reject(e);
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function httpPutFile(url, headers, abs, size) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = (u.protocol === 'http:' ? httpRequest : httpsRequest)(u, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream', ...headers, 'Content-Length': size },
    }, (r) => {
      r.resume();
      r.on('end', () => (r.statusCode >= 200 && r.statusCode < 300 ? resolve() : reject(new Error(`LFS upload HTTP ${r.statusCode}`))));
    });
    req.on('error', reject);
    createReadStream(abs).on('error', reject).pipe(req);
  });
}

// Upload big files through the Git LFS batch API; returns pointer text per file.
async function uploadLfs(big, { lfsUrl, basicAuth, log }) {
  const pointers = new Map();
  const meta = [];
  for (const f of big) meta.push({ f, oid: await sha256File(f.abs), size: f.size });
  const headers = { Accept: 'application/vnd.git-lfs+json', 'Content-Type': 'application/vnd.git-lfs+json', Authorization: `Basic ${basicAuth}` };
  for (let i = 0; i < meta.length; i += 100) {
    const group = meta.slice(i, i + 100);
    let res;
    try {
      res = await httpJSON(`${lfsUrl}/objects/batch`, {
        headers,
        body: { operation: 'upload', transfers: ['basic'], objects: group.map((m) => ({ oid: m.oid, size: m.size })) },
      });
    } catch (e) {
      if (/quota|budget|exceeded/i.test(e.message)) e.message = `GitHub LFS storage quota exceeded for this repo owner (${e.message}).`;
      throw e;
    }
    for (const obj of res.objects || []) {
      const m = group.find((x) => x.oid === obj.oid);
      if (!m) continue;
      if (obj.error) throw new Error(`LFS rejected ${m.f.rel}: ${obj.error.message || obj.error.code}`);
      const up = obj.actions && obj.actions.upload;
      if (up) {
        log(`[github/push] LFS upload ${m.f.rel} (${Math.round(m.size / 1048576)} MB)`);
        await httpPutFile(up.href, up.header || {}, m.f.abs, m.size);
        const verify = obj.actions.verify;
        if (verify) await httpJSON(verify.href, { headers: { ...headers, ...(verify.header || {}) }, body: { oid: m.oid, size: m.size } });
      }
    }
  }
  for (const m of meta) pointers.set(m.f, `version https://git-lfs.github.com/spec/v1\noid sha256:${m.oid}\nsize ${m.size}\n`);
  return pointers;
}

// .gitattributes patterns: escape glob metacharacters and whitespace.
const attrPattern = (path) => '/' + path.replace(/[\\*?[\]!#]/g, (c) => `\\${c}`).replace(/\s/g, '[[:space:]]');

// Index lines: quote C-style when the path would be ambiguous to update-index.
const indexPath = (p) => (/^"|\\/.test(p) ? `"${p.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : p);

/**
 * @param {object} o
 * @param {{abs:string, rel:string, size:number}[]} o.files
 * @param {string} o.prefix         target folder inside the repo ('' = root)
 * @param {string} o.owner
 * @param {string} o.repo
 * @param {string} o.token          GitHub PAT
 * @param {string} o.branch
 * @param {string} o.baseCommitSha  current tip of the branch (commits are built on top of it)
 * @param {boolean} o.cleanTarget   remove existing files under prefix that are not in this clone
 * @param {string} o.message
 * @param {(msg:string)=>void} [o.log]
 * @param {string} [o.remoteUrl]    override for tests
 * @param {string} [o.lfsUrl]       override for tests
 * @param {number} [o.chunkBytes]   override for tests
 */
export async function pushCloneWithGit(o) {
  const log = o.log || (() => {});
  const remoteUrl = o.remoteUrl || `https://github.com/${o.owner}/${o.repo}.git`;
  const lfsUrl = o.lfsUrl || `https://github.com/${o.owner}/${o.repo}.git/info/lfs`;
  const chunkBytes = o.chunkBytes || DEFAULT_CHUNK_BYTES;
  const basicAuth = Buffer.from(`x-access-token:${o.token}`).toString('base64');
  const secrets = [o.token, basicAuth];
  const dir = mkdtempSync(join(tmpdir(), 'clonyfy-git-'));
  // Token travels in the environment (not argv, not the remote URL), so it never shows up
  // in `ps`, in .git/config, or in git's error output.
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `http.${new URL(remoteUrl).origin}/.extraheader`,
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basicAuth}`,
    GIT_AUTHOR_NAME: 'CLONYFY', GIT_AUTHOR_EMAIL: 'bot@clonyfy.com',
    GIT_COMMITTER_NAME: 'CLONYFY', GIT_COMMITTER_EMAIL: 'bot@clonyfy.com',
  };
  const git = (args, extra = {}) => run(['-c', 'core.autocrlf=false', '-c', 'core.longpaths=true', '-c', 'gc.auto=0', ...args], { cwd: dir, env, secrets, ...extra });
  const prefix = o.prefix || '';
  const gitPath = (rel) => (prefix ? `${prefix}/${rel}` : rel);

  try {
    await git(['init', '-q']);
    await git(['remote', 'add', 'origin', remoteUrl]);

    // Start from the branch tip. Trees only (blob:none) — we never need the old file contents.
    let parent = o.baseCommitSha || null;
    if (parent) {
      try {
        await git(['fetch', '-q', '--no-tags', '--depth=1', '--filter=blob:none', 'origin', parent]);
      } catch {
        await git(['fetch', '-q', '--no-tags', '--depth=1', 'origin', parent]);
      }
      await git(['read-tree', parent]);
      if (o.cleanTarget) await git(['rm', '-r', '--cached', '-q', '--ignore-unmatch', '--', prefix || '.']);
    }

    const big = o.files.filter((f) => f.size > LFS_THRESHOLD_BYTES);
    const small = o.files.filter((f) => f.size <= LFS_THRESHOLD_BYTES);
    let lfsPointers = new Map();
    if (big.length) {
      log(`[github/push] ${big.length} file(s) over 95 MB → Git LFS`);
      lfsPointers = await uploadLfs(big, { lfsUrl, basicAuth, log });
    }

    // Split into chunks that keep each push under GitHub's 2 GB pack limit.
    const chunks = [];
    let cur = [];
    let curBytes = 0;
    for (const f of small) {
      if (cur.length && curBytes + f.size > chunkBytes) { chunks.push(cur); cur = []; curBytes = 0; }
      cur.push(f);
      curBytes += f.size;
    }
    if (cur.length || !chunks.length) chunks.push(cur);

    let commitSha = parent;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const last = i === chunks.length - 1;
      const lines = [];
      if (chunk.length) {
        const shas = (await git(['hash-object', '-w', '--no-filters', '--stdin-paths'], { input: chunk.map((f) => f.abs).join('\n') + '\n' }))
          .trim().split('\n');
        if (shas.length !== chunk.length) throw new Error('git hash-object returned an unexpected number of objects');
        chunk.forEach((f, k) => lines.push(`100644 ${shas[k]}\t${indexPath(gitPath(f.rel))}`));
      }
      if (last && lfsPointers.size) {
        const ptrFiles = [];
        let n = 0;
        for (const [f, text] of lfsPointers) {
          const tmp = join(dir, `.lfs-pointer-${n++}`);
          writeFileSync(tmp, text);
          ptrFiles.push({ f, tmp });
        }
        const shas = (await git(['hash-object', '-w', '--no-filters', '--stdin-paths'], { input: ptrFiles.map((p) => p.tmp).join('\n') + '\n' })).trim().split('\n');
        ptrFiles.forEach((p, k) => lines.push(`100644 ${shas[k]}\t${indexPath(gitPath(p.f.rel))}`));
        // Merge our LFS rules into any existing root .gitattributes.
        let attrs = '';
        try { attrs = await git(['cat-file', '-p', ':.gitattributes']); } catch {}
        const rules = [...lfsPointers.keys()].map((f) => `${attrPattern(gitPath(f.rel))} filter=lfs diff=lfs merge=lfs -text`);
        const merged = (attrs && !attrs.endsWith('\n') ? attrs + '\n' : attrs) + rules.filter((r) => !attrs.includes(r)).join('\n') + '\n';
        const attrSha = (await git(['hash-object', '-w', '--stdin'], { input: merged })).trim();
        lines.push(`100644 ${attrSha}\t.gitattributes`);
      }
      if (lines.length) await git(['update-index', '--add', '--index-info'], { input: lines.join('\n') + '\n' });
      const tree = (await git(['write-tree'])).trim();
      const msg = chunks.length > 1 ? `${o.message} (${i + 1}/${chunks.length})` : o.message;
      commitSha = (await git(['commit-tree', tree, ...(commitSha ? ['-p', commitSha] : []), '-m', msg])).trim();
      log(`[github/push] ${o.owner}/${o.repo}: pushing commit ${i + 1}/${chunks.length} (${chunk.length} files)`);
      await git(['push', '-q', 'origin', `${commitSha}:refs/heads/${o.branch}`]);
    }

    return {
      commitSha,
      commitUrl: `https://github.com/${o.owner}/${o.repo}/commit/${commitSha}`,
      commits: chunks.length,
      lfsFiles: big.length,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
