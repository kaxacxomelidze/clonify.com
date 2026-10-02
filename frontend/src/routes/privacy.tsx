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
      <p className="mt-3 text-sm text-muted-foreground">Last updated: October 2, 2026</p>
      <div className="prose-invert mt-10 space-y-6 text-sm leading-relaxed text-foreground/80">
        <p>
          Clonyfy processes account details (name, email, password hash), clone job metadata, and
          payment records needed to operate the product. We do not sell personal data.
        </p>
        <p>
          Captured site content is stored so you can preview and export your projects. Deleting a
          clone from the dashboard removes its files, preview and share links from our servers.
        </p>
        <p>
          Authentication uses session tokens. Google and GitHub OAuth are optional and only used
          when you choose Sign in with Google or GitHub. Payments are processed by Whop; Clonyfy
          does not store full card numbers.
        </p>
        <p>
          If you arrive through an affiliate link (a link ending in <code>?a=</code>), the
          affiliate&apos;s Whop username is kept in your browser and on your account for 30 days and
          shared with Whop when you buy a plan, so Whop can credit and pay that affiliate. If you
          join the affiliate program, we store the Whop username you enter.
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
