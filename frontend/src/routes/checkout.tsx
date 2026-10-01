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
  ShieldCheck,
} from "lucide-react";
import { BrandMark } from "@/components/site/brand";
import { PLAN_RANK, PLANS } from "@/components/dashboard/data";
import { useAuth } from "@/hooks/use-auth";
import { ApiError, startWhopCheckout } from "@/lib/api";
import { cn } from "@/lib/utils";

const TITLE = "Configure your plan — Clonyfy";

type PlanKey = "starter" | "growth" | "unlimited";
const PLAN_KEYS: PlanKey[] = ["starter", "growth", "unlimited"];

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: TITLE }, { name: "robots", content: "noindex" }] }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { plan?: PlanKey | undefined; status?: string | undefined } => ({
    plan: PLAN_KEYS.includes(search["plan"] as PlanKey) ? (search["plan"] as PlanKey) : undefined,
    status: typeof search["status"] === "string" ? search["status"] : undefined,
  }),
  component: CheckoutPage,
});

const TAGLINES: Record<PlanKey, string> = {
  starter: "For testing on real projects",
  growth: "For teams shipping every week",
  unlimited: "For high-volume cloning",
};

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

/** Styling for Whop's checkout frame (Whop only applies a safe subset of CSS). */
const CHECKOUT_CLASSES: Record<string, Record<string, string>> = {
  "whop-CheckoutDetails": { display: "none" },
  "whop-CheckoutCollection": { background: "transparent", padding: "0" },
  "whop-Email": { display: "none" },
  "whop-CheckoutCompanyPurchase": { display: "none" },
  "whop-Payment": { background: "transparent", border: "none", padding: "0" },
  "whop-PaymentMethods": {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    border: "none",
    background: "transparent",
    padding: "0",
  },
  "whop-PaymentMethod": { display: "contents" },
  "whop-PaymentMethodRow": {
    gridRow: "1",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: "10px",
    minHeight: "96px",
    padding: "18px 22px",
    borderRadius: "20px",
    background: "#3a3a3a",
    border: "2px solid transparent",
    order: "0",
  },
  "whop-PaymentMethodRowSelected": { background: "#232323", border: "2px solid #a3a3a3" },
  "whop-PaymentMethodRadio": { display: "none" },
  "whop-PaymentMethodLabel": { fontSize: "20px", fontWeight: "600" },
  "whop-PaymentMethodDetail": {
    gridColumn: "1 / -1",
    gridRow: "2",
    padding: "0",
    border: "none",
    background: "transparent",
  },
  "whop-CardLabel": { display: "none" },
  "whop-PaymentMethodIcon": { transform: "scale(1.15)" },
  "whop-CheckoutExpressButtons": { gap: "12px" },
  "whop-CheckoutExpressDivider": { margin: "18px 0", color: "#9a9a9a" },
  "whop-PaymentBillingBlock": {
    marginTop: "6px",
    border: "none",
    padding: "0",
    background: "transparent",
  },
  "whop-PaymentDetailRegion": { padding: "14px 0 0", border: "none", background: "transparent" },
  "whop-PaymentCardFields": { padding: "0", border: "none" },
  "whop-CardField": { columnGap: "12px", gap: "12px" },
  "whop-CardFieldGroup": {
    border: "none",
    background: "transparent",
    gap: "12px",
    boxShadow: "none",
  },
  "whop-CardFieldRow": { gap: "12px", border: "none" },
  "whop-CardFieldInput": {
    margin: "0 0 12px 0",
    background: "#323232",
    border: "none",
    borderRadius: "20px",
    minHeight: "72px",
    padding: "0 24px",
    fontSize: "19px",
    boxShadow: "none",
  },
  "whop-AddressField": { border: "none", height: "auto" },
  "whop-AddressFieldInput": {
    background: "#323232",
    border: "none",
    borderRadius: "20px",
    minHeight: "64px",
    padding: "0 24px",
    fontSize: "18px",
  },
  "whop-AddressFieldSelect": {
    background: "#323232",
    border: "none",
    borderRadius: "20px",
    minHeight: "64px",
    padding: "0 24px",
    fontSize: "18px",
  },
  "whop-Address": {
    gap: "12px",
    border: "none",
    background: "transparent",
    boxShadow: "none",
    padding: "0",
  },
  "whop-CheckoutPayButton": {
    background: "#ffffff",
    color: "#000000",
    borderRadius: "999px",
    minHeight: "60px",
    fontSize: "18px",
    fontWeight: "600",
  },
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
  const { plan: requestedPlan, status } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading, isAuthenticated } = useAuth();
  const userRank = PLAN_RANK[String(user?.plan || "free").toLowerCase()] ?? 0;

  const buyable = useMemo(
    () => PLAN_KEYS.filter((key) => (PLAN_RANK[key] ?? 0) > userRank),
    [userRank],
  );
  const [selected, setSelected] = useState<PlanKey | null>(null);
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
        const res = await startWhopCheckout(selected, "monthly");
        if (cancelled) return;
        setCheckoutUrl(res.url);
        if (!res.checkoutId) throw new Error("no embedded checkout");
        const WhopElements = await loadWhopElements();
        if (cancelled) return;
        const checkoutGroup = WhopElements().checkout.create({
          checkoutConfiguration: res.checkoutId,
          returnUrl: `${window.location.origin}/checkout?plan=${selected}`,
          appearance: {
            theme: { appearance: "dark", accentColor: "gray", grayColor: "gray" },
            variables: { "--radius": "16px" },
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
  }, [selected, user?.email, navigate]);

  const plan = PLANS.find((p) => p.key === selected) ?? PLANS[0]!;
  const price = plan.price.replace("$", "");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="px-5 py-5 md:px-8">
        <Link to="/" aria-label="Clonyfy home" className="inline-flex">
          <BrandMark className="h-8 w-8" />
        </Link>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16">
        <section className="min-w-0">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() =>
                window.history.length > 1
                  ? window.history.back()
                  : void navigate({ to: "/dashboard/billing" })
              }
              aria-label="Back"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-accent"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-display text-3xl tracking-tight md:text-4xl">
              Configure your plan
            </h1>
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-medium">Clonyfy plan</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose how much you clone. You can upgrade again any time.
            </p>
            <div role="radiogroup" aria-label="Plan" className="mt-5 grid grid-cols-3 gap-3">
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
                    onClick={() => {
                      setError("");
                      setSelected(key);
                    }}
                    className={cn(
                      "rounded-2xl border px-3 py-4 text-center transition-colors md:py-5",
                      active
                        ? "border-foreground bg-accent"
                        : "border-transparent bg-accent/50 hover:bg-accent",
                      locked && "cursor-not-allowed opacity-45 hover:bg-accent/50",
                    )}
                  >
                    <span className="block text-lg font-semibold md:text-xl">{p.price}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{p.name}</span>
                    {locked && (
                      <span className="mt-1 block text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                        {rank === userRank ? "Current plan" : "Included"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-medium">Pay with</h2>
            {!selected && !loading ? (
              <p className="mt-4 rounded-2xl bg-accent/50 p-5 text-sm text-muted-foreground">
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
                  <div role="alert" className="mt-4 rounded-2xl border border-border p-4 text-sm">
                    <p>{error}</p>
                    {checkoutUrl && (
                      <a
                        href={checkoutUrl}
                        className="mt-3 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
                      >
                        Continue on Whop
                      </a>
                    )}
                  </div>
                )}
                {mounting && (
                  <div aria-hidden className="mt-4 space-y-3">
                    <div className="h-14 animate-pulse rounded-2xl bg-accent/60" />
                    <div className="h-40 animate-pulse rounded-2xl bg-accent/60" />
                    <div className="h-12 animate-pulse rounded-full bg-accent/60" />
                  </div>
                )}
                <div ref={mountRef} className="mt-4 min-h-[1px] overflow-hidden rounded-3xl" />
              </>
            )}
            <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Card details go straight to Whop, our payment processor. Clonyfy never sees them.
            </p>
          </div>
        </section>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-[2rem] border border-border bg-accent/40 p-7 md:p-8">
            <h2 className="font-display text-3xl tracking-tight">Clonyfy {plan.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{TAGLINES[plan.key as PlanKey]}</p>

            <p className="mt-7 text-sm font-medium">Top features</p>
            <ul className="mt-4 space-y-4">
              {TOP_FEATURES[plan.key as PlanKey].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-[0.95rem]">
                  <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
                  {text}
                </li>
              ))}
            </ul>

            <div className="my-7 h-px bg-border" />

            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Monthly subscription</dt>
                <dd>${price}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Estimated tax</dt>
                <dd className="text-right text-muted-foreground">Based on your country</dd>
              </div>
              <div className="flex justify-between gap-4 pt-2 text-base font-semibold">
                <dt>Due today</dt>
                <dd>${price} + tax</dd>
              </div>
            </dl>
          </div>

          <p className="mt-5 px-2 text-xs leading-relaxed text-muted-foreground">
            Renews monthly until canceled. US${price}/month plus any applicable tax will be charged.
            Cancel anytime in{" "}
            <Link to="/dashboard/billing" className="underline underline-offset-2">
              Billing
            </Link>
            . By subscribing, you agree to our{" "}
            <Link to="/terms" className="underline underline-offset-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
          <p className="mt-3 flex items-center gap-2 px-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Payments processed securely by Whop
          </p>
        </aside>
      </div>
    </main>
  );
}
