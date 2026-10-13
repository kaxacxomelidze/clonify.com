/**
 * Decide per page whether the interactive preview (original server HTML + the site's
 * own JS) actually looks closer to the live site than the offline snapshot.
 *
 * Some sites' scripts need their own backend to render content: without it they show
 * loading skeletons, "technical issue" banners or framework error screens (walmart.com).
 * Comparing amounts of text was misleading (skeleton pages still carry plenty of menu
 * text), so we compare PICTURES: both modes are rendered using only captured files —
 * exactly like the preview — and scored against the screenshot of the live page taken
 * during capture. The closer mode becomes the page's default.
 */
import { join } from 'path';
import { existsSync } from 'fs';
import type { AssetEntry } from './types.js';
import { logger } from './logger.js';
import { getChromiumLaunchOptions } from './crawler.js';

export interface LiveCheckPage {
  url: string;
  filename: string;
  serverHtml: string;
  snapshotHtml: string;
  /** Top-viewport PNG of the live page taken during capture. */
  liveScreenshot?: Buffer;
}

export type PreviewModeMap = Record<string, 'offline'>;

/** Offline must beat interactive by this many points to win (interactive is richer). */
const OFFLINE_MARGIN = 5;
const MAX_PAGES = 8;
const SETTLE_MS = 6000;
const VIEWPORT = { width: 1440, height: 900 };

export async function choosePreviewModes(
  pages: LiveCheckPage[],
  assets: AssetEntry[],
  publicDir: string,
): Promise<PreviewModeMap> {
  const result: PreviewModeMap = {};
  const candidates = pages.filter((p) => p.liveScreenshot?.length).slice(0, MAX_PAGES);
  if (!candidates.length) return result;

  let browser: any;
  try {
    const { chromium } = await import('playwright-core');
    // Same browser + flags the crawler uses (bundled Chromium / serverless build).
    const launchOptions = await getChromiumLaunchOptions(chromium as never);
    browser = await chromium.launch({ headless: true, ...launchOptions });
  } catch (err) {
    logger.debug(`  [PREVIEW MODE] browser unavailable, keeping interactive default: ${(err as Error).message.split('\n')[0]}`);
    return result;
  }

  // Requests are answered from captured files: by original URL (server HTML keeps the
  // site's own paths) and by /_assets/ path on the page origin (offline snapshot).
  const origin = new URL(candidates[0].url).origin;
  const files = new Map<string, string>();
  for (const a of assets) {
    if (!a.originalUrl || !a.localPath) continue;
    const local = '/' + a.localPath.replace(/^\/+/, '');
    const abs = join(publicDir, local);
    files.set(a.originalUrl.split('#')[0], abs);
    files.set(a.originalUrl.split('#')[0].split('?')[0], abs);
    files.set(origin + local, abs);
  }

  try {
    const scorer = await browser.newPage();
    for (const page of candidates) {
      try {
        const live = await render(browser, page, files, true);
        const offline = await render(browser, page, files, false);
        const liveScore = live.errorScreen ? 0 : await similarity(scorer, page.liveScreenshot!, live.png);
        const offlineScore = await similarity(scorer, page.liveScreenshot!, offline.png);
        const useOffline = offlineScore > liveScore + OFFLINE_MARGIN;
        logger.info(`  [PREVIEW MODE] ${page.url}: interactive ${liveScore}% vs offline ${offlineScore}% `
          + `match with the live page${live.errorScreen ? ' (error screen)' : ''} → ${useOffline ? 'offline' : 'interactive'}`);
        if (useOffline) result[page.filename] = 'offline';
      } catch (err) {
        logger.debug(`  [PREVIEW MODE] ${page.url}: check failed, keeping interactive: ${(err as Error).message}`);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }
  return result;
}

async function render(
  browser: any,
  page: LiveCheckPage,
  files: Map<string, string>,
  withScripts: boolean,
): Promise<{ png: Buffer; errorScreen: boolean }> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, javaScriptEnabled: withScripts });
  try {
    const tab = await context.newPage();
    const origin = new URL(page.url).origin;
    await tab.route('**/*', async (route: any) => {
      const req = route.request();
      const url = String(req.url());
      if (req.isNavigationRequest() && req.frame() === tab.mainFrame()) {
        await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: withScripts ? page.serverHtml : page.snapshotHtml });
        return;
      }
      const file = files.get(url.split('#')[0]) || files.get(url.split('#')[0].split('?')[0]);
      if (file && existsSync(file)) { await route.fulfill({ path: file }); return; }
      // Like the preview: uncaptured same-origin requests (the site's APIs) don't reach
      // the original backend. Third-party requests go out as they would in the preview.
      if (!withScripts || url.startsWith(origin)) { await route.abort(); return; }
      await route.continue();
    });
    await tab.goto(page.url, { waitUntil: 'load', timeout: 30_000 }).catch(() => {});
    await tab.waitForTimeout(withScripts ? SETTLE_MS : 1500);
    const errorScreen = await tab.evaluate(() => {
      const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
      return document.documentElement.id === '__next_error__'
        || (/Application error: a (client|server)-side exception|This page couldn.t load/i.test(text) && text.length < 800);
    }).catch(() => false);
    const png: Buffer = await tab.screenshot({ type: 'png', timeout: 10_000 });
    return { png, errorScreen };
  } finally {
    await context.close().catch(() => {});
  }
}

/** Share of pixels (0–100) whose RGB channels all differ by ≤ 24 — computed in a canvas. */
async function similarity(scorer: any, a: Buffer, b: Buffer): Promise<number> {
  return scorer.evaluate(async ({ a, b }: { a: string; b: string }) => {
    const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = Math.min(ia.width, ib.width);
    const h = Math.min(ia.height, ib.height);
    const pixels = (img: HTMLImageElement) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      return g.getImageData(0, 0, w, h).data;
    };
    const da = pixels(ia);
    const db = pixels(ib);
    let same = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - db[i]) <= 24 && Math.abs(da[i + 1] - db[i + 1]) <= 24 && Math.abs(da[i + 2] - db[i + 2]) <= 24) same++;
    }
    return Math.round((same / (w * h)) * 1000) / 10;
  }, { a: `data:image/png;base64,${a.toString('base64')}`, b: `data:image/png;base64,${b.toString('base64')}` });
}
