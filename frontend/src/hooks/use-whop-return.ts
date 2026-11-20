import { useEffect, useState } from "react";
import { syncWhopCheckout } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export type WhopReturnState = "none" | "activating" | "active" | "pending";

function hasWhopReturn() {
  return (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("whop") === "success"
  );
}

/**
 * Back from Whop checkout (`?whop=success`): activate the plan right away instead of
 * waiting for the webhook, then refresh the signed-in user. Returns where that stands.
 */
export function useWhopReturn(enabled = true): WhopReturnState {
  const { refresh } = useAuth();
  const [returned] = useState(hasWhopReturn);
  const [state, setState] = useState<WhopReturnState>(returned ? "activating" : "none");

  useEffect(() => {
    if (!returned || !enabled) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("whop")) {
      params.delete("whop");
      const rest = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${rest ? `?${rest}` : ""}`,
      );
    }
    let cancelled = false;
    void (async () => {
      for (let attempt = 0; attempt < 10 && !cancelled; attempt++) {
        const res = await syncWhopCheckout().catch(() => null);
        if (res?.user?.plan && String(res.user.plan).toLowerCase() !== "free") {
          await refresh().catch(() => {});
          if (!cancelled) setState("active");
          return;
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      await refresh().catch(() => {});
      if (!cancelled) setState("pending");
    })();
    return () => {
      cancelled = true;
    };
  }, [returned, enabled, refresh]);

  return state;
}
