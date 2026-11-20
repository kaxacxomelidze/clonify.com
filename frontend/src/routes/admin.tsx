import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  ApiError,
  adminLogin,
  fetchAdminFunnel,
  fetchAdminList,
  fetchAdminStats,
  getAdminToken,
  setAdminToken,
  type AdminCloneRow,
  type AdminErrorRow,
  type AdminPaymentRow,
  type AdminStats,
  type AdminUserRow,
  type FunnelRow,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — Clonyfy" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminPage,
});

/** The client's funnel, in order (event names as sent to Mixpanel). */
const FUNNEL_LABELS: Record<string, string> = {
  landing_view: "Landing page views",
  signup_view: "Sign-up views",
  signup_completed: "Sign-ups completed",
  onboarding_started: "Onboarding started",
  onboarding_completed: "Onboarding completed (clicked Export)",
  paywall_viewed: "Paywall views",
  purchase_view: "Purchase (checkout page) views",
  checkout_started: "Checkouts started",
  purchase_completed: "Purchases completed (Whop)",
  churn: "Churn (subscription cancelled)",
  churn_reverted: "Cancellations reverted",
  subscription_renewed: "Renewals",
  subscription_ended: "Subscriptions ended",
};

type Tab = "overview" | "users" | "payments" | "clones" | "errors";
const TABS: Array<[Tab, string]> = [
  ["overview", "Overview"],
  ["users", "Users"],
  ["payments", "Payments"],
  ["clones", "Clones"],
  ["errors", "Errors"],
];

