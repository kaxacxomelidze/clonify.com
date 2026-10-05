import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createHash } from 'crypto';
import Handlebars from 'handlebars';
import type { Manifest, ApiRouteSpec } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');
const SERVE_PATCHES_PATH = resolve(__dirname, '../../../lib/cloneServePatches.js');
const PREVIEW_RUNTIME_PATH = resolve(__dirname, '../../../lib/clonePreviewRuntime.js');

let _servePatches: {
  buildVisibilityPatchHtml: (base?: string, opts?: { includeBase?: boolean }) => string;
  buildScrollAnimationsPatchHtml: () => string;
} | null = null;
async function loadServePatches() {
  if (_servePatches) return _servePatches;
  _servePatches = await import(pathToFileURL(SERVE_PATCHES_PATH).href);
  return _servePatches!;
}

let _previewRuntime: {
  buildInteractionRuntimeScript: () => string;
  buildAnimationRuntimeScript: () => string;
} | null = null;
async function loadPreviewRuntime() {
  if (_previewRuntime) return _previewRuntime;
  _previewRuntime = await import(pathToFileURL(PREVIEW_RUNTIME_PATH).href);
  return _previewRuntime!;
}

function tpl(name: string, data: Record<string, unknown>): string {
  const src = readFileSync(join(TEMPLATES_DIR, name), 'utf8');
  return Handlebars.compile(src)(data);
}

function write(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

function prismaModelName(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/[^a-zA-Z]/g, ''))
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('') || 'FormSubmission';
}

function toPrismaFields(fields: string[]): string {
  const reserved = new Set(['id', 'createdAt']);
  return fields
    .filter((f) => !reserved.has(f))
    .map((f) => `  ${f.replace(/[^a-zA-Z0-9_]/g, '_')}  String  @default("")`)
    .join('\n');
}

export function safeName(route: string): string {
  if (route === '/') return '__root__';
  // Decode percent-encoded chars first (e.g. Georgian/Cyrillic URLs) to avoid
  // each %XX triplet becoming 3 underscores and blowing past Windows MAX_PATH.
  let decoded = route;
  try { decoded = decodeURIComponent(route); } catch {}
  // Keep hyphens to avoid collision: /blog-post and /blog_post would both become
  // blog_post if hyphens were replaced with underscores.
  const name = decoded
    .replace(/\//g, '__')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/__+/g, '__')
    .replace(/^[_-]+|[_-]+$/g, '') || '__page__';
  // Keep filenames under 80 chars; append a hash of the original route for uniqueness.
  if (name.length > 80) {
    const hash = createHash('sha1').update(route).digest('hex').slice(0, 8);
    return name.slice(0, 72) + '__' + hash;
  }
  return name;
}

function routeSegments(path: string): string[] {
  return path
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/:/g, '_'));
}

