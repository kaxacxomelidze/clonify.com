import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/shell";
import { DashboardWorkspace } from "@/components/dashboard/workspace";
import { useAuth } from "@/hooks/use-auth";
import { useWhopReturn } from "@/hooks/use-whop-return";
import { ApiError } from "@/lib/api";
import { postAuthDestination } from "@/lib/pending-plan";

const TITLE = "Dashboard — Clonyfy";
const DESCRIPTION =
  "Run clones, track pages captured and assets, and manage your cloned sites inside the Clonyfy dashboard.";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardLayout,
});

function DashboardLayout() {
  const { isAuthenticated, loading, acceptToken, user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [bootstrapping, setBootstrapping] = useState(true);
  // Back from Whop on any app page (Billing handles its own notice).
  const [returnedFromWhop] = useState(
    () =>
      typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).get("whop") === "success" ||
        new URLSearchParams(window.location.search).get("addon") === "success"),
  );
  const whopActivation = useWhopReturn(!pathname.startsWith("/dashboard/billing"));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const oauthToken = params.get("oauth_token");
        if (oauthToken) {
          await acceptToken(oauthToken);
          params.delete("oauth_token");
          const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
          window.history.replaceState({}, "", next);
          if (!cancelled) await navigate(postAuthDestination() as never);
          return;
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof ApiError ? err.message : "Sign-in failed";
          await navigate({ to: "/login", search: { oauth_error: message } as never });
        }
        return;
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [acceptToken, navigate]);

  useEffect(() => {
    if (loading || bootstrapping) return;
    if (!isAuthenticated) {
      void navigate({ to: "/login" });
    }
  }, [loading, bootstrapping, isAuthenticated, navigate]);

  // The client's flow is sign up → guided onboarding → paywall → full access: free accounts
  // use /start. Billing and Settings stay open to them, and so does a page they return to
  // straight after paying (the plan activates a moment later).
  const free = !!user && String(user.plan || "free").toLowerCase() === "free";
  const openToFree =
    /^\/dashboard\/(billing|settings)(\/|$)/.test(pathname) ||
    returnedFromWhop ||
    whopActivation === "activating";
  useEffect(() => {
    if (loading || bootstrapping || !isAuthenticated || !user) return;
    if (free && !openToFree) void navigate({ to: "/start", replace: true });
  }, [loading, bootstrapping, isAuthenticated, user, free, openToFree, navigate]);

  if (loading || bootstrapping || !isAuthenticated || (free && !openToFree)) {
    return <div className="min-h-screen bg-background" aria-busy="true" aria-live="polite" />;
  }

  return (
    <DashboardWorkspace>
      <DashboardShell>
        <Outlet />
      </DashboardShell>
    </DashboardWorkspace>
  );
}
