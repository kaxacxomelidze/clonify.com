interface ClonerOptions {
    url: string;
    out: string;
    maxPages: number;
    depth: number;
    ignoreRobots: boolean;
    concurrency: number;
    verbose?: boolean;
    /** Scale "Select all pages": same-origin crawl with high page/depth budget. */
    fullSite?: boolean;
}
interface ArtifactWrittenEvent {
    relPath: string;
    absPath: string;
    kind: 'page' | 'route-map' | 'manifest' | 'asset';
}
interface NetworkEntry {
    method: string;
    url: string;
    postData: string | null;
    status: number;
    contentType: string;
    body: string | null;
}
interface AssetEntry {
    originalUrl: string;
    localPath: string;
}
interface PageRecord {
    url: string;
    route: string;
    html: string;
    /** The site's original server response — what its JS hydrates from (interactive preview). */
    serverHtml?: string;
    /** Top-viewport PNG of the live page at capture time (preview-mode choice; not persisted). */
    liveScreenshot?: Buffer;
    assets: AssetEntry[];
    network: NetworkEntry[];
    failedAssets?: string[];
    /** Per-URL failure reason: budget | http_status | timeout | too_large | error */
    failedAssetReasons?: Record<string, string>;
}

interface MotionBackfillResult {
    html: string | null;
    tracks: number;
    regions: number;
    /** Canvases (WebGL/2D visuals) replaced by recorded frame loops. */
    canvases: number;
    /** Frame images to save under public/_assets/<name>. */
    files: Array<{
        name: string;
        data: Buffer;
    }>;
    reason?: string;
}
/** Scroll animations only (kept for callers of the original API). */
declare function backfillScrollTimeline(previewUrl: string, snapshotHtml: string, opts?: {
    timeoutMs?: number;
}): Promise<MotionBackfillResult>;
/**
 * Record what only the site's JS draws, from its interactive preview, into the saved
 * snapshot: scroll animations (timeline) and canvas visuals (frame loops — e.g. a WebGL
 * gradient background the capture couldn't shoot).
 * @param previewUrl interactive preview of the page (site JS running, served by this API)
 * @param snapshotHtml the saved snapshot to add them to
 */
declare function backfillPageMedia(previewUrl: string, snapshotHtml: string, opts: {
    timeoutMs?: number;
    timeline: boolean;
    canvases: boolean;
}): Promise<MotionBackfillResult>;

interface HelperCaptureOptions {
    /** Output folder for the clone (same layout as a crawler clone). */
    out: string;
    verbose?: boolean;
}
/**
 * Build a clone from a helper bundle. The bundle is sanitized again here and refused if
 * any credential survives (the extension is expected to have stripped them already).
 */
declare function runHelperCapture(rawBundle: unknown, options: HelperCaptureOptions, events?: CloneRunEvents): Promise<CloneRunResult>;

/**
 * Clonyfy Helper bundles: what the browser extension captured in the user's own tab.
 *
 * Only the public, front-end layer may leave the browser (and reach this server): the
 * rendered page, its server HTML, its static files, and the public responses the page
 * rendered from. Never cookies, auth headers, tokens, storage or account data. The
 * extension strips these before sending (extension/sanitize.js); the server strips again
 * here and refuses a bundle that still carries any (see findCredentialLeaks).
 */
interface HelperAsset {
    url: string;
    contentType: string;
    /** base64 bytes read in the user's tab; absent → the server downloads the public file. */
    data?: string;
}
interface HelperNetworkEntry {
    method: string;
    url: string;
    status: number;
    contentType: string;
    body: string | null;
}
interface HelperBundle {
    v: 1;
    /** The page as loaded in the tab (after redirects). */
    url: string;
    title?: string;
    capturedAt?: string;
    /** Main document response as the site served it — what its own JS hydrates. */
    serverHtml: string;
    /** document.documentElement.outerHTML after load + hydration + settle. */
    domSnapshot: string;
    assets: HelperAsset[];
    networkRecord: HelperNetworkEntry[];
}
/**
 * Keep only the fields a bundle may carry, with every credential removed. Unknown
 * fields (cookies, storage, headers…) are dropped by construction.
 */
declare function sanitizeHelperBundle(input: unknown): HelperBundle;
/**
 * Every place a credential could survive in a bundle — empty means clean. The server
 * refuses bundles with leaks; the unit test proves sanitizeHelperBundle leaves none.
 */
declare function findCredentialLeaks(input: unknown): string[];

/** Log line prefix the server reads to offer the Clonyfy Helper for a protected site. */
declare const NEEDS_HELPER_MARKER = "[NEEDS_HELPER]";
interface CloneRunEvents {
    onLog?: (line: string) => void;
    onArtifactWritten?: (event: ArtifactWrittenEvent) => Promise<void>;
}
interface CloneRunResult {
    outDir: string;
    pages: number;
    assets: number;
    apiRoutes: number;
    logFile: string;
}
declare function runClone(options: ClonerOptions, events?: CloneRunEvents): Promise<CloneRunResult>;
interface FinishContext {
    targetOrigin: string;
    capturedPagesDir: string;
    routeMap: Record<string, string>;
    pageFilename: (route: string) => string;
    notifyArtifact: (event: ArtifactWrittenEvent) => Promise<void>;
    rewriteStats: Array<{
        url: string;
        assets: number;
        network: number;
    }>;
}
/**
 * Turn captured page records into a clone: final asset rewrite, server HTML for the
 * interactive preview, preview-mode choice, route map, manifest, API fixtures and the
 * Next.js app. Shared by the crawler path (runClone) and the Clonyfy Helper path
 * (runHelperCapture), so both produce exactly the same output.
 */
declare function finishClone(opts: ClonerOptions, records: PageRecord[], ctx: FinishContext): Promise<CloneRunResult>;
/** Rebuild the Next.js project from persisted manifest + captured HTML (for exports after blob storage). */
declare function regenerateCloneProject(outDir: string): Promise<void>;

export { type CloneRunEvents, type CloneRunResult, type FinishContext, type HelperBundle, type HelperCaptureOptions, type MotionBackfillResult, NEEDS_HELPER_MARKER, backfillPageMedia, backfillScrollTimeline, findCredentialLeaks, finishClone, regenerateCloneProject, runClone, runHelperCapture, sanitizeHelperBundle };
