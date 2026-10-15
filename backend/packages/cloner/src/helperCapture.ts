/**
 * Clonyfy Helper path: build a clone from a page the user captured in their own browser.
 *
 * Protected sites (Cloudflare, PerimeterX, DataDome…) refuse the server's automated
 * browser — and Clonyfy does not try to get past that. Instead the user, already a
 * verified visitor in their own tab, captures the rendered page with the helper
 * extension. This turns that bundle into the same page record the crawler produces
 * (snapshot + server HTML + local assets + network record) and runs the existing
 * pipeline (rewrite → analyze → generate) through finishClone. No new rendering logic.
 */
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { extname, join, resolve } from 'path';
import mime from 'mime-types';
import { extractCssUrls, rewriteCssUrls } from './capture.js';
import { routeForUrl } from './crawler.js';
import { findCredentialLeaks, sanitizeHelperBundle, type HelperBundle } from './helperSanitize.js';
import { initLogger, logger, setLogSink } from './logger.js';
import { rewriteHtml } from './rewriter.js';
import { finishClone, type CloneRunEvents, type CloneRunResult } from './runClone.js';
import { safeFetch } from './ssrfGuard.js';
import { safeName } from './generator.js';
import { CLONYFY_USER_AGENT } from './userAgent.js';
import type { AssetEntry, ArtifactWrittenEvent, ClonerOptions, NetworkEntry, PageRecord } from './types.js';

const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const MAX_REMOTE_FETCHES = 400;
const REMOTE_CONCURRENCY = 8;

export interface HelperCaptureOptions {
  /** Output folder for the clone (same layout as a crawler clone). */
  out: string;
  verbose?: boolean;
}

function extFor(url: string, contentType: string): string {
  let fromPath = '';
  try { fromPath = extname(new URL(url).pathname).toLowerCase(); } catch { /* ignore */ }
  if (fromPath && fromPath.length <= 6) return fromPath;
  const fromMime = mime.extension(contentType.split(';')[0]!.trim());
  return fromMime ? `.${fromMime}` : '.bin';
}

/**
 * Build a clone from a helper bundle. The bundle is sanitized again here and refused if
 * any credential survives (the extension is expected to have stripped them already).
 */
