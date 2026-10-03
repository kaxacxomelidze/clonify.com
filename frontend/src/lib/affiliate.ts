// Whop affiliate attribution. Affiliates share links like https://clonyfy.com/?a=<whop-username>;
// the code is kept for Whop's 30-day window and passed to Whop when a checkout is created,
// so Whop credits (and pays) the affiliate's commission.

const STORAGE_KEY = "clonyfy_whop_affiliate";
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

/** Saves `?a=` from the current URL (last click wins). */
export function captureAffiliateCode() {
  try {
    const code = (new URLSearchParams(window.location.search).get("a") || "")
      .trim()
      .replace(/^@/, "");
    if (!CODE_RE.test(code)) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    // Storage blocked (private mode): attribution just isn't kept.
  }
}

/** The affiliate code still inside its window, or undefined. */
export function getAffiliateCode(): string | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as {
      code?: string;
      at?: number;
    } | null;
    if (!saved?.code || !CODE_RE.test(saved.code)) return undefined;
    if (Date.now() - Number(saved.at || 0) > WINDOW_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return undefined;
    }
    return saved.code;
  } catch {
    return undefined;
  }
}
