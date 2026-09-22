import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/site/account-pages";
import { siteHead } from "@/lib/site-head";

export const Route = createFileRoute("/fr/login")({
  head: () => siteHead("fr", "login"),
  component: LoginPage,
});
