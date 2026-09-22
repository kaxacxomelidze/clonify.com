import { createFileRoute, Link } from "@tanstack/react-router";
import { Brand } from "@/components/site/brand";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Clonyfy" },
      { name: "description", content: "How Clonyfy collects and uses account and clone data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="site-width mx-auto max-w-3xl px-4 py-16">
      <Link to="/" className="mb-10 inline-block">
        <Brand />
      </Link>
      <h1 className="font-display text-4xl tracking-tight">Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated: September 8, 2026</p>
      <div className="prose-invert mt-10 space-y-6 text-sm leading-relaxed text-foreground/80">
        <p>
          Clonyfy processes account details (name, email, password hash), clone job metadata, and
          payment records needed to operate the product. We do not sell personal data.
        </p>
        <p>
          Captured site content is stored so you can preview and export your projects. Delete a
          clone from the dashboard to remove that output from your account when the Backend supports
          deletion for that folder.
        </p>
        <p>
          Authentication uses session tokens. Google OAuth is optional and only used when you choose
          Sign in with Google. Stripe processes card data when payments are enabled; Clonyfy does
          not store full card numbers.
        </p>
        <p>
          Contact{" "}
          <a className="underline underline-offset-4" href="mailto:support@clonyfy.com">
            support@clonyfy.com
          </a>{" "}
          for privacy requests.
        </p>
      </div>
    </div>
  );
}
