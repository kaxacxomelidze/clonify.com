import { createFileRoute, Link } from "@tanstack/react-router";
import { Brand } from "@/components/site/brand";

export const Route = createFileRoute("/legal-notice")({
  head: () => ({
    meta: [
      { title: "Legal Notice — Clonyfy" },
      { name: "description", content: "Legal notice and company information for Clonyfy." },
    ],
  }),
  component: LegalNoticePage,
});

/**
 * Placeholders in [BRACKETS] must be filled with the real company details before launch
 * (legal entity, registered address, registration number, publication director, host).
 */
function LegalNoticePage() {
  return (
    <div className="site-width mx-auto max-w-3xl px-4 py-16">
      <Link to="/" className="mb-10 inline-block">
        <Brand />
      </Link>
      <h1 className="font-display text-4xl tracking-tight">Legal Notice</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated: November 18, 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/80">
        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">1. Site publisher</h2>
          <p>
            This website, available at clonyfy.com (the “Site”), is published by
            [COMPANY_LEGAL_NAME], [COMPANY_FORM, e.g. LLC / SARL] with share capital of
            [SHARE_CAPITAL], registered at [COMPANY_REGISTRATION_NUMBER] and having its
            registered office at [REGISTERED_ADDRESS] (“Clonyfy”, “we”, “us”).
          </p>
          <p>VAT number: [VAT_NUMBER].</p>
          <p>Publication director: [PUBLICATION_DIRECTOR_NAME].</p>
          <p>
            Contact: <a className="underline underline-offset-2" href="mailto:support@clonyfy.com">support@clonyfy.com</a>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">2. Hosting</h2>
          <p>
            The Site is hosted by [HOSTING_PROVIDER_NAME], [HOSTING_PROVIDER_ADDRESS],
            [HOSTING_PROVIDER_CONTACT]. Clone previews and exported assets may be served from the
            same infrastructure.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">3. Intellectual property</h2>
          <p>
            The Clonyfy name, logo, interface, and original content are the property of
            [COMPANY_LEGAL_NAME] and are protected by applicable intellectual-property law. Any
            reproduction or use without prior written permission is prohibited.
          </p>
          <p>
            Websites you clone, and their trademarks and content, remain the property of their
            respective owners. You are responsible for holding the rights needed to clone, edit,
            and republish any site you process with Clonyfy.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">4. Liability</h2>
          <p>
            We make every effort to keep the information on the Site accurate and up to date, but
            cannot guarantee that it is error-free or continuously available. Use of the Site and
            the service is at your own risk, within the limits set out in our{" "}
            <Link to="/terms" className="underline underline-offset-2">
              Terms of Use
            </Link>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">5. Personal data &amp; cookies</h2>
          <p>
            Processing of personal data is described in our{" "}
            <Link to="/privacy" className="underline underline-offset-2">
              Privacy Policy
            </Link>
            . For any data-protection request, contact{" "}
            <a className="underline underline-offset-2" href="mailto:support@clonyfy.com">
              support@clonyfy.com
            </a>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-foreground">6. Governing law</h2>
          <p>
            This legal notice is governed by the laws of [GOVERNING_LAW_COUNTRY]. Any dispute
            relating to the Site falls under the jurisdiction of the competent courts of
            [JURISDICTION_CITY], subject to any mandatory consumer-protection rules.
          </p>
        </section>
      </div>

      <nav className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-sm">
        <Link to="/privacy" className="text-foreground/65 underline underline-offset-4 hover:text-foreground">
          Privacy Policy
        </Link>
        <Link to="/terms" className="text-foreground/65 underline underline-offset-4 hover:text-foreground">
          Terms of Use
        </Link>
      </nav>
    </div>
  );
}
