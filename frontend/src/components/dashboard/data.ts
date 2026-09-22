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

export const LIBRARY = [
  {
    id: "echelon",
    title: "Echelon International — Hospitality & Real Estate",
    updated: "1d",
    lines: ["Hotels.", "Wellness.", "Real Estate."],
  },
  {
    id: "stripe",
    title: "Stripe Revenue Infrastructure",
    updated: "1d",
    lines: ["Financial infrastructure", "to grow your revenue"],
  },
  {
    id: "notion",
    title: "Notion AI Workspace",
    updated: "1d",
    lines: ["Where teams and", "agents think together"],
  },
];

export const USAGE = { used: 1, limit: 3 };

/* ---------- Analytics (dummy) ---------- */

export const CLONE_ACTIVITY = [
  { day: "Mon", clones: 2, pages: 18 },
  { day: "Tue", clones: 4, pages: 46 },
  { day: "Wed", clones: 3, pages: 31 },
  { day: "Thu", clones: 6, pages: 74 },
  { day: "Fri", clones: 5, pages: 58 },
  { day: "Sat", clones: 8, pages: 96 },
  { day: "Sun", clones: 7, pages: 82 },
];

export const MONTHLY_PAGES = [
  { month: "Apr", pages: 120 },
  { month: "May", pages: 208 },
  { month: "Jun", pages: 186 },
  { month: "Jul", pages: 292 },
  { month: "Aug", pages: 341 },
  { month: "Sep", pages: 405 },
];

export const ASSET_SPLIT = [
  { name: "Images", value: 412 },
  { name: "Scripts", value: 218 },
  { name: "Styles", value: 164 },
  { name: "Fonts", value: 92 },
];

export const EXPORT_SPLIT = [
  { name: "React + Tailwind", value: 62 },
  { name: "Figma", value: 21 },
  { name: "Static HTML", value: 17 },
];

export const CLONE_QUALITY = [
  { label: "Layout fidelity", value: 98 },
  { label: "Asset capture", value: 94 },
  { label: "Responsive match", value: 91 },
  { label: "Build success", value: 96 },
];

export const HEADLINE_STATS = [
  { label: "Total clones", value: 36, delta: "+18%" },
  { label: "Pages captured", value: 1552, delta: "+24%" },
  { label: "Assets downloaded", value: 886, delta: "+11%" },
  { label: "Avg clone time", value: "1m 54s", delta: "-12%" },
];

/* ---------- Billing (dummy) ---------- */

export const SUBSCRIPTION = {
  plan: "Growth",
  price: "$29.99",
  cycle: "per month",
  status: "Active",
  renews: "October 7, 2026",
  card: "Visa •••• 4242",
  cardExpiry: "09 / 28",
  seats: 3,
};

export const PLAN_LIMITS = [
  { label: "Clones this month", used: 1, limit: 3 },
  { label: "Pages per clone", used: 41, limit: 60 },
  { label: "Team seats", used: 2, limit: 3 },
  { label: "Exports", used: 14, limit: 50 },
];

export const INVOICES = [
  { id: "INV-2026-09", date: "Sep 7, 2026", amount: "$29.99", status: "Paid" },
  { id: "INV-2026-08", date: "Aug 7, 2026", amount: "$29.99", status: "Paid" },
  { id: "INV-2026-07", date: "Jul 7, 2026", amount: "$29.99", status: "Paid" },
  { id: "INV-2026-06", date: "Jun 7, 2026", amount: "$29.99", status: "Paid" },
];

export const PLANS = [
  {
    name: "Starter",
    price: "$0",
    cycle: "forever",
    features: ["1 clone / month", "10 pages per clone", "Preview only"],
    current: false,
  },
  {
    name: "Growth",
    price: "$29.99",
    cycle: "per month",
    features: ["3 clones / month", "60 pages per clone", "Code + Figma export", "GitHub push"],
    current: true,
  },
  {
    name: "Studio",
    price: "$99",
    cycle: "per month",
    features: ["Unlimited clones", "300 pages per clone", "Team seats", "Priority cloning queue"],
    current: false,
  },
];
