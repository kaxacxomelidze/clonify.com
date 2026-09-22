import { createFileRoute } from "@tanstack/react-router";
import { Planner } from "@/components/dashboard/planner";
export const Route = createFileRoute("/dashboard/tasks")({
  head: () => ({ meta: [{ title: "My tasks — Clonyfy dashboard" }] }),
  component: Planner,
});
