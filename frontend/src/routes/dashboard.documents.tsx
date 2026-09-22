import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileCode2, FileText, Table2 } from "lucide-react";
import { toast } from "sonner";
import { CaptureSearch, downloadCaptureReport } from "@/components/dashboard/captures";
import { buildDemoHtml, downloadDemoFile } from "@/components/dashboard/demo-preview";
import { useDashboardWorkspace } from "@/components/dashboard/workspace";

export const Route = createFileRoute("/dashboard/documents")({
  head: () => ({ meta: [{ title: "Documents — Clonyfy dashboard" }] }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const { jobs } = useDashboardWorkspace();
  const [query, setQuery] = useState("");
  const documents = [
    {
      title: "Capture report",
      kind: "CSV",
      description: "Every capture in your account, with page, asset and timing details.",
      icon: Table2,
      download: () => downloadCaptureReport(jobs),
    },
    {
      title: "Editable website concept",
      kind: "HTML",
      description: "A responsive standalone starter you can open locally and customize.",
      icon: FileCode2,
      download: () =>
        downloadDemoFile(
          "clonyfy-concept.html",
          buildDemoHtml("A better place to begin.", "#d8c6a3", "example.com"),
          "text/html",
        ),
    },
    {
      title: "Launch checklist",
      kind: "Markdown",
      description:
        "A practical checklist for taking a captured starting point into your own project.",
      icon: FileText,
      download: () =>
        downloadDemoFile(
          "launch-checklist.md",
          "# Clonyfy launch checklist\n\n- [ ] Review your page structure\n- [ ] Replace placeholder copy and assets\n- [ ] Check desktop and mobile layouts\n- [ ] Verify links, forms and keyboard access\n- [ ] Review titles and descriptions\n- [ ] Run your project build\n- [ ] Commit the finished work to your repository\n- [ ] Deploy and check the public site\n",
          "text/markdown",
        ),
    },
  ].filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="eyebrow">Keep the useful things close</p>
        <h1 className="display-lg mt-3">Documents</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Workspace reports and planning files for your captures.
        </p>
      </header>
      <CaptureSearch label="Search documents" value={query} onChange={setQuery} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {documents.map((item) => (
          <article key={item.title} className="surface flex flex-col rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <item.icon size={28} strokeWidth={1.25} />
              <span className="eyebrow">{item.kind}</span>
            </div>
            <h2 className="mt-8 text-xl">{item.title}</h2>
            <p className="mb-6 mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
            <button
              className="dashboard-button"
              onClick={() => {
                try {
                  item.download();
                  toast.success(`${item.title} downloaded.`);
                } catch {
                  toast.error("Download failed.");
                }
              }}
            >
              <Download size={16} />
              Download {item.kind}
            </button>
          </article>
        ))}
      </div>
      {!documents.length && (
        <p role="status" className="text-sm text-muted-foreground">
          No documents match this search.
        </p>
      )}
    </div>
  );
}
