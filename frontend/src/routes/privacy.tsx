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
      <p className="mt-3 text-sm text-muted-foreground">Last updated: November 18, 2026</p>
      <div className="prose-invert mt-10 space-y-8 text-sm leading-relaxed text-foreground/80">
        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">1. Who we are</h2>
          <p>
            Clonyfy is operated by [COMPANY_LEGAL_NAME], [REGISTERED_ADDRESS] (the “data
            controller”). For any question about this policy, contact{" "}
            <a className="underline underline-offset-4" href="mailto:support@clonyfy.com">
              support@clonyfy.com
            </a>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">2. Data we collect</h2>
          <p>
            Account details (name, email, hashed password), clone job metadata, usage events, and
            payment records needed to operate the product. We do not sell personal data.
          </p>
          <p>
            Captured site content is stored so you can preview and export your projects. Deleting a
            clone from the dashboard removes its files, preview and share links from our servers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">3. How we use it</h2>
          <p>
            To provide and secure the service, process payments, prevent abuse, measure product
            usage (sign-up, onboarding, paywall, purchase and churn funnel events), and send
            service-related messages. Legal bases include performance of our contract with you, our
            legitimate interests in running and improving the service, and your consent where
            required.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">4. Authentication &amp; payments</h2>
          <p>
            Authentication uses session tokens. Google and GitHub OAuth are optional and only used
            when you choose “Sign in with Google/GitHub”. Payments are processed by Whop; Clonyfy
            never stores full card numbers. Bot-protection on sign-in/sign-up is provided by
            Cloudflare Turnstile.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">5. Affiliates</h2>
          <p>
            If you arrive through an affiliate link (ending in <code>?a=</code>), the affiliate’s
            Whop username is kept in your browser and on your account for 30 days and shared with
            Whop when you buy a plan, so Whop can credit and pay that affiliate. If you join the
            affiliate program, we store the Whop username you enter.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">6. Sharing &amp; processors</h2>
          <p>
            We share data only with processors that help us run the service — including our hosting
            provider, Whop (payments and affiliates), optional Google/GitHub sign-in, Cloudflare
            (security), and our email provider — under appropriate agreements. We may disclose data
            where required by law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">7. Retention</h2>
          <p>
            We keep account and billing data for as long as your account is active and as required
            to meet legal obligations, then delete or anonymise it. You can delete your account from
            Settings, which removes your clones, files and share links.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">8. Your rights</h2>
          <p>
            Subject to applicable law (including the GDPR where relevant), you may access, correct,
            delete, port, or restrict processing of your data, and object to processing based on
            legitimate interests. To exercise these rights, email{" "}
            <a className="underline underline-offset-4" href="mailto:support@clonyfy.com">
              support@clonyfy.com
            </a>
            . You may also lodge a complaint with your local supervisory authority.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">9. Cookies &amp; international transfers</h2>
          <p>
            We use strictly necessary cookies/local storage for sessions and preferences, and
            minimal analytics to measure the funnel described above. Where data is transferred
            outside your region, we rely on appropriate safeguards such as standard contractual
            clauses.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">10. Changes &amp; contact</h2>
          <p>
            We may update this policy and will revise the “last updated” date above. Questions or
            requests:{" "}
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
