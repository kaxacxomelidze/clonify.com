import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Code2,
  Copy,
  Figma,
  Headphones,
  LayoutTemplate,
  Lock,
  PenTool,
  Plug,
} from "lucide-react";
import { BrandMark } from "@/components/site/brand";
import { PLAN_RANK, PLANS } from "@/components/dashboard/data";
import { useAuth } from "@/hooks/use-auth";
import { ApiError, startWhopCheckout } from "@/lib/api";
import { cn } from "@/lib/utils";

const TITLE = "Configure your plan — Clonyfy";

type PlanKey = "starter" | "growth" | "unlimited";
const PLAN_KEYS: PlanKey[] = ["starter", "growth", "unlimited"];
type Interval = "monthly" | "annual";

/** Yearly billing is 12 months at 20% off — the same prices as the Whop yearly plans. */
function yearlyTotal(monthly: number) {
  return Math.round(monthly * 12 * 0.8 * 100) / 100;
}

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: TITLE }, { name: "robots", content: "noindex" }] }),
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    plan?: PlanKey | undefined;
    interval?: Interval | undefined;
    status?: string | undefined;
  } => ({
    plan: PLAN_KEYS.includes(search["plan"] as PlanKey) ? (search["plan"] as PlanKey) : undefined,
    interval: search["interval"] === "annual" ? "annual" : undefined,
    status: typeof search["status"] === "string" ? search["status"] : undefined,
  }),
  component: CheckoutPage,
});

/** The summary card's "top features", with an icon each. */
const TOP_FEATURES: Record<PlanKey, Array<{ icon: typeof Check; text: string }>> = {
  starter: [
    { icon: Copy, text: "10 website clones every month" },
    { icon: Code2, text: "Code & ZIP export" },
    { icon: PenTool, text: "Visual builder & editor" },
    { icon: Headphones, text: "Support 6 days a week" },
  ],
  growth: [
    { icon: Copy, text: "25 website clones every month" },
    { icon: Figma, text: "Figma export" },
    { icon: LayoutTemplate, text: "Access to templates" },
    { icon: Plug, text: "API access" },
  ],
  unlimited: [
    { icon: Copy, text: "Unlimited website clones" },
    { icon: Figma, text: "Figma export & templates" },
    { icon: Plug, text: "API access" },
    { icon: Headphones, text: "Priority support 7 days a week" },
  ],
};

type WhopCheckoutElement = { mount: (target: HTMLElement) => void; destroy?: () => void };
type WhopCheckoutGroup = {
  create: (kind: "checkout", props?: Record<string, unknown>) => WhopCheckoutElement;
  destroy?: () => void;
};
type WhopElementsFactory = (options?: unknown) => {
  checkout: { create: (options: Record<string, unknown>) => WhopCheckoutGroup };
};

/**
 * Stripe-style compact form inside Whop's frame (Whop applies only a safe subset of CSS).
 * Whop's own summary, email and company checkbox are hidden: the left column and the
 * signed-in email cover them.
 */
