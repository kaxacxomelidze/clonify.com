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
      <h1 className="font-display text-4xl tracking-tight">Terms of Use</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated: November 18, 2026</p>
      <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/80">
        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">1. Acceptance</h2>
          <p>
            These Terms of Use govern your access to and use of Clonyfy, operated by
            [COMPANY_LEGAL_NAME] (“Clonyfy”, “we”). By creating an account or using the service you
            agree to these terms and to our{" "}
            <Link to="/privacy" className="underline underline-offset-2">
              Privacy Policy
            </Link>
            . If you do not agree, do not use the service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">2. The service</h2>
          <p>
            Clonyfy provides best-effort website captures, a visual editor, and exports (code, ZIP,
            and Figma). Output quality depends on the source site. Paid plans unlock the higher
            limits and features listed on the pricing page; add-ons grant extra one-time capacity.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">3. Acceptable use</h2>
          <p>
            You agree to clone only sites you are authorized to archive or redesign, and to respect
            robots.txt, intellectual-property rights, and applicable law. You must not use Clonyfy to
            scrape in a way that harms third parties, infringe others’ rights, or circumvent
            technical protections. You are solely responsible for the sites you process and the way
            you use the output.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">4. Accounts &amp; security</h2>
          <p>
            You are responsible for your account credentials and all activity under your account.
            Sign-in and sign-up may be protected by bot-detection (Cloudflare Turnstile). Keep your
            details accurate and notify us of any unauthorized use.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">5. Payments &amp; renewals</h2>
          <p>
            Payments are processed by Whop. A paid plan starts once Whop confirms the payment, and
            subscriptions renew each billing period until cancelled in Subscription settings or on
            Whop. Annual plans may be offered at a first-year discount and renew at the standard
            annual price. You can upgrade at any time; a cancelled plan stays active until the end of
            the period you paid for. Except where required by law, payments are non-refundable.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">6. Affiliates</h2>
          <p>
            Affiliates are credited and paid by Whop under Whop’s terms. Referrals of your own
            account, misleading promotion, and spam don’t qualify and may be removed.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">7. Intellectual property</h2>
          <p>
            Clonyfy and its original content are owned by [COMPANY_LEGAL_NAME]. Cloned websites and
            their content remain the property of their respective owners; you receive no rights in
            them from us. You retain ownership of projects you are entitled to create.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">8. Disclaimer &amp; liability</h2>
          <p>
            The service is provided “as is” without warranties of any kind. To the maximum extent
            permitted by law, Clonyfy is not liable for indirect or consequential damages, and our
            total liability is limited to the amount you paid in the 12 months before the event
            giving rise to the claim. Nothing limits liability that cannot be limited by law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">9. Suspension &amp; termination</h2>
          <p>
            Accounts may be suspended or terminated for abuse, scraping that harms third parties,
            payment fraud, or breach of these terms. You may stop using the service and delete your
            account at any time.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">10. Governing law &amp; changes</h2>
          <p>
            These terms are governed by the laws of [GOVERNING_LAW_COUNTRY], with the competent
            courts of [JURISDICTION_CITY] having jurisdiction, subject to mandatory consumer rules.
            We may update these terms and will revise the date above. Questions:{" "}
            <a className="underline underline-offset-4" href="mailto:support@clonyfy.com">
              support@clonyfy.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