function money(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.length === 3 ? currency.toUpperCase() : "USD",
      maximumFractionDigits: 2,
    }).format(Number(n) || 0);
  } catch {
    return `$${(Number(n) || 0).toFixed(2)}`;
  }
}
function when(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!getAdminToken()) {
      setChecking(false);
      return;
    }
    fetchAdminStats()
      .then(() => setAuthed(true))
      .catch(() => setAdminToken(null))
      .finally(() => setChecking(false));
  }, []);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginBusy(true);
    try {
      await adminLogin(password);
      setPassword("");
      setAuthed(true);
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : "Login failed.");
    } finally {
      setLoginBusy(false);
    }
  }

  const onUnauthorized = useCallback(() => {
    setAdminToken(null);
    setAuthed(false);
  }, []);

  if (checking) return <main className="min-h-screen bg-background" aria-busy="true" />;

  if (!authed) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
        <form
          onSubmit={onLogin}
          className="w-full max-w-sm rounded-2xl border border-border bg-accent/20 p-6"
        >
          <h1 className="text-lg font-semibold">Clonyfy admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the admin password to continue.
          </p>
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

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Admin dashboard</h1>
          <button
            onClick={onUnauthorized}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-accent"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </header>
        <nav
          className="mt-6 flex gap-1 overflow-x-auto border-b border-border"
          aria-label="Admin sections"
        >
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm transition-colors",
                tab === id
                  ? "border-foreground font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-6">
          {tab === "overview" && <Overview onUnauthorized={onUnauthorized} />}
          {tab === "users" && (
            <AdminTable<AdminUserRow>
              kind="users"
              firstPage={0}
              searchPlaceholder="Search name or email"
              filters={[
                {
                  key: "plan",
                  label: "Plan",
                  options: [
                    ["", "All plans"],
                    ["free", "Free"],
                    ["starter", "Starter"],
                    ["growth", "Growth"],
                    ["unlimited", "Pro"],
                  ],
                },
              ]}
              columns={[
                [
                  "User",
                  (u) => (
                    <span>
                      <span className="block font-medium">{u.name}</span>
                      <span className="block text-xs text-muted-foreground">{u.email}</span>
                    </span>
                  ),
                ],
                [
                  "Plan",
                  (u) => `${u.planLabel}${u.plan !== "free" ? ` · ${u.billingInterval}` : ""}`,
                ],
                ["Renews", (u) => when(u.planRenewsAt)],
                ["Clones", (u) => u.cloneCount],
                ["Last clone", (u) => when(u.lastCloneAt)],
                ["Signed up", (u) => when(u.createdAt)],
                ["Status", (u) => (u.blocked ? "Blocked" : "Active")],
              ]}
              onUnauthorized={onUnauthorized}
            />
          )}
          {tab === "payments" && (
            <AdminTable<AdminPaymentRow>
              kind="payments"
              firstPage={1}
              filters={[
                {
                  key: "status",
                  label: "Status",
                  options: [
                    ["", "All statuses"],
                    ["confirmed", "Confirmed"],
                    ["pending", "Pending (checkout opened)"],
                    ["failed", "Failed"],
                    ["rejected", "Rejected"],
                  ],
                },
              ]}
              columns={[
                ["Date", (p) => when(p.processedAt || p.submittedAt)],
                [
                  "Customer",
                  (p) => (
                    <span>
                      <span className="block font-medium">{p.userName}</span>
                      <span className="block text-xs text-muted-foreground">{p.userEmail}</span>
                    </span>
                  ),
                ],
                [
                  "Type",
                  (p) =>
                    /^Add-on/i.test(p.note || "")
                      ? "Add-on +15 clones"
                      : /downsell/i.test(p.note || "")
                        ? "Downsell"
                        : `${p.plan === "unlimited" ? "Pro" : p.plan.charAt(0).toUpperCase() + p.plan.slice(1)} · ${p.interval}`,
                ],
                ["Amount", (p) => money(p.amount, p.currency)],
                ["Status", (p) => p.status],
                ["Whop id", (p) => <span className="font-mono text-xs">{p.txId || "—"}</span>],
              ]}
              onUnauthorized={onUnauthorized}
            />
          )}
          {tab === "clones" && (
            <AdminTable<AdminCloneRow>
              kind="clones"
              firstPage={1}
              searchPlaceholder="Search URL or user"
              filters={[
                {
                  key: "status",
                  label: "Status",
                  options: [
                    ["", "All statuses"],
                    ["done", "Done"],
                    ["running", "Running"],
                    ["error", "Error"],
                  ],
                },
              ]}
              columns={[
                ["Website", (c) => <span className="break-all">{c.url}</span>],
                ["User", (c) => c.userName],
                ["Status", (c) => c.status],
                ["Pages", (c) => c.pages ?? 0],
                ["Assets", (c) => c.assets ?? 0],
                ["Started", (c) => when(c.startedAt)],
              ]}
              onUnauthorized={onUnauthorized}
            />
          )}
          {tab === "errors" && (
            <AdminTable<AdminErrorRow>
              kind="errors"
              firstPage={1}
              searchPlaceholder="Search errors"
              columns={[
                ["When", (e) => when(e.failedAt)],
                ["User", (e) => e.userName || "—"],
                ["Where", (e) => <span className="break-all">{e.url}</span>],
                ["Error", (e) => <span className="break-words text-xs">{e.errorSummary}</span>],
              ]}
              onUnauthorized={onUnauthorized}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function Overview({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [retention, setRetention] = useState<FunnelRow[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (d: number) => {
      setLoading(true);
      setError("");
      try {
        const [s, f] = await Promise.all([fetchAdminStats(), fetchAdminFunnel(d)]);
        setStats(s);
        setFunnel(f.funnel);
        setRetention(f.retention || []);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) onUnauthorized();
        else setError(err instanceof ApiError ? err.message : "Couldn't load data.");
      } finally {
        setLoading(false);
      }
    },
    [onUnauthorized],
  );

  useEffect(() => {
    void load(days);
  }, [load, days]);

  const landing = funnel.find((f) => f.name === "landing_view")?.uniques || 0;
  const cards: Array<{ label: string; value: string }> = stats
    ? [
        { label: "Total users", value: String(stats.totalUsers) },
        {
          label: "Paying: Starter / Growth / Pro",
          value: `${stats.starterUsers} / ${stats.growthUsers} / ${stats.unlimitedUsers}`,
        },
        { label: "MRR", value: money(stats.mrr) },
        { label: "ARR", value: money(stats.arr) },
        { label: "Revenue (this month)", value: money(stats.monthRevenue) },
        { label: "Revenue (all time)", value: money(stats.totalRevenue) },
        { label: "Annual subscribers", value: String(stats.annualSubscribers ?? 0) },
        { label: "Cancellations scheduled", value: String(stats.cancellationsScheduled ?? 0) },
        { label: "Purchases (30 days)", value: String(stats.purchases30d ?? 0) },
        { label: "Churn (30 days)", value: String(stats.churn30d ?? 0) },
        { label: "Add-on sales", value: String(stats.addonSales ?? 0) },
        { label: "Downsell sales", value: String(stats.downsellSales ?? 0) },
        { label: "Total clones", value: String(stats.totalClones) },
        { label: "Clones running now", value: String(stats.activeNow) },
        { label: "Errors logged", value: String(stats.totalErrors) },
        { label: "Blocked users", value: String(stats.blockedUsers) },
      ]
    : [];

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          aria-label="Period"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <button
          onClick={() => void load(days)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent"
          aria-label="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-border p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
        <p className="mt-1 text-xs text-muted-foreground">
          Unique visitors per step. % = share of landing-page visitors; the step-to-step rate is in
          brackets.
        </p>
        <div className="mt-3 space-y-2">
          {funnel.map((f, i) => {
            const pct = landing ? Math.round((f.uniques / landing) * 1000) / 10 : 0;
            const prev = i > 0 ? funnel[i - 1]?.uniques || 0 : 0;
            const step = prev ? Math.round((f.uniques / prev) * 1000) / 10 : null;
            return (
              <div key={f.name} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {FUNNEL_LABELS[f.name] || f.name}{" "}
                    <span className="font-mono text-[11px] text-muted-foreground">{f.name}</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {f.uniques} unique · {f.total} total
                    {i > 0 && landing ? ` · ${pct}%` : ""}
                    {step !== null ? ` (${step}%)` : ""}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-accent">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{
                      width: `${i === 0 ? (f.uniques ? 100 : 0) : Math.min(100, pct || (f.uniques ? 2 : 0))}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {retention.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Subscriptions (last {days} days)</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {retention.map((r) => (
              <div key={r.name} className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">{FUNNEL_LABELS[r.name] || r.name}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{r.total}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

type Column<T> = [string, (row: T) => ReactNode];
type Filter = { key: string; label: string; options: Array<[string, string]> };

function AdminTable<T extends { id: string }>({
  kind,
  firstPage,
  columns,
  filters = [],
  searchPlaceholder,
  onUnauthorized,
}: {
  kind: "users" | "payments" | "clones" | "errors";
  /** The users endpoint counts pages from 0, the others from 1. */
  firstPage: 0 | 1;
  columns: Array<Column<T>>;
  filters?: Filter[];
  searchPlaceholder?: string;
  onUnauthorized: () => void;
}) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState<number>(firstPage);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdminList<T>(kind, {
        page,
        ...(query ? { search: query } : {}),
        ...values,
      });
      setRows(data.rows);
      setTotal(data.total);
      setPageSize(data.pageSize || 50);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      else setError(err instanceof ApiError ? err.message : "Couldn't load data.");
    } finally {
      setLoading(false);
    }
  }, [kind, page, query, values, onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const index = page - firstPage; // 0-based

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {searchPlaceholder && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(firstPage);
              setQuery(search.trim());
            }}
            className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-border px-3"
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </form>
        )}
        {filters.map((f) => (
          <select
            key={f.key}
            value={values[f.key] || ""}
            onChange={(e) => {
              setPage(firstPage);
              setValues((v) => ({ ...v, [f.key]: e.target.value }));
            }}
            aria-label={f.label}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
          >
            {f.options.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ))}
        <button
          onClick={() => void load()}
          className="ml-auto grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent"
          aria-label="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-border p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-accent/40 text-xs text-muted-foreground">
            <tr>
              {columns.map(([label]) => (
                <th key={label} className="px-3 py-2.5 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                {columns.map(([label, cell]) => (
                  <td key={label} className="px-3 py-2.5">
                    {cell(row)}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  Nothing here yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {total} total · page {index + 1} of {pages}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={index <= 0}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-accent disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={index + 1 >= pages}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-accent disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
