import { createFileRoute } from "@tanstack/react-router";
import { Planner } from "@/components/dashboard/planner";
export const Route = createFileRoute("/dashboard/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Clonyfy dashboard" }] }),
  component: () => <Planner calendar />,
});
