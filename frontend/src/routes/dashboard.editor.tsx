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
      { title: "Website editor — Clonyfy" },
      {
        name: "description",
        content: "Click any text to edit it, restyle your website and export it with Clonyfy.",
      },
    ],
  }),
  component: EditorPage,
});

function EditorPage() {
  const { outDir, route } = Route.useSearch();
  if (!outDir) {
    return (
      <div className="mx-auto flex h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-2xl">Website editor</h1>
        <p className="text-sm text-muted-foreground">
          Open a finished clone from your dashboard to customize it.
        </p>
        <Link to="/dashboard" className="dashboard-button inline-flex">
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>
      </div>
    );
  }
  // The editor is a full-screen workspace with its own top bar (back link included).
  return <VisualEditor outDir={outDir} initialRoute={route || "/"} />;
}
