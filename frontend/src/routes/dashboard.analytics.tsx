import { CaptureTable } from "@/components/dashboard/captures";
import { useDashboardWorkspace } from "@/components/dashboard/workspace";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import type { CloneJob } from "@/components/dashboard/data";
import { CountUp } from "@/components/anim";
import { cn } from "@/lib/utils";

const TITLE = "Analytics — Clonyfy dashboard";
const DESCRIPTION =
  "Track clone volume, pages captured, outcomes and your most cloned sites across your Clonyfy workspace.";

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
  const now = useMemo(() => new Date(), []);
  const inRange = CLONES.filter((job) => {
    const t = Date.parse(job.capturedAt || "");
    return Number.isFinite(t) && t >= rangeStart(range, now).getTime();
  });
  const activity = buckets(range, now).map((bucket) => {
    const jobs = inRange.filter((job) => {
      const t = Date.parse(job.capturedAt || "");
      return t >= bucket.from && t < bucket.to;
    });
    return {
      label: bucket.label,
      clones: jobs.length,
      pages: jobs.reduce((sum, job) => sum + (job.pages || 0), 0),
    };
  });
  const monthly = buckets("6 months", now).map((bucket) => ({
    month: bucket.label,
    pages: CLONES.filter((job) => {
      const t = Date.parse(job.capturedAt || "");
      return t >= bucket.from && t < bucket.to;
    }).reduce((sum, job) => sum + (job.pages || 0), 0),
  }));
  const rangePages = inRange.reduce((sum, job) => sum + (job.pages || 0), 0);
  const stats = [
    { label: "Clones", value: inRange.length },
    { label: "Pages captured", value: rangePages },
    {
      label: "Avg pages / clone",
      value: inRange.length ? Math.round(rangePages / inRange.length) : 0,
    },
    { label: "Assets", value: inRange.reduce((sum, job) => sum + (job.assets || 0), 0) },
  ];
  const outcomes = [
    { name: "Finished", value: CLONES.filter((job) => job.status === "done").length },
    { name: "Failed", value: CLONES.filter((job) => job.status === "error").length },
    {
      name: "In progress",
      value: CLONES.filter((job) => job.status === "running" || job.status === "queued").length,
    },
  ].filter((item) => item.value > 0);
  const largest = [...CLONES]
    .filter((job) => job.pages > 0)
    .sort((a, b) => b.pages - a.pages)
    .slice(0, 5);
  const maxPages = largest[0]?.pages || 1;
  const domains = topDomains(CLONES);
  const maxDomain = domains[0]?.count || 1;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Overview</p>
          <h1 className="mt-2 display-lg">Analytics</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Everything your workspace has cloned — volume, depth, outcomes and top sites.
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
              {inRange.length
                ? `Last ${range}`
                : CLONES.length
                  ? `None in the last ${range}`
                  : "No clones yet"}
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
                allowDecimals={false}
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
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
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

        <Panel title="Clone outcomes" hint="all clones" delay={0.14}>
          {outcomes.length ? (
            <div className="flex flex-wrap items-center justify-center gap-6">
              <div className="h-[200px] w-[200px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      isAnimationActive={!reduceMotion}
                      data={outcomes}
                      dataKey="value"
                      innerRadius={58}
                      outerRadius={86}
                      paddingAngle={outcomes.length > 1 ? 3 : 0}
                      stroke="none"
                    >
                      {outcomes.map((item, i) => (
                        <Cell
                          key={item.name}
                          aria-label={`${item.name}: ${item.value}`}
                          fill={MONO[i % MONO.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="min-w-[160px] flex-1 space-y-3">
                {outcomes.map((item, i) => (
                  <li key={item.name} className="flex items-center gap-3 text-sm">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: MONO[i % MONO.length] }}
                    />
                    <span className="flex-1 text-muted-foreground">{item.name}</span>
                    <span className="font-mono text-xs">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyPanel />
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Largest clones" hint="by pages captured" delay={0.18}>
          {largest.length ? (
            <BarList
              items={largest.map((job) => ({ key: job.id, label: job.domain, value: job.pages }))}
              max={maxPages}
              unit="pages"
            />
          ) : (
            <EmptyPanel />
          )}
        </Panel>

        <Panel title="Most cloned sites" hint="clones per domain" delay={0.22}>
          {domains.length ? (
            <BarList
              items={domains.map((d) => ({ key: d.domain, label: d.domain, value: d.count }))}
              max={maxDomain}
              unit="clones"
            />
          ) : (
            <EmptyPanel />
          )}
        </Panel>
      </div>

      <Panel title="Recent clones" hint="latest runs" delay={0.26} className="overflow-x-auto">
        <CaptureTable jobs={CLONES} caption="Recent clones" />
      </Panel>
    </div>
  );
}

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function rangeStart(range: (typeof RANGES)[number], now: Date) {
  if (range === "6 months") return new Date(now.getFullYear(), now.getMonth() - 5, 1);
  return new Date(startOfDay(now).getTime() - ((range === "7 days" ? 7 : 30) - 1) * DAY);
}

/** Day buckets for 7/30 days, month buckets for 6 months, oldest first. */
function buckets(range: (typeof RANGES)[number], now: Date) {
  if (range === "6 months") {
    return Array.from({ length: 6 }, (_, i) => {
      const from = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
      return {
        label: from.toLocaleDateString("en-US", { month: "short" }),
        from: from.getTime(),
        to: to.getTime(),
      };
    });
  }
  const days = range === "7 days" ? 7 : 30;
  const first = rangeStart(range, now).getTime();
  return Array.from({ length: days }, (_, i) => {
    const from = new Date(first + i * DAY);
    return {
      label:
        days === 7
          ? from.toLocaleDateString("en-US", { weekday: "short" })
          : from.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      from: from.getTime(),
      to: from.getTime() + DAY,
    };
  });
}

function topDomains(jobs: CloneJob[]) {
  const counts = new Map<string, number>();
  for (const job of jobs) counts.set(job.domain, (counts.get(job.domain) || 0) + 1);
  return [...counts.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function BarList({
  items,
  max,
  unit,
}: {
  items: { key: string; label: string; value: number }[];
  max: number;
  unit: string;
}) {
  return (
    <ul className="space-y-5">
      {items.map((item) => (
        <li key={item.key}>
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-muted-foreground">{item.label}</span>
            <span className="shrink-0 font-mono text-xs">
              {item.value} {unit}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(4, Math.round((item.value / max) * 100))}%`,
                background: "var(--analytics-pages)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyPanel() {
  return (
    <p className="py-10 text-center text-sm text-muted-foreground">
      Nothing here yet. Clone a website and your numbers appear here.
    </p>
  );
}
