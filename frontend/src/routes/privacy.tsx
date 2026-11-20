import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/site/legal-document";
import source from "@/content/legal/privacy-policy.md?raw";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Clonyfy" },
      { name: "description", content: "Privacy Policy for clonyfy.com, operated by Qlyra, Inc." },
    ],
  }),
  component: () => <LegalDocument source={source} current="/privacy" />,
});
