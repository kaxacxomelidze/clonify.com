/**
 * Record a short frame loop from a live <canvas> so the clone can keep the motion
 * without the site's JS (preview neutralizes it). Works for 2D canvases via
 * toDataURL; WebGL canvases without preserveDrawingBuffer read back blank, so those
 * fall back to element screenshots with overlapping text hidden for the shot.
 */
import { createHash } from 'crypto';
import type { Page } from 'playwright-core';

export interface CanvasFrameCapture {
  frames: Buffer[];
  /** Average wall-clock gap between captured frames — playback speed. */
  frameMs: number;
}

interface FrameRead {
  dataUrl: string;
  blank: boolean;
}

async function readCanvasPixels(page: Page, id: string): Promise<FrameRead> {
  return page.evaluate((canvasId: string) => {
    const canvas = document.querySelector(`canvas[data-clonyfy-canvas-id="${canvasId}"]`) as HTMLCanvasElement | null;
    if (!canvas || !canvas.width || !canvas.height) return { dataUrl: '', blank: true };
    try {
      // Downscaled probe: works for 2D and WebGL alike (WebGL reads blank once presented).
      const probe = document.createElement('canvas');
      probe.width = 48;
      probe.height = 48;
      const ctx = probe.getContext('2d');
      if (!ctx) return { dataUrl: '', blank: true };
      ctx.drawImage(canvas, 0, 0, 48, 48);
      const data = ctx.getImageData(0, 0, 48, 48).data;
      let painted = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 8) painted++;
      if (painted < 3) return { dataUrl: '', blank: true };
      return { dataUrl: canvas.toDataURL('image/png'), blank: false };
    } catch {
      return { dataUrl: '', blank: true }; // tainted by cross-origin images
    }
  }, id);
}

async function screenshotCanvas(page: Page, id: string): Promise<Buffer | null> {
  const loc = page.locator(`canvas[data-clonyfy-canvas-id="${id}"]`).first();
  if (!(await loc.count())) return null;
  // Hide text/UI painted over the canvas so it isn't baked into the frame
  // (style-only changes — safe while the site's framework still runs).
  await page.evaluate((canvasId: string) => {
    const el = document.querySelector(`canvas[data-clonyfy-canvas-id="${canvasId}"]`);
    if (!el) return;
    const box = el.getBoundingClientRect();
    for (const node of Array.from(document.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,button,span,label,svg,img,li'))) {
      const other = node as HTMLElement;
      if (other.contains(el)) continue;
      const r = other.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const ix = Math.max(0, Math.min(box.right, r.right) - Math.max(box.left, r.left));
      const iy = Math.max(0, Math.min(box.bottom, r.bottom) - Math.max(box.top, r.top));
      if (ix * iy <= 0) continue;
      other.setAttribute('data-clonyfy-canvas-mask', other.style.visibility || '');
      other.style.setProperty('visibility', 'hidden', 'important');
    }
  }, id);
  try {
    return await loc.screenshot({ type: 'png', timeout: 4000, animations: 'allow' });
  } catch {
    return null;
  } finally {
    await page.evaluate(() => {
      document.querySelectorAll('[data-clonyfy-canvas-mask]').forEach((node) => {
        const el = node as HTMLElement;
        const prev = el.getAttribute('data-clonyfy-canvas-mask') || '';
        if (prev) el.style.visibility = prev;
        else el.style.removeProperty('visibility');
        el.removeAttribute('data-clonyfy-canvas-mask');
      });
    }).catch(() => {});
  }
}

/**
 * Capture up to `maxFrames` distinct frames. Stops early when the canvas is static
 * (three identical reads in a row) so still canvases cost one frame.
 */
export async function captureCanvasFrames(
  page: Page,
  id: string,
  opts: { maxFrames: number; intervalMs: number; maxBytes: number },
): Promise<CanvasFrameCapture> {
  const frames: Buffer[] = [];
  const hashes = new Set<string>();
  let lastHash = '';
  let repeats = 0;
  let bytes = 0;
  let useScreenshot = false;
  const started = Date.now();

  await page.locator(`canvas[data-clonyfy-canvas-id="${id}"]`).first()
    .scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300); // let IO-gated animations resume after scrolling in

  for (let i = 0; i < opts.maxFrames; i++) {
    let buf: Buffer | null = null;
    if (!useScreenshot) {
      const read = await readCanvasPixels(page, id).catch(() => ({ dataUrl: '', blank: true }));
      if (!read.blank && read.dataUrl) {
        buf = Buffer.from(read.dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
      } else if (i === 0) {
        useScreenshot = true; // WebGL / tainted — switch to element screenshots
      }
    }
    if (useScreenshot) {
      buf = await screenshotCanvas(page, id);
      if (!buf || buf.length < 800) break;
    }
    if (!buf) break;

    const hash = createHash('sha1').update(buf).digest('hex');
    if (hash === lastHash) {
      repeats++;
      if (repeats >= 2 && frames.length <= 1) break; // static canvas
    } else {
      repeats = 0;
      lastHash = hash;
      if (!hashes.has(hash)) {
        if (bytes + buf.length > opts.maxBytes) break;
        hashes.add(hash);
        frames.push(buf);
        bytes += buf.length;
      }
    }
    // Screenshots are slow on their own; don't add the full interval on top.
    await page.waitForTimeout(useScreenshot ? Math.max(0, opts.intervalMs - 120) : opts.intervalMs);
  }

  const elapsed = Date.now() - started - 300;
  const frameMs = frames.length > 1 ? Math.max(40, Math.min(500, Math.round(elapsed / Math.max(1, frames.length)))) : 0;
  return { frames, frameMs };
}
