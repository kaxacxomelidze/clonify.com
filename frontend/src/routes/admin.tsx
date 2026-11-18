import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Loader2, LogOut, RefreshCw } from "lucide-react";
import {
  ApiError,
  adminLogin,
  fetchAdminFunnel,
  fetchAdminStats,
  getAdminToken,
  setAdminToken,
  type AdminStats,
  type FunnelRow,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — Clonyfy" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminPage,
});

const FUNNEL_LABELS: Record<string, string> = {
  landing_view: "Landing page views",
  signup_view: "Sign-up views",
  onboarding: "Onboarding",
  paywall_view: "Paywall views",
  purchase_view: "Purchase views",
  churn: "Churn",
};

function money(n: number) {
  return `$${(Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (d = days) => {
      setLoading(true);
      setError("");
      try {
        const [s, f] = await Promise.all([fetchAdminStats(), fetchAdminFunnel(d)]);
        setStats(s);
        setFunnel(f.funnel);
        setAuthed(true);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setAdminToken(null);
          setAuthed(false);
        } else {
          setError(err instanceof ApiError ? err.message : "Couldn't load data.");
        }
      } finally {
        setLoading(false);
      }
    },
    [days],
  );

  useEffect(() => {
    if (getAdminToken()) void load();
  }, [load]);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginBusy(true);
    try {
      await adminLogin(password);
      setPassword("");
      await load();
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : "Login failed.");
    } finally {
      setLoginBusy(false);
    }
  }

  if (!authed) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
        <form
          onSubmit={onLogin}
          className="w-full max-w-sm rounded-2xl border border-border bg-accent/20 p-6"
        >
          <h1 className="text-lg font-semibold">Clonyfy admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter the admin password to continue.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            autoFocus
            className="mt-5 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground/40"
          />
          {loginError && <p className="mt-3 text-sm text-destructive">{loginError}</p>}
          <button
            type="submit"
            disabled={loginBusy || !password}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-sm font-semibold text-background disabled:opacity-60"
          >
            {loginBusy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
          </button>
        </form>
      </main>
    );
  }

  const landing = funnel.find((f) => f.name === "landing_view")?.uniques || 0;
  const cards: Array<{ label: string; value: string }> = stats
    ? [
        { label: "Total users", value: String(stats.totalUsers) },
        { label: "MRR", value: money(stats.mrr) },
        { label: "ARR", value: money(stats.arr) },
        { label: "Revenue (month)", value: money(stats.monthRevenue) },
        { label: "Revenue (total)", value: money(stats.totalRevenue) },
        { label: "Total clones", value: String(stats.totalClones) },
        { label: "Active clones now", value: String(stats.activeNow) },
        { label: "Blocked users", value: String(stats.blockedUsers) },
        { label: "Starter / Growth / Pro", value: `${stats.starterUsers} / ${stats.growthUsers} / ${stats.unlimitedUsers}` },
      ]
    : [];

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Admin dashboard</h1>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => {
                const d = Number(e.target.value);
                setDays(d);
                void load(d);
              }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={() => void load()}
              className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent"
              aria-label="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
            <button
              onClick={() => {
                setAdminToken(null);
                setAuthed(false);
              }}
              className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-border p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{c.value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="h-4 w-4" /> Funnel (last {days} days)
          </h2>
          <div className="mt-3 space-y-2">
            {funnel.map((f) => {
              const pct = landing ? Math.round((f.uniques / landing) * 100) : 0;
              return (
                <div key={f.name} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>{FUNNEL_LABELS[f.name] || f.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {f.uniques} unique · {f.total} total
                      {f.name !== "landing_view" && landing ? ` · ${pct}%` : ""}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-accent">
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{ width: `${Math.min(100, pct || (f.uniques ? 4 : 0))}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {!funnel.some((f) => f.total > 0) && (
              <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
                No events recorded yet in this window.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
