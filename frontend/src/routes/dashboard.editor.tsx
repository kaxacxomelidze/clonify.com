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
        content: "Edit cloned pages in the browser and save changes to your Clonyfy project.",
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
  // The Studio is a full-height workspace with its own top bar (back link included).
  return (
    <div className="p-1">
      <VisualEditor outDir={outDir} initialRoute={route || "/"} />
    </div>
  );
}
