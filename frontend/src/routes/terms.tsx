import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/site/legal-document";
import source from "@/content/legal/terms-of-use.md?raw";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Clonyfy" },
      { name: "description", content: "Terms of Use for clonyfy.com, operated by Qlyra, Inc." },
    ],
  }),
  component: () => <LegalDocument source={source} current="/terms" />,
});
