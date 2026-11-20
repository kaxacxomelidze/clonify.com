import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/site/legal-document";
import source from "@/content/legal/legal-notice.md?raw";

export const Route = createFileRoute("/legal-notice")({
  head: () => ({
    meta: [
      { title: "Legal Notice — Clonyfy" },
      { name: "description", content: "Legal Notice for clonyfy.com, operated by Qlyra, Inc." },
    ],
  }),
  component: () => <LegalDocument source={source} current="/legal-notice" />,
});
