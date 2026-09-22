import { DashboardSelect } from "@/components/dashboard/select";
import { useDashboardWorkspace } from "@/components/dashboard/workspace";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { LayoutGrid, List } from "lucide-react";
import type { CloneJob } from "@/components/dashboard/data";
import {
  CaptureDetails,
  CaptureSearch,
  CaptureTable,
  EmptyCaptures,
} from "@/components/dashboard/captures";

export const Route = createFileRoute("/dashboard/library")({
  head: () => ({
    meta: [
      { title: "Library — Clonyfy dashboard" },
      { name: "description", content: "Browse, search and inspect your captured sites." },
    ],
  }),
  component: LibraryPage,
});

function relativeUpdated(startedAt: string) {
  if (!startedAt || startedAt === "—") return "recently";
  return startedAt;
}

function LibraryPage() {
  const { jobs: CLONES, refreshJobs } = useDashboardWorkspace();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<CloneJob | null>(null);
  const term = query.trim().toLowerCase();
  const jobs = CLONES.filter((job) => job.domain.toLowerCase().includes(term));
  if (sort === "name") jobs.sort((a, b) => a.domain.localeCompare(b.domain));
  if (sort === "pages") jobs.sort((a, b) => b.pages - a.pages);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="eyebrow">Your workspace</p>
        <h1 className="display-lg mt-3">Build with your real product</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Your captured sites live here. Inspect a capture, preview it, or export the ZIP.
        </p>
      </header>
      <div className="dashboard-toolbar">
        <CaptureSearch value={query} onChange={setQuery} label="Search sites and captures" />
        <DashboardSelect
          label="Sort library"
          value={sort}
          onValueChange={setSort}
          options={[
            { value: "recent", label: "Recent first" },
            { value: "name", label: "Name A\u2013Z" },
            { value: "pages", label: "Most pages" },
          ]}
        />
        <div
          className="flex rounded-full border border-border p-1"
          role="group"
          aria-label="Project view"
        >
          {(["grid", "list"] as const).map((mode) => (
            <button
              key={mode}
              aria-label={`${mode} view`}
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
              className={`grid h-11 w-11 place-items-center rounded-full ${view === mode ? "bg-accent" : "text-muted-foreground"}`}
            >
              {mode === "grid" ? <LayoutGrid size={16} /> : <List size={16} />}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {jobs.length} captures
      </p>
      {jobs.length > 0 && (
        <div className="library-projects" data-view={view}>
          {jobs.map((item, i) => (
            <motion.article
              key={item.id}
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="surface rounded-3xl p-4"
            >
              <div className="library-preview aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-secondary/60 p-6">
                <div className="flex h-full flex-col justify-center">
                  <p className="font-display text-xl leading-tight tracking-tight">{item.domain}</p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {item.pages} pages · {item.assets} assets · {item.status}
                  </p>
                </div>
              </div>
              <div className="library-project-info mt-4 px-1">
                <h2 className="text-sm leading-relaxed">{item.domain}</h2>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Started {relativeUpdated(item.startedAt)}
                  </span>
                  <button className="dashboard-button" onClick={() => setSelected(item)}>
                    View details
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}
      <section className="surface rounded-3xl p-5 md:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-lg">Recent captures</h2>
          <Link to="/dashboard/activity" className="dashboard-button">
            View activity ↗
          </Link>
        </div>
        {jobs.length ? (
          <CaptureTable jobs={jobs} />
        ) : (
          <EmptyCaptures
            onReset={() => {
              setQuery("");
              setSort("recent");
            }}
          />
        )}
      </section>
      <CaptureDetails
        job={selected}
        onClose={() => setSelected(null)}
        onDeleted={() => void refreshJobs()}
      />
    </div>
  );
}
