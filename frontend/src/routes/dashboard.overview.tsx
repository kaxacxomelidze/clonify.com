import { DashboardSelect } from "@/components/dashboard/select";
import { useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Bell, Check, Download, Grid2X2, List, Pencil, Plus, Search, Pin } from "lucide-react";
import { CLONE_ACTIVITY, type CloneJob } from "@/components/dashboard/data";
import { CaptureDetails, downloadCaptureReport } from "@/components/dashboard/captures";
import { TaskEditor, newTask } from "@/components/dashboard/planner";
import { useDashboardWorkspace, type WorkspaceTask } from "@/components/dashboard/workspace";
import { CountUp } from "@/components/anim";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/dashboard/overview")({
  head: () => ({ meta: [{ title: "Overview — Clonyfy dashboard" }] }),
  component: OverviewPage,
});

function Card({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.section
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="surface rounded-3xl p-5 md:p-6"
    >
      {children}
    </motion.section>
  );
}
function OverviewPage() {
  const { user } = useAuth();
  const { jobs, tasks, saveTask, refreshJobs } = useDashboardWorkspace();
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState("grid");
  const [sort, setSort] = useState("recent");
  const [editing, setEditing] = useState<WorkspaceTask | null>(null);
  const [selected, setSelected] = useState<CloneJob | null>(null);
  const complete = jobs.filter((job) => job.status === "done").length;
  const running = jobs.filter((job) => job.status === "running").length;
  const active = tasks.filter((task) => !task.archived);
  const pending = active
    .filter((task) => !task.done)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const goalProgress = active.length
    ? Math.round((active.filter((task) => task.done).length / active.length) * 100)
    : 0;
  const projects = [...jobs].sort((a, b) =>
    sort === "name" ? a.domain.localeCompare(b.domain) : 0,
  );
  const weekData =
    jobs.length > 0
      ? jobs.slice(0, 7).map((job, index) => ({
          day: job.domain.split(".")[0] || `R${index + 1}`,
          pages: job.pages,
          clones: 1,
        }))
      : CLONE_ACTIVITY;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Workspace overview</p>
          <h1 className="display-lg mt-3">Hi, {user?.name?.split(" ")[0] || "there"}!</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard" className="dashboard-button bg-primary text-primary-foreground">
            <Plus size={16} />
            Create
          </Link>
          <Link to="/dashboard/library" aria-label="Search projects" className="task-icon">
            <Search size={16} />
          </Link>
          <Link
            to="/dashboard/activity"
            aria-label="Notifications and activity"
            className="task-icon"
          >
            <Bell size={16} />
          </Link>
        </div>
      </header>
      <div className="dashboard-overview-top">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base">Overall information</h2>
            <Link
              className="task-icon"
              to="/dashboard/analytics"
              aria-label="Open detailed analytics"
            >
              ↗
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-6">
            <div>
              <span className="font-display text-5xl">
                <CountUp to={complete} />
              </span>
              <p className="mt-2 text-xs text-muted-foreground">Completed captures</p>
            </div>
            <div className="border-l border-border pl-6">
              <span className="font-display text-5xl">{running}</span>
              <p className="mt-2 text-xs text-muted-foreground">Runs in progress</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              ["Projects", jobs.length],
              ["Tasks", pending.length],
              ["Complete", complete],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-border px-2 py-4 text-center">
                <p className="font-display text-2xl">{value}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </Card>
        <Card delay={0.05}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base">Weekly progress</h2>
            <span className="text-xs text-muted-foreground">
              {jobs.length ? "Your captures" : "No data yet"}
            </span>
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span>— Pages</span>
            <span>┄ Clones</span>
          </div>
          <div className="mt-5 h-[180px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekData} margin={{ left: 4, right: 4, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="overview-week" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--analytics-pages)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--analytics-pages)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area
                  isAnimationActive={!reduceMotion}
                  dataKey="pages"
                  stroke="var(--analytics-pages)"
                  fill="url(#overview-week)"
                  type="monotone"
                  strokeWidth={2}
                />
                <Area
                  isAnimationActive={!reduceMotion}
                  dataKey="clones"
                  stroke="var(--analytics-clones)"
                  fill="none"
                  type="monotone"
                  strokeDasharray="4 4"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <Link
            className="mt-3 inline-block py-2 text-xs text-muted-foreground hover:text-foreground"
            to="/dashboard/analytics"
          >
            Explore analytics ↗
          </Link>
        </Card>
        <Card delay={0.1}>
          <h2 className="text-base">Month progress</h2>
          <p className="mt-2 text-xs text-muted-foreground">Your active workspace tasks</p>
          <div className="my-5 flex items-center justify-center gap-5">
            <div className="text-xs leading-7 text-muted-foreground">
              <p>{active.filter((task) => task.done).length} complete</p>
              <p>{pending.length} to go</p>
            </div>
            <div className="relative h-32 w-32 shrink-0">
              <svg
                viewBox="0 0 128 128"
                aria-label={`${goalProgress}% of tasks complete`}
                role="img"
              >
                <circle
                  cx="64"
                  cy="64"
                  r="50"
                  stroke="var(--accent)"
                  strokeWidth="10"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="50"
                  stroke="var(--analytics-pages)"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray="314.16"
                  strokeDashoffset={314.16 * (1 - goalProgress / 100)}
                  transform="rotate(-90 64 64)"
                />
              </svg>
              <span className="absolute inset-0 grid place-items-center font-display text-2xl">
                {goalProgress}%
              </span>
            </div>
          </div>
          <button className="dashboard-button w-full" onClick={() => downloadCaptureReport(jobs)}>
            <Download size={16} />
            Download capture report
          </button>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
        <Card delay={0.15}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base">Month goals</h2>
            <Link to="/dashboard/tasks" className="task-icon" aria-label="Edit goals and tasks">
              <Pencil size={16} />
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {active.slice(0, 4).map((task) => (
              <li key={task.id}>
                <button
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-accent"
                  aria-pressed={task.done}
                  onClick={() => saveTask({ ...task, done: !task.done })}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded border border-border ${task.done ? "bg-primary text-primary-foreground" : ""}`}
                  >
                    {task.done && <Check size={14} />}
                  </span>
                  <span
                    className={`text-sm ${task.done ? "text-muted-foreground line-through" : ""}`}
                  >
                    {task.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!active.length && (
            <p className="mt-5 text-sm text-muted-foreground">Add a task to set your next goal.</p>
          )}
          <Link
            to="/dashboard/calendar"
            className="mt-5 block rounded-2xl border border-border p-4 text-xs text-muted-foreground"
          >
            Plan the week in Calendar ↗
          </Link>
        </Card>
        <Card delay={0.2}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base">Tasks in process ({pending.length})</h2>
            <Link to="/dashboard/tasks" className="py-3 text-xs text-muted-foreground">
              All tasks & archive ↗
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {pending.slice(0, 2).map((task) => (
              <article key={task.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <button
                    className="task-icon"
                    aria-label={`Pin ${task.title}`}
                    aria-pressed={task.pinned}
                    onClick={() => saveTask({ ...task, pinned: !task.pinned })}
                  >
                    <Pin size={15} />
                  </button>
                  <button
                    className="task-icon"
                    aria-label={`Edit ${task.title}`}
                    onClick={() => setEditing(task)}
                  >
                    <Pencil size={15} />
                  </button>
                </div>
                <p className="mt-5 text-sm">{task.title}</p>
                <p className="mt-4 text-xs text-muted-foreground">{task.date}</p>
              </article>
            ))}
            <button
              className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:bg-accent"
              onClick={() => setEditing(newTask())}
            >
              <span className="flex items-center gap-2">
                <Plus size={16} />
                Add task
              </span>
            </button>
          </div>
        </Card>
      </div>
      <Card delay={0.25}>
        <div className="dashboard-toolbar justify-between">
          <h2 className="text-base">Last projects</h2>
          <div className="flex items-center gap-2">
            <DashboardSelect
              label="Sort projects"
              value={sort}
              onValueChange={setSort}
              options={[
                { value: "recent", label: "Recent first" },
                { value: "name", label: "Name A\u2013Z" },
              ]}
            />
            {["grid", "list"].map((mode) => (
              <button
                key={mode}
                aria-label={`${mode} view`}
                aria-pressed={view === mode}
                className="task-icon"
                onClick={() => setView(mode)}
              >
                {mode === "grid" ? <Grid2X2 size={16} /> : <List size={16} />}
              </button>
            ))}
          </div>
        </div>
        <div className={`mt-5 grid gap-4 ${view === "grid" ? "md:grid-cols-3" : ""}`}>
          {projects.slice(0, 6).map((project) => (
            <article
              key={project.id}
              className="flex flex-col rounded-2xl border border-border p-5"
            >
              <h3 className="text-sm leading-relaxed">{project.domain}</h3>
              <p className="mb-5 mt-3 flex-1 text-xs leading-relaxed text-muted-foreground">
                {project.pages} pages · {project.assets} assets · {project.status}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Started {project.startedAt || "—"}</span>
                <button className="dashboard-button text-xs" onClick={() => setSelected(project)}>
                  View capture
                </button>
              </div>
            </article>
          ))}
          {!projects.length && (
            <p className="text-sm text-muted-foreground">
              No captures yet.{" "}
              <Link to="/dashboard" className="underline underline-offset-4">
                Start a clone
              </Link>
              .
            </p>
          )}
        </div>
      </Card>
      {editing && <TaskEditor key={editing.id} task={editing} onClose={() => setEditing(null)} />}
      <CaptureDetails
        job={selected}
        onClose={() => setSelected(null)}
        onDeleted={() => void refreshJobs()}
      />
    </div>
  );
}
