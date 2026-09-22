import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/site/landing-page";
import { siteHead } from "@/lib/site-head";

export const Route = createFileRoute("/fr/")({
  head: () => siteHead("fr"),
  component: LandingPage,
});
