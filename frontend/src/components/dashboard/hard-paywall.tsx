import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, ChevronDown, Gift, Loader2, Lock, TrendingUp, X } from "lucide-react";
import { PlanFeatureList } from "@/components/pricing/plan-feature-list";
import { ApiError, getPublicConfig, startWhopDownsell, track } from "@/lib/api";
import {
  DOWNSELL,
  PRICING_PLANS,
  annualPerMonth,
  annualTotal,
  usd,
  type BillingInterval,
  type PlanKey,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

/** The clone allowance in one short line, for the plan rows. */
const ALLOWANCE: Record<PlanKey, string> = {
  starter: "10 website clones a month",
  growth: "30 website clones a month",
  unlimited: "Unlimited website clones",
};

const FAQ = [
  {
    q: "I'm a beginner. Will this work for me?",
    a: "Yes. Paste a URL, Clonyfy rebuilds the website and you edit it visually — no design or coding skills required.",
  },
  {
    q: "What do I get right after paying?",
    a: "Export unlocks immediately (Code & ZIP, plus Figma on Growth and Pro) and you get full access to the platform.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel in one click from Billing; you keep access until the end of the period you paid for.",
  },
];

/** Only in-app pages are valid places to come back to after paying. */
function currentReturnPath(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const path = `${window.location.pathname}${window.location.search}`;
  return /^\/(start|dashboard)/.test(path) ? path : undefined;
}

/**
 * Hard paywall, the remakeit "same system": billing toggle, plans as radio rows, what the
 * selected plan unlocks (✓ and ❌), a short FAQ and one "Continue with <Plan>" button that
 * opens checkout. Its X shows the exit offer (when that Whop plan is configured), else closes.
 */
export function HardPaywall({
  onClose,
  source = "paywall",
  returnPath,
  initialPlan = "growth",
}: {
  onClose: () => void;
  /** Where the paywall was opened from, for the funnel (e.g. "onboarding_export"). */
  source?: string;
  /** In-app page to return to after paying; defaults to the current page. */
  returnPath?: string;
  initialPlan?: PlanKey;
}) {
  const navigate = useNavigate();
  const [interval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [selected, setSelected] = useState<PlanKey>(initialPlan);
  const [busy, setBusy] = useState(false);
  const [downsellEnabled, setDownsellEnabled] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const back = useMemo(() => returnPath || currentReturnPath(), [returnPath]);
  const yearly = interval === "annual";
  const plan = PRICING_PLANS.find((p) => p.key === selected) ?? PRICING_PLANS[1]!;
  const exporting = /export/.test(source);

  useEffect(() => {
    track("paywall_viewed", { source }, false);
    let alive = true;
    void getPublicConfig().then((c) => alive && setDownsellEnabled(!!c.downsell_enabled));
    return () => {
      alive = false;
    };
  }, [source]);

  /** The X: one last offer when it can be bought, otherwise just close. */
  const dismiss = () => (downsellEnabled ? setShowExit(true) : onClose());

  function continueToCheckout() {
    setBusy(true);
    void navigate({
      to: "/checkout",
      search: {
        plan: selected,
        interval: yearly ? "annual" : undefined,
        returnPath: back,
        source,
      } as never,
    });
  }

  const dueToday = yearly ? annualTotal(plan.monthly) : plan.monthly;

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && dismiss()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed inset-0 z-[101] flex flex-col bg-background outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[92dvh] sm:w-[calc(100%-2rem)] sm:max-w-[460px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border sm:border-border sm:shadow-2xl"
        >
          {showExit ? (
            <ExitOffer
              source={source}
              returnPath={back}
              onClose={onClose}
              onBack={() => setShowExit(false)}
            />
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5 pb-4 pt-5 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="pt-1">
                    <DialogPrimitive.Title className="text-xl font-semibold tracking-tight">
                      {exporting ? "Export your website" : "Unlock full access"}
                    </DialogPrimitive.Title>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Choose the plan that best fits your needs and unlock powerful features.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={dismiss}
                    aria-label="Close"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Monthly | Yearly (-45%) */}
                <div
                  role="radiogroup"
                  aria-label="Billing period"
                  className="mt-5 grid grid-cols-2 gap-1 rounded-full border border-border p-1"
                >
                  {(["monthly", "annual"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={interval === value}
                      onClick={() => setBillingInterval(value)}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
                        interval === value
                          ? "bg-foreground font-medium text-background"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {value === "monthly" ? "Monthly" : "Yearly"}
                      {value === "annual" && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                            interval === value
                              ? "bg-background text-foreground"
                              : "bg-accent text-foreground",
                          )}
                        >
                          -45%
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Plans as radio rows */}
                <div role="radiogroup" aria-label="Plan" className="mt-4 space-y-2">
                  {PRICING_PLANS.map((p) => {
                    const active = p.key === selected;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSelected(p.key)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                          active
                            ? "border-foreground/60 bg-accent/40"
                            : "border-border hover:border-foreground/30",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                            active ? "border-foreground" : "border-muted-foreground/60",
                          )}
                        >
                          {active && <span className="h-2 w-2 rounded-full bg-foreground" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                            {p.name}
                            {p.popular && (
                              <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
                                Most popular
                              </span>
                            )}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {ALLOWANCE[p.key]}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-semibold tabular-nums">
                            {yearly && (
                              <s className="mr-1 text-xs font-normal text-muted-foreground">
                                {usd(p.monthly)}
                              </s>
                            )}
                            {usd(yearly ? annualPerMonth(p.monthly) : p.monthly)}
                            <span className="text-xs font-normal text-muted-foreground">/mo</span>
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {yearly ? `${usd(annualTotal(p.monthly))} billed yearly` : "Billed monthly"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex gap-3 rounded-2xl border border-border bg-accent/20 p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-foreground text-background">
                    <TrendingUp className="h-4 w-4" />
                  </span>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <span className="block text-sm font-medium text-foreground">
                      Pays for itself with your first website
                    </span>
                    A developer charges $2,000+ for one site. Clonyfy rebuilds it in minutes, ready
                    to customize and export.
                  </p>
                </div>

                <h3 className="mt-5 text-sm font-semibold">What you unlock with {plan.name}</h3>
                <PlanFeatureList features={plan.features} className="mt-3 space-y-2" />

                <h3 className="mt-6 text-sm font-semibold">Your questions</h3>
                <div className="mt-2 space-y-2">
                  {FAQ.map((item) => (
                    <details
                      key={item.q}
                      className="group rounded-xl border border-border px-3 py-2.5 text-sm"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden">
                        {item.q}
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.a}</p>
                    </details>
                  ))}
                </div>
              </div>

              {/* Sticky footer: one clear next step. */}
              <div className="border-t border-border px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
                <button
                  type="button"
                  disabled={busy}
                  onClick={continueToCheckout}
                  autoFocus
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Continue with {plan.name}
                </button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {usd(dueToday)} due today, then every {yearly ? "year" : "month"} · Cancel anytime
                </p>
                <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                  <Lock className="h-3 w-3" /> Secure payment by Whop · Add-on at checkout: +15
                  website clones for $20
                </p>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Exit offer shown when the paywall's X is clicked: Growth at 50% off the first year,
 * then the regular yearly price.
 */
function ExitOffer({
  source,
  returnPath,
  onClose,
  onBack,
}: {
  source: string;
  returnPath?: string | undefined;
  onClose: () => void;
  onBack: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function claim() {
    setError("");
    setBusy(true);
    track("checkout_started", { plan: DOWNSELL.plan, interval: "annual", offer: "downsell", source }, false);
    try {
      const { url } = await startWhopDownsell(returnPath);
      window.location.href = url;
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiError ? err.message : "Couldn't start checkout. Try again.");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-6">
      <div className="flex items-start justify-between">
        <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Clonyfy — exit offer
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 text-center">
        <Gift className="mx-auto h-8 w-8" />
        <DialogPrimitive.Title className="mt-3 text-2xl font-semibold tracking-tight">
          Wait! Unlock an Extra 5% Off.
        </DialogPrimitive.Title>
        <p className="mt-2 text-sm text-muted-foreground">
          Get 50% off your first year of Clonyfy and start cloning websites today.
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-accent/20 p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Growth plan — special offer
        </p>
        <p className="mt-3 text-sm">
          <span className="font-semibold">{usd(DOWNSELL.firstYear)} billed today for the first year.</span>{" "}
          <span className="text-muted-foreground">
            Renews at {usd(DOWNSELL.renewal)}/year unless canceled.
          </span>
        </p>
        <ul className="mx-auto mt-4 inline-flex flex-col gap-2 text-left">
          {["30 website clones per month", "Figma & code export", "API access"].map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 shrink-0 text-emerald-500" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-border p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={claim}
        autoFocus
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Claim my 50% discount
      </button>
      <button
        type="button"
        onClick={onBack}
        className="mt-3 block w-full text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Back to all plans
      </button>
    </div>
  );
}
