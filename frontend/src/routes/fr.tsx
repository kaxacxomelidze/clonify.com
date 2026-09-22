import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SiteNotFound } from "@/components/site/not-found";

export const Route = createFileRoute("/fr")({ component: Outlet, notFoundComponent: SiteNotFound });
