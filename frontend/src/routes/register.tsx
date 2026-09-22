import { createFileRoute } from "@tanstack/react-router";
import { RegisterPage } from "@/components/site/account-pages";
import { siteHead } from "@/lib/site-head";

export const Route = createFileRoute("/register")({
  head: () => siteHead("en", "register"),
  component: RegisterPage,
});
