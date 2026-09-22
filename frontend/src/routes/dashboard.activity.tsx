import { DashboardSelect } from "@/components/dashboard/select";
import { useDashboardWorkspace } from "@/components/dashboard/workspace";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import {
  CaptureSearch,
  CaptureTable,
  EmptyCaptures,
  downloadCaptureReport,
} from "@/components/dashboard/captures";
import { CapturePipeline } from "@/components/dashboard/pipeline";

export const Route = createFileRoute("/dashboard/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Clonyfy dashboard" },
      {
        name: "description",
        content: "Inspect capture activity, filter runs and download a capture report.",
      },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { jobs: CLONES } = useDashboardWorkspace();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("recent");
  const jobs = CLONES.filter(
    (job) =>
      (status === "all" || job.status === status) &&
      job.domain.toLowerCase().includes(query.trim().toLowerCase()),
  );
  if (sort === "pages") jobs.sort((a, b) => b.pages - a.pages);
  if (sort === "assets") jobs.sort((a, b) => b.assets - a.assets);
  const stats = [
    ["Captures", CLONES.length],
    ["Complete", CLONES.filter((job) => job.status === "done").length],
    ["Running", CLONES.filter((job) => job.status === "running").length],
    ["Pages captured", CLONES.reduce((sum, job) => sum + job.pages, 0)],
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="eyebrow">Capture history</p>
        <h1 className="display-lg mt-3">Every run, in one place.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Follow capture status, inspect the details and take your report with you.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="surface rounded-3xl p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-3 font-display text-3xl tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <section className="surface rounded-3xl p-5 md:p-8">
        <div className="dashboard-toolbar mb-6">
          <CaptureSearch value={query} onChange={setQuery} />
          <DashboardSelect
            label="Filter status"
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "all", label: "All statuses" },
              { value: "running", label: "Running" },
              { value: "done", label: "Complete" },
              { value: "error", label: "Failed" },
              { value: "queued", label: "Queued" },
            ]}
          />
          <DashboardSelect
            label="Sort captures"
            value={sort}
            onValueChange={setSort}
            options={[
              { value: "recent", label: "Recent first" },
              { value: "pages", label: "Most pages" },
              { value: "assets", label: "Most assets" },
            ]}
          />
          <button
            className="dashboard-button disabled:opacity-40"
            disabled={!jobs.length}
            onClick={() => downloadCaptureReport(jobs)}
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground" role="status">
          {jobs.length} of {CLONES.length} captures
        </p>
        {jobs.length ? (
          <CaptureTable jobs={jobs} caption="Capture activity" />
        ) : (
          <EmptyCaptures
            onReset={() => {
              setQuery("");
              setStatus("all");
              setSort("recent");
            }}
          />
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Reports include the currently filtered captures from your account.
        </p>
      </section>
      <CapturePipeline />
    </div>
  );
}
