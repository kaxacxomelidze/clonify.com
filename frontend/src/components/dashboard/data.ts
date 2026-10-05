export type CloneStatus = "done" | "running" | "queued" | "error";

export type CloneJob = {
  id: string;
  domain: string;
  pages: number;
  status: CloneStatus;
  startedAt: string;
  assets: number;
  routes: number;
  elapsed: string;
  /** ISO time the clone was captured (for date-based analytics). */
  capturedAt?: string;
  /** Backend output directory when loaded from API */
  outDir?: string;
};

export const CLONES: CloneJob[] = [
  {
    id: "softriver",
    domain: "www.softriver.co",
    pages: 0,
    status: "running",
    startedAt: "9:12:04 PM",
    assets: 18,
    routes: 0,
    elapsed: "12s",
  },
  {
    id: "shopify-20",
    domain: "www.shopify.com",
    pages: 20,
    status: "done",
    startedAt: "8:58:41 PM",
    assets: 214,
    routes: 6,
    elapsed: "1m 48s",
  },
  {
    id: "founders-19",
    domain: "founders.ge",
    pages: 19,
    status: "done",
    startedAt: "8:41:20 PM",
    assets: 132,
    routes: 3,
    elapsed: "1m 12s",
  },
  {
    id: "founders-2",
    domain: "founders.ge",
    pages: 2,
    status: "done",
    startedAt: "8:22:07 PM",
    assets: 24,
    routes: 0,
    elapsed: "18s",
  },
  {
    id: "notion-41",
    domain: "www.notion.com",
    pages: 41,
    status: "done",
    startedAt: "7:55:33 PM",
    assets: 388,
    routes: 11,
    elapsed: "3m 04s",
  },
  {
    id: "stripe-41",
    domain: "stripe.com",
    pages: 41,
    status: "done",
    startedAt: "7:31:19 PM",
    assets: 402,
    routes: 9,
    elapsed: "2m 51s",
  },
  {
    id: "limova-41",
    domain: "www.limova.ai",
    pages: 41,
    status: "done",
    startedAt: "6:58:02 PM",
    assets: 271,
    routes: 4,
    elapsed: "2m 20s",
  },
  {
    id: "echelon-3",
    domain: "www.echeloninternational.ge",
    pages: 3,
    status: "done",
    startedAt: "6:40:55 PM",
    assets: 61,
    routes: 0,
    elapsed: "27s",
  },
];

/** Paid plans — must match the landing pricing and the backend plan keys. */
export const PLANS = [
  {
    key: "starter",
    name: "Starter",
    price: "$19.99",
    cycle: "per month",
    features: [
      "10 website clones / month",
      "Unlimited screens",
      "Code & ZIP export",
      "Visual builder & editor",
      "6 days/week support",
      "Cancel anytime",
    ],
    current: false,
  },
  {
    key: "growth",
    name: "Growth",
    price: "$29.99",
    cycle: "per month",
    features: [
      "25 website clones / month",
      "Unlimited screens",
      "Code & ZIP export",
      "Figma export",
      "Visual builder & editor",
      "Access to templates",
      "API access",
      "6 days/week support",
      "Cancel anytime",
    ],
    current: false,
  },
  {
    key: "unlimited",
    name: "Scale",
    price: "$59.99",
    cycle: "per month",
    features: [
      "Unlimited website clones",
      "Unlimited screens",
      "Code & ZIP export",
      "Figma export",
      "Visual builder & editor",
      "Access to templates",
      "API access",
      "7 days/week priority support",
      "Cancel anytime",
    ],
    current: false,
  },
];

export const FREE_PLAN = { key: "free", name: "Free", price: "$0", cycle: "forever" };

/** Upgrade order — customers can only move to a higher plan. */
export const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, growth: 2, unlimited: 3 };
