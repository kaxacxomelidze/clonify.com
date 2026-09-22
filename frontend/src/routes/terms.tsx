import { createFileRoute, Link } from "@tanstack/react-router";
import { Brand } from "@/components/site/brand";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Clonyfy" },
      { name: "description", content: "Terms for using Clonyfy to clone and export websites." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="site-width mx-auto max-w-3xl px-4 py-16">
      <Link to="/" className="mb-10 inline-block">
        <Brand />
      </Link>
      <h1 className="font-display text-4xl tracking-tight">Terms of Service</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated: September 8, 2026</p>
      <div className="mt-10 space-y-6 text-sm leading-relaxed text-foreground/80">
        <p>
          By using Clonyfy you agree to clone only sites you are authorized to archive or redesign,
          and to respect robots.txt, copyright, and applicable law.
        </p>
        <p>
          Clonyfy provides best-effort captures and exports. Output quality depends on the source
          site. Paid plans unlock higher limits and ZIP/GitHub features as configured by the
          operator.
        </p>
        <p>
          Accounts may be suspended for abuse, scraping that harms third parties, or payment fraud.
          Subscriptions renew until cancelled through billing settings or Stripe Customer Portal.
        </p>
        <p>
          Questions:{" "}
          <a className="underline underline-offset-4" href="mailto:support@clonyfy.com">
            support@clonyfy.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
