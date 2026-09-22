import { CaptureTable } from "@/components/dashboard/captures";
import { useDashboardWorkspace } from "@/components/dashboard/workspace";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import {
  ASSET_SPLIT,
  CLONE_ACTIVITY,
  CLONE_QUALITY,
  EXPORT_SPLIT,
  MONTHLY_PAGES,
} from "@/components/dashboard/data";
import { CountUp } from "@/components/anim";
import { cn } from "@/lib/utils";

const TITLE = "Analytics — Clonyfy dashboard";
const DESCRIPTION =
  "Track clone volume, pages captured, asset breakdown and export activity across your Clonyfy workspace.";

export const Route = createFileRoute("/dashboard/analytics")({
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
  component: AnalyticsPage,
});

const RANGES = ["7 days", "30 days", "6 months"] as const;
const MONO = [
  "var(--analytics-pages)",
  "var(--analytics-clones)",
  "var(--analytics-assets)",
  "var(--analytics-other)",
];

function Panel({
  title,
  hint,
  children,
  className,
  delay = 0,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.section
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn("surface sheen rounded-3xl p-5 md:p-6", className)}
    >
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-medium tracking-tight">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </motion.section>
  );
}

const tooltipStyle = {
  background: "var(--elevated)",
  border: "1px solid var(--hairline)",
  borderRadius: "0.9rem",
  fontSize: "0.78rem",
  color: "var(--foreground)",
} as const;

function AnalyticsPage() {
  const { jobs: CLONES } = useDashboardWorkspace();
  const [range, setRange] = useState<(typeof RANGES)[number]>("7 days");
  const reduceMotion = useReducedMotion();
  const realPages = CLONES.reduce((sum, job) => sum + (job.pages || 0), 0);
  const realAssets = CLONES.reduce((sum, job) => sum + (job.assets || 0), 0);
  const activity =
    CLONES.length > 0
      ? CLONES.slice(0, range === "7 days" ? 7 : range === "30 days" ? 12 : 18)
          .slice()
          .reverse()
          .map((job, index) => ({
            label: job.domain.split(".")[0] || `Run ${index + 1}`,
            clones: 1,
            pages: job.pages || 0,
          }))
      : range === "7 days"
        ? CLONE_ACTIVITY.map((item) => ({ ...item, label: item.day }))
        : range === "30 days"
          ? [
              { label: "Week 1", clones: 0, pages: 0 },
              { label: "Week 2", clones: 0, pages: 0 },
              { label: "Week 3", clones: 0, pages: 0 },
              { label: "Week 4", clones: 0, pages: 0 },
            ]
          : MONTHLY_PAGES.map((item) => ({
              label: item.month,
              pages: 0,
              clones: 0,
            }));
  const totals = {
    pages: CLONES.length ? realPages : activity.reduce((sum, item) => sum + item.pages, 0),
    clones: CLONES.length || activity.reduce((sum, item) => sum + item.clones, 0),
  };
  const stats = [
    { label: "Clones", value: totals.clones },
    { label: "Pages captured", value: totals.pages },
    {
      label: "Avg pages / clone",
      value: totals.clones ? Math.round(totals.pages / totals.clones) : 0,
    },
    { label: "Assets", value: realAssets },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Overview</p>
          <h1 className="mt-2 display-lg">Analytics</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Everything your workspace has cloned — volume, depth, assets and exports.
          </p>
        </div>
        <div className="flex rounded-full border border-border p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs transition-colors duration-300",
                range === r
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="surface sheen rounded-3xl p-5"
          >
            <p className="eyebrow">{s.label}</p>
            <p className="mt-3 font-display text-3xl tracking-tight">
              {typeof s.value === "number" ? <CountUp to={s.value} /> : s.value}
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              {CLONES.length ? "From your captures" : "No captures yet"}
            </p>
          </motion.div>
        ))}
      </div>

      <Panel title="Clone activity" hint={`${range} · workspace history`} delay={0.05}>
        <div className="mb-4 flex gap-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: "var(--analytics-pages)" }}
            />
            Pages
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: "var(--analytics-clones)" }}
            />
            Clones
          </span>
        </div>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activity} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="fillClones" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--analytics-pages)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--analytics-pages)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--hairline)" }} />
              <Area
                isAnimationActive={!reduceMotion}
                type="monotone"
                dataKey="pages"
                stroke="var(--analytics-pages)"
                strokeWidth={2}
                fill="url(#fillClones)"
              />
              <Area
                isAnimationActive={!reduceMotion}
                type="monotone"
                dataKey="clones"
                stroke="var(--analytics-clones)"
                strokeWidth={1.5}
                fill="none"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <details className="mt-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer py-3">View activity data</summary>
          <table className="w-full text-left">
            <caption className="sr-only">Activity for {range}</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Clones</th>
                <th scope="col">Pages</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((item) => (
                <tr key={item.label}>
                  <th scope="row" className="py-2 font-normal">
                    {item.label}
                  </th>
                  <td>{item.clones}</td>
                  <td>{item.pages}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Pages captured" hint="last 6 months" delay={0.1}>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MONTHLY_PAGES} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(1 0 0 / 6%)" }} />
                <Bar
                  isAnimationActive={!reduceMotion}
                  dataKey="pages"
                  radius={[8, 8, 4, 4]}
                  fill="var(--analytics-pages)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Asset breakdown" hint="all clones" delay={0.14}>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="h-[200px] w-[200px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    isAnimationActive={!reduceMotion}
                    data={ASSET_SPLIT}
                    dataKey="value"
                    innerRadius={58}
                    outerRadius={86}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {ASSET_SPLIT.map((asset, i) => (
                      <Cell
                        key={asset.name}
                        aria-label={`${asset.name}: ${asset.value} assets`}
                        fill={MONO[i % MONO.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="min-w-[160px] flex-1 space-y-3">
              {ASSET_SPLIT.map((a, i) => (
                <li key={a.name} className="flex items-center gap-3 text-sm">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: MONO[i % MONO.length] }}
                  />
                  <span className="flex-1 text-muted-foreground">{a.name}</span>
                  <span className="font-mono text-xs">{a.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Clone quality" hint="average score" delay={0.18}>
          <ul className="space-y-5">
            {CLONE_QUALITY.map((q, i) => (
              <li key={q.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{q.label}</span>
                  <span className="font-mono text-xs">{q.value}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${q.value}%` }}
                    transition={{ duration: 1, delay: 0.2 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full"
                    style={{ background: "var(--analytics-pages)" }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Export formats" hint="share of exports" delay={0.22}>
          <ul className="space-y-5">
            {EXPORT_SPLIT.map((e, i) => (
              <li key={e.name}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{e.name}</span>
                  <span className="font-mono text-xs">{e.value}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${e.value}%` }}
                    transition={{ duration: 1, delay: 0.25 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full"
                    style={{ background: MONO[i % MONO.length] }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Recent clones" hint="latest runs" delay={0.26} className="overflow-x-auto">
        <CaptureTable jobs={CLONES} caption="Recent clones" />
      </Panel>
    </div>
  );
}