const CHECKOUT_CLASSES: Record<string, Record<string, string>> = {
  "whop-CheckoutDetails": { display: "none" },
  "whop-CheckoutCollection": { background: "transparent", padding: "0" },
  "whop-Email": { display: "none" },
  "whop-CheckoutCompanyPurchase": { display: "none" },
  "whop-Payment": { background: "transparent", border: "none", padding: "0" },
  "whop-PaymentMethods": { border: "none", background: "transparent", padding: "0", gap: "10px" },
  "whop-PaymentMethodRow": {
    minHeight: "44px",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #2a2a2a",
    background: "transparent",
  },
  "whop-PaymentMethodRowSelected": { border: "1px solid #3a3a3a", background: "#141414" },
  "whop-PaymentMethodRadio": { display: "none" },
  "whop-PaymentMethodLabel": { fontSize: "14px", fontWeight: "500" },
  "whop-PaymentMethodDetail": { padding: "0", border: "none", background: "transparent" },
  "whop-PaymentDetailRegion": { padding: "16px 0 0", border: "none", background: "transparent" },
  "whop-CardLabel": { fontSize: "13px", color: "#a1a1a1", fontWeight: "500" },
  "whop-CardFieldGroup": {
    borderRadius: "10px",
    border: "1px solid #2a2a2a",
    background: "#0f0f0f",
  },
  "whop-CardFieldInput": { minHeight: "44px", fontSize: "15px" },
  "whop-PaymentBillingBlock": { border: "none", padding: "0", background: "transparent" },
  "whop-AddressField": { background: "#0f0f0f" },
  "whop-AddressFieldInput": { minHeight: "44px", fontSize: "15px", background: "transparent" },
  "whop-AddressFieldSelect": { minHeight: "44px", fontSize: "15px", background: "transparent" },
  "whop-AddressManualEntry": { fontSize: "12px", color: "#8a8a8a" },
  "whop-CheckoutExpressButtons": { gap: "10px" },
  "whop-CheckoutExpressDivider": { color: "#7a7a7a", fontSize: "12px" },
  "whop-CheckoutPayButton": {
    background: "#fafafa",
    color: "#0a0a0a",
    borderRadius: "10px",
    minHeight: "48px",
    fontSize: "15px",
    fontWeight: "600",
  },
  "whop-CheckoutTerms": { fontSize: "12px", color: "#8a8a8a" },
};

const ELEMENTS_SRC = "https://cdn.whop.com/elements/amber/elements.js";
let elementsLoader: Promise<WhopElementsFactory> | null = null;

/** Loads Whop Elements once; card data is entered in Whop's own frames, never on our page. */
function loadWhopElements(): Promise<WhopElementsFactory> {
  const w = window as unknown as { WhopElements?: WhopElementsFactory };
  if (w.WhopElements) return Promise.resolve(w.WhopElements);
  elementsLoader ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = ELEMENTS_SRC;
    script.async = true;
    script.setAttribute("data-whop-elements", "");
    script.onload = () =>
      w.WhopElements ? resolve(w.WhopElements) : reject(new Error("Whop failed to load"));
    script.onerror = () => {
      elementsLoader = null;
      reject(new Error("Whop failed to load"));
    };
    document.head.appendChild(script);
  });
  return elementsLoader;
}