export async function generateNextApp(outDir: string, manifest: Manifest, apiRoutes: ApiRouteSpec[]) {
  const { pages } = manifest;
  const hostname = new URL(manifest.targetOrigin).hostname;

  // Static assets dir (already populated by capture)
  mkdirSync(join(outDir, 'public', '_assets'), { recursive: true });

  // Write captured HTML files
  const pagesDataDir = join(outDir, 'captured-pages');
  mkdirSync(pagesDataDir, { recursive: true });
  // Preserve existing route-map filenames so regenerate never orphans real HTML
  // (e.g. older clones used __home__.html while safeName('/') is now __root__).
  const existingRouteMap: Record<string, string> = existsSync(join(outDir, 'route-map.json'))
    ? (() => {
        try { return JSON.parse(readFileSync(join(outDir, 'route-map.json'), 'utf8')); }
        catch { return {}; }
      })()
    : {};
  const routeMap: Record<string, string> = { ...existingRouteMap };
  for (const page of pages) {
    const name = safeName(page.route);
    const filename = existingRouteMap[page.route] || `${name}.html`;
    const pageHtmlPath = join(pagesDataDir, filename);
    // Only write when we have real content. Never overwrite a non-empty file
    // with empty HTML (materialized exports keep HTML on disk; manifest omits it).
    if (page.html && page.html.length > 0) {
      writeFileSync(pageHtmlPath, page.html, 'utf8');
    }
    routeMap[page.route] = filename;
    if (page.route !== '/' && page.route.endsWith('.html')) {
      const cleanRoute = page.route.replace(/\.html$/i, '');
      routeMap[cleanRoute] ??= filename;
    } else if (page.route !== '/') {
      routeMap[`${page.route}.html`] ??= filename;
    }
  }

  writeFileSync(join(outDir, 'route-map.json'), JSON.stringify(routeMap, null, 2), 'utf8');

  // API fixtures
  const fixturesDir = join(outDir, 'fixtures');
  mkdirSync(fixturesDir, { recursive: true });
  for (const spec of apiRoutes) {
    for (const resp of spec.responses) {
      const fname = `${spec.fixtureKey}.${spec.method}.${resp.status}.json`;
      try {
        writeFileSync(join(fixturesDir, fname), JSON.stringify({
          status: resp.status,
          contentType: resp.contentType || 'application/json',
          body: resp.body,
        }, null, 2), 'utf8');
      } catch { /* skip unserializable */ }
    }
  }

  // Next.js app files
  write(join(outDir, 'app', 'layout.tsx'), tpl('layout.tsx.hbs', { hostname, targetOrigin: manifest.targetOrigin }));
  // Remove stale page.tsx from prior runs — route.ts takes over the catch-all
  const stalePage = join(outDir, 'app', '[[...slug]]', 'page.tsx');
  if (existsSync(stalePage)) rmSync(stalePage);
  // Route handler serves raw captured HTML (preserves scripts, full <head>, interactivity)
  const servePatches = await loadServePatches();
  const previewRuntime = await loadPreviewRuntime();
  write(join(outDir, 'app', '[[...slug]]', 'route.ts'), tpl('page.tsx.hbs', {
    targetOrigin: manifest.targetOrigin,
    targetOriginJson: JSON.stringify(manifest.targetOrigin),
    visibilityPatchJson: JSON.stringify(servePatches.buildVisibilityPatchHtml('/', { includeBase: false })),
    scrollPatchJson: JSON.stringify(servePatches.buildScrollAnimationsPatchHtml()),
    interactionRuntimeJson: JSON.stringify(previewRuntime.buildInteractionRuntimeScript()),
    animationRuntimeJson: JSON.stringify(previewRuntime.buildAnimationRuntimeScript()),
  }));

  // API routes — skip CDN/analytics paths that shouldn't be proxied
  const SKIP_API = [/cdn-cgi/, /analytics/, /gtag/, /hotjar/, /mixpanel/, /segment/, /sentry/];
  const filteredRoutes = apiRoutes.filter((r) => !SKIP_API.some((p) => p.test(r.path)));

  for (const spec of filteredRoutes) {
    const segments = routeSegments(spec.path);
    if (segments.length === 0) continue;
    write(join(outDir, 'app', ...segments, 'route.ts'), tpl('route.ts.hbs', {
      method: spec.method,
      path: spec.path,
      fixtureKey: spec.fixtureKey,
      defaultStatus: spec.responses[0]?.status ?? 200,
      looksLikeForm: spec.looksLikeForm,
      modelName: spec.looksLikeForm ? prismaModelName(spec.path) : null,
      sampleRequest: spec.sampleRequest ? JSON.stringify(spec.sampleRequest, null, 2) : null,
    }));
  }

  // Prisma schema — use same filtered set as API routes (skip CDN/analytics)
  const formRoutes = filteredRoutes.filter((r) => r.looksLikeForm && r.inferredFields.length > 0);
  const models = formRoutes.map((r) => ({
    name: prismaModelName(r.path),
    fields: toPrismaFields(r.inferredFields),
  }));
  write(join(outDir, 'prisma', 'schema.prisma'), tpl('schema.prisma.hbs', { models }));

  // lib/replay.ts
  write(join(outDir, 'lib', 'replay.ts'), tpl('replay.ts.hbs', {}));

  // Config files
  write(join(outDir, 'next.config.js'), tpl('next.config.js.hbs', {}));
  write(join(outDir, 'package.json'), tpl('package.json.hbs', {
    siteName: hostname.replace(/\./g, '-'),
    hasPrisma: models.length > 0,
  }));
  write(join(outDir, 'Dockerfile'), tpl('Dockerfile.hbs', {}));
  write(join(outDir, 'docker-compose.yml'), tpl('docker-compose.yml.hbs', {}));
  write(join(outDir, '.env.example'), 'DATABASE_URL="file:./dev.db"\n');
  write(join(outDir, 'tsconfig.json'), tpl('tsconfig.json.hbs', {}));
  write(join(outDir, 'README.md'), tpl('README.md.hbs', {
    targetOrigin: manifest.targetOrigin,
    hostname,
    pagesCount: Object.keys(routeMap).filter((route) => !route.endsWith('.html')).length,
    apiRoutesCount: filteredRoutes.length,
    modelsCount: models.length,
    capturedAt: manifest.capturedAt,
  }));

  console.log(`\nGenerated Next.js app at: ${outDir}`);
  console.log(`  Pages      : ${pages.length}`);
  console.log(`  API routes : ${filteredRoutes.length}`);
  console.log(`  DB models  : ${models.length}`);
  console.log(`\nNext steps:`);
  console.log(`  cd "${outDir}"`);
  console.log(`  npm install`);
  if (models.length > 0) console.log(`  npx prisma db push`);
  console.log(`  npm run build && npm start`);
}
