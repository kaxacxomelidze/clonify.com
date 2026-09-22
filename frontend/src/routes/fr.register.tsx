import { createFileRoute } from "@tanstack/react-router";
import { RegisterPage } from "@/components/site/account-pages";
import { siteHead } from "@/lib/site-head";

export const Route = createFileRoute("/fr/register")({
  head: () => siteHead("fr", "register"),
  component: RegisterPage,
});