function CheckoutPage() {
  const { plan: requestedPlan, interval: requestedInterval, status } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading, isAuthenticated } = useAuth();
  const userRank = PLAN_RANK[String(user?.plan || "free").toLowerCase()] ?? 0;

  const buyable = useMemo(
    () => PLAN_KEYS.filter((key) => (PLAN_RANK[key] ?? 0) > userRank),
    [userRank],
  );
  const [selected, setSelected] = useState<PlanKey | null>(null);
  const [interval, setBillingInterval] = useState<Interval>(requestedInterval ?? "monthly");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [error, setError] = useState("");
  const [mounting, setMounting] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) void navigate({ to: "/login" });
  }, [loading, isAuthenticated, navigate]);

  // Pick the requested plan if it's an upgrade, otherwise the next plan up.
  useEffect(() => {
    if (loading || !user) return;
    setSelected((current) => {
      if (current && buyable.includes(current)) return current;
      if (requestedPlan && buyable.includes(requestedPlan)) return requestedPlan;
      return buyable[0] ?? null;
    });
  }, [loading, user, buyable, requestedPlan]);

  // Back from an off-site payment step (3DS, bank page): only "succeeded" counts as paid.
  useEffect(() => {
    if (status === "succeeded")
      void navigate({ to: "/dashboard/billing", search: { whop: "success" } as never });
    else if (status === "failed")
      setError(
        "The payment didn't go through. You weren't charged — try again or use another card.",
      );
    else if (status === "canceled")
      setError("Payment was canceled. You can try again whenever you're ready.");
  }, [status, navigate]);

  // Mount Whop's checkout for the selected plan; a new plan needs a new checkout.
  useEffect(() => {
    const target = mountRef.current;
    if (!selected || !target) return;
    let cancelled = false;
    let group: WhopCheckoutGroup | null = null;
    let element: WhopCheckoutElement | null = null;
    setMounting(true);
    setCheckoutUrl("");
    target.innerHTML = "";
    void (async () => {
      try {
        const res = await startWhopCheckout(selected, interval);
        if (cancelled) return;
        setCheckoutUrl(res.url);
        if (!res.checkoutId) throw new Error("no embedded checkout");
        const WhopElements = await loadWhopElements();
        if (cancelled) return;
        const checkoutGroup = WhopElements().checkout.create({
          checkoutConfiguration: res.checkoutId,
          returnUrl: `${window.location.origin}/checkout?plan=${selected}&interval=${interval}`,
          appearance: {
            theme: { appearance: "dark", accentColor: "gray", grayColor: "gray" },
            variables: { "--radius": "10px" },
            // Big filled fields, method tiles and a white pill button. Whop's own summary
            // and email field are hidden: our summary card and the signed-in email cover them.
            classes: CHECKOUT_CLASSES,
          },
          onComplete: () => {
            void navigate({ to: "/dashboard/billing", search: { whop: "success" } as never });
          },
        });
        group = checkoutGroup;
        const checkoutElement = checkoutGroup.create("checkout", {
          buyerEmail: user?.email || "",
          lockBuyerEmail: true,
          onReady: () => !cancelled && setMounting(false),
          onError: () => {
            if (!cancelled) {
              setMounting(false);
              setError("The secure card form couldn't load here. Continue on Whop instead.");
            }
          },
        });
        element = checkoutElement;
        checkoutElement.mount(target);
      } catch (err) {
        if (cancelled) return;
        setMounting(false);
        if (err instanceof ApiError) setError(err.message);
        else setError("The secure card form couldn't load here. Continue on Whop instead.");
      }
    })();
    return () => {
      cancelled = true;
      element?.destroy?.();
      group?.destroy?.();
    };
  }, [selected, interval, user?.email, navigate]);

  const plan = PLANS.find((p) => p.key === selected) ?? PLANS[0]!;
  const planKey = plan.key as PlanKey;
  const monthly = Number(plan.price.replace("$", ""));
  const yearly = interval === "annual";
  const price = (yearly ? yearlyTotal(monthly) : monthly).toFixed(2);
  const saving = (monthly * 12 - yearlyTotal(monthly)).toFixed(2);
  const goBack = () =>
    window.history.length > 1 ? window.history.back() : void navigate({ to: "/dashboard/billing" });

  return (
    <main className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-2">
      {/* Order summary — Stripe Checkout layout: what you buy on the left, how you pay on the right. */}
      <section className="px-5 pb-8 pt-6 sm:px-8 lg:flex lg:justify-end lg:px-16 lg:py-14">
        <div className="mx-auto w-full max-w-[420px] lg:mx-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="-ml-2 grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-[18px] w-[18px]" />
            </button>
            <Link to="/" aria-label="Clonyfy home" className="flex items-center gap-2">
              <BrandMark className="h-6 w-6" />
              <span className="text-sm font-medium">Clonyfy</span>
            </Link>
          </div>

          <p className="mt-10 text-[15px] text-muted-foreground">
            Subscribe to Clonyfy {plan.name}
          </p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-[2.5rem] font-semibold leading-none tracking-tight">
              ${price}
            </span>
            <span className="pb-1 text-sm leading-tight text-muted-foreground">
              per
              <br />
              {yearly ? "year" : "month"}
            </span>
          </div>
          {yearly && (
            <p className="mt-2 text-sm text-muted-foreground">
              ${(yearlyTotal(monthly) / 12).toFixed(2)}/month · you save ${saving} a year
            </p>
          )}

          <div
            role="radiogroup"
            aria-label="Billing period"
            className="mt-6 inline-grid grid-cols-2 gap-1 rounded-xl border border-border p-1"
          >
            {(["monthly", "annual"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={interval === value}
                onClick={() => {
                  setError("");
                  setBillingInterval(value);
                }}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-sm transition-colors",
                  interval === value
                    ? "bg-foreground font-medium text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value === "monthly" ? "Monthly" : "Yearly −20%"}
              </button>
            ))}
          </div>

          <div
            role="radiogroup"
            aria-label="Plan"
            className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-border p-1"
          >
            {PLANS.map((p) => {
              const key = p.key as PlanKey;
              const rank = PLAN_RANK[key] ?? 0;
              const locked = rank <= userRank;
              const active = key === selected;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={locked}
                  title={
                    locked
                      ? rank === userRank
                        ? "Your current plan"
                        : "Included in your plan"
                      : undefined
                  }
                  onClick={() => {
                    setError("");
                    setSelected(key);
                  }}
                  className={cn(
                    "rounded-lg px-2 py-2 text-sm transition-colors",
                    active
                      ? "bg-foreground font-medium text-background"
                      : "text-muted-foreground hover:text-foreground",
                    locked &&
                      "cursor-not-allowed line-through opacity-40 hover:text-muted-foreground",
                  )}
                >
                  {p.name}
                </button>
              );
            })}
          </div>

          <ul className="mt-8 space-y-3">
            {TOP_FEATURES[planKey].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                {text}
              </li>
            ))}
          </ul>

          <dl className="mt-8 space-y-3 border-t border-border pt-6 text-sm">
            <div className="flex justify-between gap-4">
              <dt>
                Clonyfy {plan.name}
                <span className="block text-xs text-muted-foreground">
                  {yearly ? "Billed yearly" : "Billed monthly"}
                </span>
              </dt>
              <dd>${price}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-3">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>${price}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="text-muted-foreground">Calculated at payment</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-3 font-medium">
              <dt>Total due today</dt>
              <dd>${price} + tax</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Payment */}
      <section className="border-t border-border bg-[#0b0b0b] px-5 py-8 sm:px-8 lg:border-l lg:border-t-0 lg:px-16 lg:py-14">
        <div className="mx-auto w-full max-w-[420px] lg:mx-0">
          <h1 className="text-lg font-medium">Pay with card</h1>
          <p className="mt-1 text-xs text-muted-foreground">Signed in as {user?.email}</p>

          {!selected && !loading ? (
            <p className="mt-6 rounded-xl border border-border p-4 text-sm text-muted-foreground">
              You're on Scale, our top plan — there's nothing to upgrade to.{" "}
              <Link
                to="/dashboard/billing"
                className="text-foreground underline underline-offset-4"
              >
                Back to billing
              </Link>
            </p>
          ) : (
            <>
              {error && (
                <div role="alert" className="mt-6 rounded-xl border border-border p-4 text-sm">
                  <p>{error}</p>
                  {checkoutUrl && (
                    <a
                      href={checkoutUrl}
                      className="mt-3 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                    >
                      Continue on Whop
                    </a>
                  )}
                </div>
              )}
              {mounting && (
                <div aria-hidden className="mt-6 space-y-3">
                  <div className="h-11 animate-pulse rounded-[10px] bg-accent/60" />
                  <div className="h-24 animate-pulse rounded-[10px] bg-accent/60" />
                  <div className="h-32 animate-pulse rounded-[10px] bg-accent/60" />
                  <div className="h-12 animate-pulse rounded-[10px] bg-accent/60" />
                </div>
              )}
              <div ref={mountRef} className="mt-6 min-h-[1px]" />
            </>
          )}

          <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Renews {yearly ? "yearly" : "monthly"} until canceled. Cancel anytime in{" "}
              <Link to="/dashboard/billing" className="underline underline-offset-2">
                Billing
              </Link>
              . Card details go straight to Whop, our payment processor — Clonyfy never sees them.
              By subscribing you agree to our{" "}
              <Link to="/terms" className="underline underline-offset-2">
                Terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </span>
          </p>
        </div>
      </section>
    </main>
  );
}
