/**
 * The pricing table — the single source of truth for every surface that shows plans
 * (landing, billing, checkout, hard paywall). Rows, order and wording are the client's
 * table exactly; keep the backend plan keys and prices (server.js PLAN_PRICES) in sync.
 */
export type PlanKey = "starter" | "growth" | "unlimited";
export type BillingInterval = "monthly" | "annual";
export type PlanFeature = { label: string; included: boolean };

export type PricingPlan = {
  key: PlanKey;
  name: "Starter" | "Growth" | "Pro";
  /** USD per month on monthly billing. */
  monthly: number;
  popular: boolean;
  features: PlanFeature[];
};

const yes = (label: string): PlanFeature => ({ label, included: true });
const no = (label: string): PlanFeature => ({ label, included: false });

export const PRICING_PLANS: PricingPlan[] = [
  {
    key: "starter",
    name: "Starter",
    monthly: 17.99,
    popular: false,
    features: [
      yes("10 Website Clones / Month"),
      yes("Unlimited Screens"),
      yes("Code & ZIP Export"),
      yes("Visual Builder & Editor"),
      yes("Access to Templates"),
      yes("Cancel Anytime"),
      no("Figma Export"),
      no("Private Support Access"),
    ],
  },
  {
    key: "growth",
    name: "Growth",
    monthly: 26.99,
    popular: true,
    features: [
      yes("30 Website Clones / Month"),
      yes("Unlimited Screens"),
      yes("Code & ZIP Export"),
      yes("Visual Builder & Editor"),
      yes("Access to Templates"),
      yes("Figma Export"),
      yes("API Access"),
      yes("Private Support Access"),
      yes("Cancel Anytime"),
    ],
  },
  {
    key: "unlimited",
    name: "Pro",
    monthly: 79.99,
    popular: false,
    features: [
      yes("Unlimited Website Clones"),
      yes("Unlimited Screens"),
      yes("Code & ZIP Export"),
      yes("Figma Export"),
      yes("Visual Builder & Editor"),
      yes("Access to Templates"),
      yes("API Access"),
      yes("Private Support Access"),
      yes("Cancel Anytime"),
    ],
  },
];

/** Yearly billing: 45% off, every year (the annual plans renew at the same price). */
export const ANNUAL_DISCOUNT = 0.45;
const ANNUAL_RATE = 1 - ANNUAL_DISCOUNT;
const cents = (n: number) => Math.round(n * 100) / 100;

/** Yearly price: 118.73 / 178.13 / 527.93. */
export const annualTotal = (monthly: number) => cents(monthly * 12 * ANNUAL_RATE);
/** The yearly price shown as a monthly figure: 9.89 / 14.84 / 43.99. */
export const annualPerMonth = (monthly: number) => cents(monthly * ANNUAL_RATE);

/** Checkout add-on: extra website clones, one-time, instant access. */
export const ADDON = { clones: 15, price: 20 } as const;

/** Exit offer on the hard paywall: Growth, 50% off the first year, then the yearly price. */
export const DOWNSELL = { plan: "growth" as PlanKey, firstYear: 161.94, renewal: 178.13 } as const;

export const usd = (n: number) => `$${n.toFixed(2)}`;

export function pricingPlan(key: string | null | undefined): PricingPlan | undefined {
  return PRICING_PLANS.find((p) => p.key === key);
}

/** What the user pays at checkout for a plan and billing period. */
export function dueToday(plan: PricingPlan, interval: BillingInterval) {
  return interval === "annual" ? annualTotal(plan.monthly) : plan.monthly;
}
