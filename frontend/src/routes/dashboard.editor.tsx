import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { VisualEditor } from "@/components/dashboard/visual-editor";

type EditorSearch = {
  outDir?: string;
  route?: string;
};

export const Route = createFileRoute("/dashboard/editor")({
  validateSearch: (search: Record<string, unknown>): EditorSearch => {
    const outDir = search["outDir"];
    const route = search["route"];
    const result: EditorSearch = {};
    if (typeof outDir === "string" && outDir) result.outDir = outDir;
    if (typeof route === "string" && route) result.route = route;
    else result.route = "/";
    return result;
  },
  head: () => ({
    meta: [
      { title: "Visual editor — Clonyfy" },
      {
        name: "description",
        content: "Edit cloned pages in the browser and save changes to your Clonyfy Backend.",
      },
    ],
  }),
  component: EditorPage,
});

function EditorPage() {
  const { outDir, route } = Route.useSearch();
  if (!outDir) {
    return (
      <div className="space-y-4 p-2">
        <h1 className="font-display text-2xl">Visual editor</h1>
        <p className="text-sm text-muted-foreground">
          Open a finished clone from Library or Capture details to edit pages.
        </p>
        <Link to="/dashboard/library" className="dashboard-button inline-flex">
          <ArrowLeft size={16} />
          Back to library
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4 p-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Editor</p>
          <h1 className="mt-1 font-display text-2xl">Edit captured pages</h1>
        </div>
        <Link
          to="/dashboard/library"
          className="dashboard-button"
          search={{} as never}
        >
          <ArrowLeft size={16} />
          Library
        </Link>
      </div>
      <VisualEditor outDir={outDir} initialRoute={route || "/"} />
    </div>
  );
}
