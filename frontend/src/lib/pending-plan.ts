// A plan picked on the pricing page before signing in. Auth pages keep it for this tab
// (it survives the Google/GitHub redirect), and the first stop after sign-in is checkout.

const KEY = "clonyfy_pending_plan";
const PLANS = ["starter", "growth", "unlimited"] as const;
export type PendingPlan = { plan: (typeof PLANS)[number]; interval: "monthly" | "annual" };

/** Remembers ?plan=…&interval=… from the current URL, if present. */
export function rememberPendingPlan() {
  try {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan") as PendingPlan["plan"] | null;
    if (!plan || !PLANS.includes(plan)) return;
    const interval = params.get("interval") === "annual" ? "annual" : "monthly";
    sessionStorage.setItem(KEY, JSON.stringify({ plan, interval }));
  } catch {
    // Storage blocked: the user just lands on the dashboard.
  }
}

/** Returns and forgets the remembered plan. */
export function takePendingPlan(): PendingPlan | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    const saved = raw ? (JSON.parse(raw) as PendingPlan) : null;
    return saved && PLANS.includes(saved.plan) ? saved : null;
  } catch {
    return null;
  }
}

/** Where to go right after signing in. */
export function postAuthDestination() {
  const pending = takePendingPlan();
  return pending
    ? ({
        to: "/checkout",
        search: {
          plan: pending.plan,
          ...(pending.interval === "annual" ? { interval: "annual" } : {}),
        },
      } as const)
    : ({ to: "/dashboard" } as const);
}
