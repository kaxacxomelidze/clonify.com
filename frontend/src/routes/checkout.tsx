import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Lock, Plus } from "lucide-react";
import { BrandMark } from "@/components/site/brand";
import { PLAN_RANK, PLANS } from "@/components/dashboard/data";
import { PlanFeatureList } from "@/components/pricing/plan-feature-list";
import { ADDON, annualPerMonth, annualTotal, usd } from "@/lib/pricing";
import { useAuth } from "@/hooks/use-auth";
import { ApiError, startWhopAddon, startWhopCheckout, track } from "@/lib/api";
import { cn } from "@/lib/utils";

const TITLE = "Configure your plan — Clonyfy";

type PlanKey = "starter" | "growth" | "unlimited";
const PLAN_KEYS: PlanKey[] = ["starter", "growth", "unlimited"];
type Interval = "monthly" | "annual";

/** Only in-app paths may be the post-payment destination (no open redirects). */
function safeReturnPath(value: unknown): string | undefined {
  const path = typeof value === "string" ? value : "";
  return /^\/(start|dashboard)(\/[\w\-/]*)?(\?[\w.%=&\-/]*)?$/.test(path) && path.length <= 400
    ? path
    : undefined;
}

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: TITLE }, { name: "robots", content: "noindex" }] }),
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    plan?: PlanKey | undefined;
    interval?: Interval | undefined;
    status?: string | undefined;
    returnPath?: string | undefined;
    source?: string | undefined;
  } => ({
    plan: PLAN_KEYS.includes(search["plan"] as PlanKey) ? (search["plan"] as PlanKey) : undefined,
    interval: search["interval"] === "annual" ? "annual" : undefined,
    status: typeof search["status"] === "string" ? search["status"] : undefined,
    returnPath: safeReturnPath(search["returnPath"]),
    source:
      typeof search["source"] === "string" && /^[\w-]{1,40}$/.test(search["source"])
        ? search["source"]
        : undefined,
  }),
  component: CheckoutPage,
});

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
  const {
    plan: requestedPlan,
    interval: requestedInterval,
    status,
    returnPath,
    source,
  } = Route.useSearch();
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
  const [addonBusy, setAddonBusy] = useState(false);
  const [addonError, setAddonError] = useState("");
  const mountRef = useRef<HTMLDivElement>(null);

  async function buyAddon() {
    setAddonError("");
    setAddonBusy(true);
    try {
      const { url } = await startWhopAddon();
      window.location.href = url;
    } catch (err) {
      setAddonBusy(false);
      setAddonError(
        err instanceof ApiError ? err.message : "Couldn't start the add-on checkout. Try again.",
      );
    }
  }

  useEffect(() => {
    if (!loading && !isAuthenticated) void navigate({ to: "/login" });
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    track("purchase_view");
  }, []);

  // Pick the requested plan if it's an upgrade, otherwise the next plan up.
  useEffect(() => {
    if (loading || !user) return;
    setSelected((current) => {
      if (current && buyable.includes(current)) return current;
      if (requestedPlan && buyable.includes(requestedPlan)) return requestedPlan;
      return buyable[0] ?? null;
    });
  }, [loading, user, buyable, requestedPlan]);

  /** After payment: back to where the user was (e.g. their clone), else Billing. */
  const goPaid = useMemo(
    () => () => {
      if (returnPath) {
        window.location.assign(`${returnPath}${returnPath.includes("?") ? "&" : "?"}whop=success`);
        return;
      }
      void navigate({ to: "/dashboard/billing", search: { whop: "success" } as never });
    },
    [returnPath, navigate],
  );

  // Back from an off-site payment step (3DS, bank page): only "succeeded" counts as paid.
  useEffect(() => {
    if (status === "succeeded") goPaid();
    else if (status === "failed")
      setError(
        "The payment didn't go through. You weren't charged — try again or use another card.",
      );
    else if (status === "canceled")
      setError("Payment was canceled. You can try again whenever you're ready.");
  }, [status, goPaid]);

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
        const res = await startWhopCheckout(selected, interval, returnPath);
        if (cancelled) return;
        setCheckoutUrl(res.url);
        track("checkout_started", { plan: selected, interval, source: source || "checkout" }, false);
        if (!res.checkoutId) throw new Error("no embedded checkout");
        const WhopElements = await loadWhopElements();
        if (cancelled) return;
        const checkoutGroup = WhopElements().checkout.create({
          checkoutConfiguration: res.checkoutId,
          returnUrl: `${window.location.origin}/checkout?plan=${selected}&interval=${interval}${
            returnPath ? `&returnPath=${encodeURIComponent(returnPath)}` : ""
          }`,
          appearance: {
            theme: { appearance: "dark", accentColor: "gray", grayColor: "gray" },
            variables: { "--radius": "10px" },
            // Big filled fields, method tiles and a white pill button. Whop's own summary
            // and email field are hidden: our summary card and the signed-in email cover them.
            classes: CHECKOUT_CLASSES,
          },
          onComplete: () => goPaid(),
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
  }, [selected, interval, user?.email, returnPath, source, goPaid]);

  const plan = PLANS.find((p) => p.key === selected) ?? PLANS[0]!;
  const monthly = plan.monthly;
  const yearly = interval === "annual";
  const price = (yearly ? annualTotal(monthly) : monthly).toFixed(2);
  const saving = (monthly * 12 - annualTotal(monthly)).toFixed(2);
  /** Pro is unlimited: no plan to buy and no use for extra clones. */
  const onTopPlan = !selected && !loading && !!user;
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

          {onTopPlan ? (
            <p className="mt-10 text-[15px] text-muted-foreground">
              You're on Clonyfy Pro — unlimited website clones and every feature.
            </p>
          ) : (
            <>
              <p className="mt-10 text-[15px] text-muted-foreground">
                Subscribe to Clonyfy {plan.name}
              </p>
              {/* Yearly is shown as the monthly price with the 45% reduction. */}
              <div className="mt-1 flex items-end gap-2">
                {yearly && (
                  <s className="pb-1 text-lg leading-none text-muted-foreground">
                    {usd(monthly)}
                  </s>
                )}
                <span className="text-[2.5rem] font-semibold leading-none tracking-tight">
                  {usd(yearly ? annualPerMonth(monthly) : monthly)}
                </span>
                <span className="pb-1 text-sm leading-tight text-muted-foreground">
                  per
                  <br />
                  month
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {yearly
                  ? `${usd(annualTotal(monthly))} billed yearly · you save ${saving} a year`
                  : "Billed monthly · cancel anytime"}
              </p>
            </>
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
                {value === "monthly" ? "Monthly" : "Yearly −45%"}
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

          {!onTopPlan && (
            <PlanFeatureList features={plan.featureRows} className="mt-8 space-y-3" />
          )}

          {/* Add-on: a one-time top-up bought as its own checkout (not for unlimited Pro). */}
          {!onTopPlan && String(user?.plan || "").toLowerCase() !== "unlimited" && (
            <div className="mt-8 rounded-xl border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Add-On: Extra Website Clones</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  +{ADDON.clones} websites for {usd(ADDON.price)} (instant access).
                </p>
              </div>
              <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
            <button
              type="button"
              onClick={buyAddon}
              disabled={addonBusy}
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
            >
              {addonBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              Add {ADDON.clones} clones — {usd(ADDON.price)}
            </button>
            {addonError && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {addonError}
              </p>
            )}
            </div>
          )}

          {!onTopPlan && (
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
          )}
        </div>
      </section>

      {/* Payment */}
      <section className="border-t border-border bg-[#0b0b0b] px-5 py-8 sm:px-8 lg:border-l lg:border-t-0 lg:px-16 lg:py-14">
        <div className="mx-auto w-full max-w-[420px] lg:mx-0">
          <h1 className="text-lg font-medium">Pay with card</h1>
          <p className="mt-1 text-xs text-muted-foreground">Signed in as {user?.email}</p>

          {!selected && !loading ? (
            <p className="mt-6 rounded-xl border border-border p-4 text-sm text-muted-foreground">
              You're on Pro, our top plan — there's nothing to upgrade to.{" "}
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
