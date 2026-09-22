import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Check, CreditCard, Sparkles } from "lucide-react";
import { PLANS, SUBSCRIPTION } from "@/components/dashboard/data";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  ApiError,
  cancelSubscription,
  fetchBillingHistory,
  openStripePortal,
  startStripeCheckout,
} from "@/lib/api";
import { toast } from "sonner";

const TITLE = "Subscription & billing — Clonyfy dashboard";
const DESCRIPTION =
  "View your Clonyfy plan, usage limits, payment method and invoice history, and upgrade at any time.";

export const Route = createFileRoute("/dashboard/billing")({
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
  component: BillingPage,
});

type InvoiceRow = {
  id: string;
  date: string;
  amount: string;
  status: string;
  plan: string;
};

function BillingPage() {
  const { user, usage, refresh } = useAuth();
  const [notice, setNotice] = useState("");
  const [cancelled, setCancelled] = useState(!!user?.cancelAtPeriodEnd);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const planKey = String(user?.plan || "free").toLowerCase();
  const planLabel =
    planKey === "starter"
      ? "Starter"
      : planKey === "unlimited" || planKey === "scale"
        ? "Scale"
        : planKey === "growth" || planKey === "popular" || planKey === "pro"
          ? "Growth"
          : "Free";
  const [previewPlan, setPreviewPlan] = useState(planLabel);

  useEffect(() => {
    setPreviewPlan(planLabel);
    setCancelled(!!user?.cancelAtPeriodEnd);
  }, [planLabel, user?.cancelAtPeriodEnd]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchBillingHistory();
        const rows = (data.payments || []).map((raw) => {
          const p = raw as Record<string, unknown>;
          const amount = Number(p["amount"] ?? 0);
          const currency = String(p["currency"] || "usd").toUpperCase();
          const submitted = p["submitted_at"] || p["processed_at"];
          return {
            id: String(p["id"] || "—"),
            date: submitted
              ? new Date(String(submitted)).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "—",
            amount:
              amount > 0
                ? new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: currency.length === 3 ? currency : "USD",
                  }).format(amount)
                : "—",
            status: String(p["status"] || "pending"),
            plan: String(p["plan"] || "—"),
          };
        });
        setInvoices(rows);
      } catch {
        setInvoices([]);
      }
    })();
  }, []);

  const plans = PLANS.map((plan) => ({ ...plan, current: plan.name === previewPlan }));
  const plan = plans.find((item) => item.current) || PLANS.find((p) => p.name === "Growth") || PLANS[0]!;
  const clonesUsed = usage?.clonesThisMonth ?? 0;
  const clonesLimit = usage?.limits?.clonesPerMonth ?? usage?.limitThisMonth ?? null;
  const liveLimits = [
    {
      label: "Clones this month",
      used: clonesUsed,
      limit: clonesLimit == null ? Math.max(clonesUsed, 1) : clonesLimit,
    },
    {
      label: "Pages captured",
      used: usage?.totalPages ?? 0,
      limit: Math.max(usage?.totalPages ?? 0, user?.planLimits?.maxPages ?? 50),
    },
    {
      label: "Edits",
      used: usage?.editsThisMonth ?? 0,
      limit: usage?.limits?.editsPerMonth ?? 100,
    },
    {
      label: "Shares",
      used: usage?.sharesThisMonth ?? 0,
      limit: usage?.limits?.sharesPerMonth ?? 50,
    },
  ];

  const planApiKey = (name: string) => {
    const n = name.toLowerCase();
    if (n === "scale") return "unlimited";
    if (n === "growth") return "growth";
    if (n === "starter") return "starter";
    return "starter";
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="eyebrow">Account</p>
        <h1 className="mt-2 display-lg">Subscription</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Manage your plan, usage, and billing. Upgrades open Stripe Checkout when payments are
          configured.
        </p>
      </header>
      <p role="status" className="text-sm text-muted-foreground">
        {notice}
      </p>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <motion.section
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="surface sheen halo rounded-3xl p-6 md:p-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Current plan</p>
              <p className="mt-3 font-display text-5xl tracking-tight">{plan.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {plan.price} {plan.cycle} · renews{" "}
                {user?.planRenewsAt
                  ? new Date(user.planRenewsAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : SUBSCRIPTION.renews}
              </p>
            </div>
            <span className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground">
              {cancelled ? "Cancels at period end" : user?.planLabel || "Active"}
            </span>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {liveLimits.map((l, i) => {
              const pct = Math.min(100, Math.round((l.used / Math.max(1, Number(l.limit) || 1)) * 100));
              return (
                <div key={l.label}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{l.label}</span>
                    <span className="font-mono text-xs">
                      {l.used}/{l.limit == null ? "∞" : l.limit}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, delay: 0.15 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full rounded-full bg-foreground"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() =>
                document.getElementById("billing-plans")?.scrollIntoView({ block: "center" })
              }
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03]"
            >
              <Sparkles className="h-4 w-4" />
              Upgrade plan
            </button>
            <button
              onClick={() => {
                void (async () => {
                  try {
                    if (cancelled) {
                      setNotice("Cancellation already scheduled. Use Manage billing to resume.");
                      return;
                    }
                    await cancelSubscription();
                    setCancelled(true);
                    await refresh();
                    setNotice("Subscription will cancel at the end of the billing period.");
                    toast.success("Cancellation scheduled.");
                  } catch (err) {
                    const message =
                      err instanceof ApiError ? err.message : "Could not cancel subscription.";
                    setNotice(message);
                    toast.error(message);
                  }
                })();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm transition-colors hover:bg-accent"
            >
              {cancelled ? "Cancellation scheduled" : "Cancel subscription"}
            </button>
          </div>
        </motion.section>

        <motion.section
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="surface sheen rounded-3xl p-6 md:p-8"
        >
          <p className="eyebrow">Payment method</p>
          <div className="mt-4 flex items-center gap-4 rounded-2xl border border-border p-4">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-accent">
              <CreditCard className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm">Managed in Stripe Customer Portal</span>
              <span className="block text-xs text-muted-foreground">
                Update cards, invoices, and tax details securely
              </span>
            </span>
          </div>
          <button
            onClick={() => {
              void (async () => {
                try {
                  const { url } = await openStripePortal();
                  if (url) window.location.href = url;
                  else toast.error("Billing portal unavailable. Configure Stripe first.");
                } catch (err) {
                  toast.error(
                    err instanceof ApiError ? err.message : "Could not open billing portal.",
                  );
                }
              })();
            }}
            className="mt-4 w-full rounded-full border border-border py-3 text-sm transition-colors hover:bg-accent"
          >
            Manage billing
          </button>

          <p className="eyebrow mt-8">Billing contact</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Email</span>
              <span className="truncate">{user?.email || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Plan</span>
              <span>{user?.planLabel || planLabel}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Next charge</span>
              <span>
                {plan.price}
                {user?.planRenewsAt
                  ? ` · ${new Date(user.planRenewsAt).toLocaleDateString("en-US")}`
                  : ""}
              </span>
            </div>
          </div>
        </motion.section>
      </div>

      <div id="billing-plans" className="grid gap-6 md:grid-cols-3">
        {plans.map((p, i) => (
          <motion.div
            key={p.name}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "surface sheen rounded-3xl p-6",
              p.current && "ring-1 ring-foreground/40",
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm">{p.name}</p>
              {p.current && (
                <span className="rounded-full bg-primary px-3 py-1 text-[0.65rem] uppercase tracking-widest text-primary-foreground">
                  Current
                </span>
              )}
            </div>
            <p className="mt-4 font-display text-4xl tracking-tight">{p.price}</p>
            <p className="text-xs text-muted-foreground">{p.cycle}</p>
            <ul className="mt-6 space-y-3">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              disabled={p.current}
              onClick={() => {
                void (async () => {
                  setPreviewPlan(p.name);
                  setCancelled(false);
                  if (p.name === "Free" || planApiKey(p.name) === String(user?.plan || "")) {
                    setNotice(`Showing ${p.name}.`);
                    return;
                  }
                  try {
                    const { url } = await startStripeCheckout(planApiKey(p.name), "monthly");
                    if (url) {
                      window.location.href = url;
                      return;
                    }
                    setNotice("Checkout did not return a URL.");
                    toast.error("Checkout unavailable. Configure Stripe keys on the Backend.");
                  } catch (err) {
                    const message =
                      err instanceof ApiError
                        ? err.message
                        : `Could not start checkout for ${p.name}.`;
                    setNotice(message);
                    toast.error(message);
                  }
                })();
              }}
              className={cn(
                "mt-7 w-full rounded-full py-3 text-sm transition-colors",
                p.current
                  ? "cursor-default border border-border text-muted-foreground"
                  : "bg-primary font-medium text-primary-foreground hover:opacity-90",
              )}
            >
              {p.current ? "Your plan" : `Upgrade to ${p.name}`}
            </button>
          </motion.div>
        ))}
      </div>

      <motion.section
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="surface sheen overflow-x-auto rounded-3xl p-5 md:p-6"
      >
        <h2 className="mb-5 text-base font-medium tracking-tight">Invoices</h2>
        {invoices.length ? (
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                <th className="pb-3 font-normal">Invoice</th>
                <th className="pb-3 font-normal">Date</th>
                <th className="pb-3 font-normal">Plan</th>
                <th className="pb-3 font-normal">Amount</th>
                <th className="pb-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-border">
                  <td className="py-3 pr-4 font-mono text-xs">{inv.id}</td>
                  <td className="py-3 pr-4">{inv.date}</td>
                  <td className="py-3 pr-4">{inv.plan}</td>
                  <td className="py-3 pr-4">{inv.amount}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{inv.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">
            No invoices yet.{" "}
            <Link to="/dashboard/billing" className="underline underline-offset-4">
              Upgrade a plan
            </Link>{" "}
            to start billing history, or open Manage billing for Stripe receipts.
          </p>
        )}
      </motion.section>
    </div>
  );
}
