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

interface ImportOptions {
    file: string;
    /** URL the page was saved from; optional when the file records it. */
    url?: string;
    out: string;
    verbose?: boolean;
}
interface SavedResource {
    data: Buffer;
    contentType: string;
}
interface ParsedSavedPage {
    html: string;
    /** Original page URL if the file records it (MHTML Content-Location, "saved from url"). */
    sourceUrl: string | null;
    /** Resources keyed by absolute URL (MHTML) or by path relative to the HTML (ZIP). */
    resources: Map<string, SavedResource>;
    /** ZIP only: directory of the main HTML inside the archive ('' = root). */
    htmlDir?: string;
    format: 'mhtml' | 'zip' | 'html';
}
/** Chrome/Edge stamp "<!-- saved from url=(0042)https://… -->" on saved pages. */
declare function savedFromUrl(html: string): string | null;
declare function parseSavedPage(raw: Buffer, fileName: string): ParsedSavedPage;
declare function runImport(options: ImportOptions): Promise<{
    outDir: string;
    pages: number;
    assets: number;
    apiRoutes: number;
}>;

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

export { type CloneRunEvents, type CloneRunResult, parseSavedPage, regenerateCloneProject, runClone, runImport, savedFromUrl };
