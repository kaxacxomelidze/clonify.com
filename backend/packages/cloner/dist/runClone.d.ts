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

interface MotionBackfillResult {
    html: string | null;
    tracks: number;
    regions: number;
    reason?: string;
}
/**
 * @param previewUrl interactive preview of the page (site JS running, served by this API)
 * @param snapshotHtml the saved snapshot to add the timeline to
 */
declare function backfillScrollTimeline(previewUrl: string, snapshotHtml: string, opts?: {
    timeoutMs?: number;
}): Promise<MotionBackfillResult>;

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
/** Rebuild the Next.js project from persisted manifest + captured HTML (for exports after blob storage). */
declare function regenerateCloneProject(outDir: string): Promise<void>;

export { type CloneRunEvents, type CloneRunResult, type MotionBackfillResult, backfillScrollTimeline, regenerateCloneProject, runClone };
