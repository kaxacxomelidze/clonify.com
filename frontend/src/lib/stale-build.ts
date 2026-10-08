// After a deploy, open tabs still reference the old hashed JS chunks, which no longer
// exist on the server. The next lazy route load then fails and the page shows an error
// until the user refreshes by hand. Detect that and reload once to pick up the new build.

const RELOAD_KEY = "clonyfy:stale-build-reload";
const RELOAD_COOLDOWN_MS = 10_000;

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError|Loading (?:CSS )?chunk [\w-]+ failed/i;

export function isStaleBuildError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : "";
  return CHUNK_ERROR_RE.test(message);
}

/** Reloads the page unless it already did so in the last few seconds (avoids loops). Returns true when reloading. */
export function reloadForStaleBuild(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage blocked: still reload once; the browser's own cache keeps this from looping fast.
  }
  window.location.reload();
  return true;
}

let installed = false;

export function installStaleBuildRecovery(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  // Vite fires this when a preload of a lazy chunk/CSS fails.
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadForStaleBuild()) event.preventDefault();
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (isStaleBuildError(event.reason)) reloadForStaleBuild();
  });
}
