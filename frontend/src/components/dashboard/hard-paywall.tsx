import { useEffect, useState } from "react";
import { Check, Gift, Loader2, X } from "lucide-react";
import { PLANS } from "@/components/dashboard/data";
import { ApiError, startWhopCheckout, startWhopDownsell, track } from "@/lib/api";
import { cn } from "@/lib/utils";

type Interval = "monthly" | "annual";

/** First-year billing is 12 months at 45% off. */
const ANNUAL_RATE = 0.55;
const num = (price: string) => Number(price.replace(/[^0-9.]/g, "")) || 0;
const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * Blocking upgrade wall. The X simply closes the wall. (The exit-intent downsell below is
 * disabled until the WHOP_PLAN_GROWTH_DOWNSELL plan is configured — re-enable by pointing the
 * X at setShowExit(true) again.) Mount it over the app for users who must pick a plan to continue.
 */
export function HardPaywall({ onClose }: { onClose: () => void }) {
  const [interval, setInterval] = useState<Interval>("annual");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const yearly = interval === "annual";

  useEffect(() => {
    track("paywall_view");
  }, []);

  async function choose(planKey: string) {
    setError("");
    setBusy(planKey);
    try {
      const { url } = await startWhopCheckout(planKey, interval);
      window.location.href = url;
    } catch (err) {
      setBusy(null);
      setError(err instanceof ApiError ? err.message : "Couldn't start checkout. Try again.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a plan to continue"
    >
      <div className="relative my-8 w-full max-w-4xl rounded-2xl border border-border bg-background p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Clonyfy — choose your plan
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Pick a plan to keep cloning.</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Unlimited screens, code &amp; ZIP export and the visual editor on every plan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          role="radiogroup"
          aria-label="Billing period"
          className="mt-5 inline-grid grid-cols-2 gap-1 rounded-xl border border-border p-1"
        >
          {(["monthly", "annual"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={interval === value}
              onClick={() => setInterval(value)}
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

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {PLANS.map((p) => {
            const monthly = num(p.price);
            const shown = yearly ? monthly * ANNUAL_RATE : monthly;
            const popular = p.key === "growth";
            return (
              <div
                key={p.key}
                className={cn(
                  "flex flex-col rounded-xl border p-5",
                  popular ? "border-foreground/40 bg-accent/30" : "border-border",
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{p.name}</h3>
                  {popular && (
                    <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
                      Most popular
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-3xl font-semibold tracking-tight">{money(shown)}</span>
                  <span className="pb-1 text-xs text-muted-foreground">/mo</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {yearly ? `${money(monthly * 12 * ANNUAL_RATE)} billed first year` : "Billed monthly"}
                </p>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => choose(p.key)}
                  className={cn(
                    "mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-60",
                    popular
                      ? "bg-foreground text-background hover:opacity-90"
                      : "border border-border hover:bg-accent",
                  )}
                >
                  {busy === p.key && <Loader2 className="h-4 w-4 animate-spin" />}
                  Choose {p.name}
                </button>
                <ul className="mt-4 space-y-2">
                  {p.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-border p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <p className="mt-5 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          Yearly billing: Save 45% · Add-On: +15 website clones for $20 · Cancel anytime
        </p>
      </div>
    </div>
  );
}

/**
 * Exit-intent downsell shown when the paywall's X is clicked: Growth at 50% off the first year.
 */
function ExitOffer({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function claim() {
    setError("");
    setBusy(true);
    try {
      const { url } = await startWhopDownsell();
      window.location.href = url;
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiError ? err.message : "Couldn't start checkout. Try again.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Special offer"
    >
      <div className="relative my-8 w-full max-w-xl rounded-2xl border border-border bg-background p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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

        <div className="mt-4 text-center">
          <Gift className="mx-auto h-8 w-8" />
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Wait! Unlock an Extra 5% Off.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Get 50% off your first year of Clonyfy and start cloning websites today.
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-border bg-accent/20 p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Growth plan — special offer
          </p>
          <div className="mt-2 flex items-end justify-center gap-2">
            <span className="text-base text-muted-foreground line-through">$26.99</span>
            <span className="text-4xl font-semibold tracking-tight">$13.50</span>
            <span className="pb-1 text-sm text-muted-foreground">/mo</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            $161.94 billed today for the first year. Renews at $178.13/year unless canceled.
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
          <p role="alert" className="mt-4 rounded-lg border border-border p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={claim}
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
    </div>
  );
}