export async function runHelperCapture(
  rawBundle: unknown,
  options: HelperCaptureOptions,
  events: CloneRunEvents = {},
): Promise<CloneRunResult> {
  const out = resolve(options.out);
  setLogSink(events.onLog ? (line) => events.onLog?.(line) : null);
  initLogger(out, options.verbose);
  try {
    const bundle: HelperBundle = sanitizeHelperBundle(rawBundle);
    const leaks = findCredentialLeaks(bundle);
    if (leaks.length) {
      throw new Error(`Helper capture refused: credential data in the bundle (${leaks.slice(0, 3).join('; ')})`);
    }
    let targetOrigin: string;
    try { targetOrigin = new URL(bundle.url).origin; } catch { throw new Error('Helper capture has no valid page URL'); }
    if (!bundle.domSnapshot || bundle.domSnapshot.length < 200) throw new Error('Helper capture contains no page content');

    logger.info('\nCLONYFY v0.1 — Clonyfy Helper capture');
    logger.info(`Target      : ${bundle.url}`);
    logger.info(`Output      : ${out}`);
    logger.info(`Captured in : the user's own browser (${bundle.capturedAt || 'now'})`);
    logger.info(`Files       : ${bundle.assets.filter((a) => a.data).length} read in the browser, ${bundle.assets.filter((a) => !a.data).length} to download`);

    const assetsDir = join(out, 'public', '_assets');
    const capturedPagesDir = join(out, 'captured-pages');
    mkdirSync(assetsDir, { recursive: true });
    mkdirSync(capturedPagesDir, { recursive: true });

    const notifyArtifact = async (event: ArtifactWrittenEvent) => {
      if (!events.onArtifactWritten) return;
      try { await events.onArtifactWritten(event); } catch (err) {
        logger.warn(`  [OFFLOAD] ${event.relPath}: ${(err as Error).message}`);
        if (event.kind === 'page' || event.kind === 'route-map' || event.kind === 'manifest') throw err;
      }
    };

    // ── Files: saved under content-hash names, exactly like the crawler's saveAsset. ──
    const assets: AssetEntry[] = [];
    const assetMap = new Map<string, string>();
    const cssFiles: Array<{ path: string; text: string; sourceUrl: string }> = [];
    const failed: string[] = [];
    const save = async (url: string, body: Buffer, contentType: string) => {
      if (body.length > MAX_ASSET_BYTES) { failed.push(url); return; }
      const ext = extFor(url, contentType);
      const filename = `${createHash('sha1').update(body).digest('hex').slice(0, 16)}${ext}`;
      const localPath = join(assetsDir, filename);
      const webPath = `/_assets/${filename}`;
      writeFileSync(localPath, body);
      await notifyArtifact({ relPath: `public/_assets/${filename}`, absPath: localPath, kind: 'asset' });
      assets.push({ originalUrl: url, localPath: webPath });
      assetMap.set(url, webPath);
      assetMap.set(url.split('?')[0]!.split('#')[0]!, webPath);
      try { assetMap.set(new URL(url).pathname, webPath); } catch { /* ignore */ }
      if (ext === '.css' || /text\/css/i.test(contentType)) cssFiles.push({ path: localPath, text: body.toString('utf8'), sourceUrl: url });
    };

    for (const a of bundle.assets) {
      if (!a.data) continue;
      try { await save(a.url, Buffer.from(a.data, 'base64'), a.contentType); } catch (err) {
        logger.debug(`  [HELPER ASSET] ${a.url}: ${(err as Error).message}`);
        failed.push(a.url);
      }
    }

    // Files the browser couldn't hand over (cross-origin without CORS): public static
    // files, downloaded here like any crawler asset. CSS references are followed too.
    const remote = new Set(bundle.assets.filter((a) => !a.data).map((a) => a.url));
    for (const css of cssFiles) {
      for (const ref of extractCssUrls(css.text)) {
        try {
          const abs = new URL(ref, css.sourceUrl).href;
          if (!assetMap.has(abs) && /^https?:/i.test(abs)) remote.add(abs);
        } catch { /* ignore */ }
      }
    }
    const queue = [...remote].filter((u) => !assetMap.has(u)).slice(0, MAX_REMOTE_FETCHES);
    let downloaded = 0;
    const worker = async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        try {
          const r = await safeFetch(url, {
            headers: { 'User-Agent': CLONYFY_USER_AGENT, Referer: `${targetOrigin}/` },
            signal: AbortSignal.timeout(15_000),
          });
          if (!r.ok) { failed.push(url); await r.body?.cancel().catch(() => {}); continue; }
          await save(url, Buffer.from(await r.arrayBuffer()), r.headers.get('content-type') || '');
          downloaded++;
        } catch { failed.push(url); }
      }
    };
    await Promise.all(Array.from({ length: REMOTE_CONCURRENCY }, worker));
    // Stylesheets point at local copies of their fonts/images.
    for (const css of cssFiles) {
      writeFileSync(css.path, rewriteCssUrls(css.text, assetMap, css.sourceUrl), 'utf8');
    }
    logger.info(`  Files saved: ${assets.length} (${downloaded} downloaded by the server), ${failed.length} unavailable`);

    // ── The page record — same shape the crawler produces. ──
    const network: NetworkEntry[] = bundle.networkRecord.map((n) => ({
      method: n.method, url: n.url, postData: null, status: n.status, contentType: n.contentType, body: n.body,
    }));
    const route = routeForUrl(bundle.url);
    const record: PageRecord = {
      url: bundle.url,
      route,
      html: '',
      serverHtml: bundle.serverHtml || undefined,
      assets,
      network,
      failedAssets: failed,
    };
    record.html = rewriteHtml({ ...record, html: bundle.domSnapshot }, targetOrigin);

    const routeMap: Record<string, string> = {};
    const pageFilename = (r: string) => `${safeName(r)}.html`;
    const filename = pageFilename(route);
    writeFileSync(join(capturedPagesDir, filename), record.html, 'utf8');
    routeMap[route] = filename;
    logger.info(`  [1/1] ✓ ${bundle.url}  (assets: ${assets.length}, network: ${network.length})`);

    const opts: ClonerOptions = { url: bundle.url, out, maxPages: 1, depth: 1, ignoreRobots: true, concurrency: 1 };
    return await finishClone(opts, [record], {
      targetOrigin,
      capturedPagesDir,
      routeMap,
      pageFilename,
      notifyArtifact,
      rewriteStats: [{ url: bundle.url, assets: assets.length, network: network.length }],
    });
  } catch (err) {
    logger.error(err instanceof Error ? err.message : 'Helper capture failed', err);
    throw err;
  } finally {
    logger.close();
    setLogSink(null);
  }
}
