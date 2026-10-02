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
      <p className="mt-3 text-sm text-muted-foreground">Last updated: October 2, 2026</p>
      <div className="mt-10 space-y-6 text-sm leading-relaxed text-foreground/80">
        <p>
          By using Clonyfy you agree to clone only sites you are authorized to archive or redesign,
          and to respect robots.txt, copyright, and applicable law.
        </p>
        <p>
          Clonyfy provides best-effort captures and exports. Output quality depends on the source
          site. Paid plans unlock the higher limits and features listed on the pricing page.
        </p>
        <p>
          Payments are processed by Whop. A paid plan starts once Whop confirms the payment, and
          subscriptions renew each billing period until cancelled in Subscription settings or on
          Whop. You can upgrade to a higher plan at any time. A cancelled plan stays active until
          the end of the period you paid for.
        </p>
        <p>
          Affiliates are credited and paid by Whop under Whop&apos;s terms. Referrals of your own
          account, misleading promotion, and spam don&apos;t qualify and may be removed.
        </p>
        <p>
          Accounts may be suspended for abuse, scraping that harms third parties, or payment fraud.
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
