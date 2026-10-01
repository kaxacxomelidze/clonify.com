import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Brand } from "@/components/site/brand";
import { useSignedIn } from "@/hooks/use-auth";
import { fetchPublicConfig } from "@/lib/api";
import {
  AffiliateFaq,
  AffiliateSteps,
  commissionLabel,
  WHOP_SIGNUP_URL,
} from "@/components/site/affiliate-program";

export const Route = createFileRoute("/affiliates")({
  head: () => ({
    meta: [
      { title: "Affiliate program — Clonyfy" },
      {
        name: "description",
        content:
          "Share Clonyfy and earn a commission on every paid plan you refer. Referrals and payouts run through Whop.",
      },
    ],
  }),
  component: AffiliatesLanding,
});

function AffiliatesLanding() {
  const signedIn = useSignedIn();
  const [commission, setCommission] = useState("");

  useEffect(() => {
    fetchPublicConfig()
      .then((config) => setCommission(config.affiliate_commission || ""))
      .catch(() => {});
  }, []);

  return (
    <div className="site-width mx-auto max-w-5xl px-4 py-16">
      <Link to="/" className="mb-12 inline-block" aria-label="Clonyfy home">
        <Brand />
      </Link>
      <p className="eyebrow">Affiliate program</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight md:text-5xl">Earn with Clonyfy</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Recommend Clonyfy to designers, developers and agencies. Earn {commissionLabel(commission)}{" "}
        on the paid plans they buy. Whop tracks every referral and pays you directly.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {signedIn ? (
          <Link
            to="/dashboard/affiliates"
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground"
          >
            Get your link
          </Link>
        ) : (
          <>
            <Link
              to="/register"
              className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground"
            >
              Create a free account
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-11 items-center rounded-full border border-border px-6 text-sm"
            >
              Log in to get your link
            </Link>
          </>
        )}
        <a
          href={WHOP_SIGNUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-full border border-border px-6 text-sm"
        >
          Open Whop
        </a>
      </div>

      <section aria-labelledby="how" className="mt-16 space-y-5">
        <h2 id="how" className="font-display text-2xl">
          How it works
        </h2>
        <AffiliateSteps commission={commission} />
      </section>

      <section aria-labelledby="faq" className="mt-16 space-y-5">
        <h2 id="faq" className="font-display text-2xl">
          Questions
        </h2>
        <AffiliateFaq />
      </section>
    </div>
  );
}
