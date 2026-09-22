import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/site/account-pages";
import { siteHead } from "@/lib/site-head";

export const Route = createFileRoute("/login")({
  head: () => siteHead("en", "login"),
  component: LoginPage,
});
