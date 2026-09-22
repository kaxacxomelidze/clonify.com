import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/shell";
import { DashboardWorkspace } from "@/components/dashboard/workspace";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";

const TITLE = "Dashboard — Clonyfy";
const DESCRIPTION =
  "Run clones, track pages captured and assets, and manage your cloned site library inside the Clonyfy dashboard.";

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
  const { isAuthenticated, loading, acceptToken } = useAuth();
  const navigate = useNavigate();
  const [bootstrapping, setBootstrapping] = useState(true);

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
          if (!cancelled) await navigate({ to: "/dashboard" });
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

  if (loading || bootstrapping || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background" aria-busy="true" aria-live="polite" />
    );
  }

  return (
    <DashboardWorkspace>
      <DashboardShell>
        <Outlet />
      </DashboardShell>
    </DashboardWorkspace>
  );
}
