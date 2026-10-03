import { BadgeDollarSign, Link2, UserRound } from "lucide-react";

export const WHOP_SIGNUP_URL = "https://whop.com";

/** "30% recurring" when the commission is configured, otherwise a neutral phrase. */
export function commissionLabel(commission?: string | undefined) {
  return commission ? `${commission} commission` : "a commission";
}

export function AffiliateSteps({ commission }: { commission?: string | undefined }) {
  const steps = [
    {
      icon: UserRound,
      title: "Use your Whop account",
      body: "Whop tracks referrals and pays commissions. A free Whop account is all you need.",
    },
    {
      icon: Link2,
      title: "Share your link",
      body: "Your link is clonyfy.com/?a=your-whop-username. Visitors are attributed to you for 30 days.",
    },
    {
      icon: BadgeDollarSign,
      title: "Get paid by Whop",
      body: `Earn ${commissionLabel(commission)} on paid plans your referrals buy. Whop pays out after its 30-day holding period.`,
    },
  ];
  return (
    <ol className="grid gap-4 md:grid-cols-3">
      {steps.map((step, i) => (
        <li key={step.title} className="surface rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border">
              <step.icon size={18} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="text-xs text-muted-foreground">Step {i + 1}</span>
          </div>
          <h3 className="mt-4 font-display text-lg">{step.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}

export const AFFILIATE_FAQ = [
  {
    q: "Do I need a Clonyfy plan to be an affiliate?",
    a: "No. Any Clonyfy account can create a link. Commissions are paid through Whop, so you also need a Whop account.",
  },
  {
    q: "How long does a referral count?",
    a: "30 days from the last click on your link. If someone signs up through your link, the referral stays on their account for that window, even if they buy from another device.",
  },
  {
    q: "Where do I see my referrals and earnings?",
    a: "In your Whop account. Whop records every referred payment, shows your earnings, and sends payouts.",
  },
  {
    q: "Do my own purchases count?",
    a: "No. Purchases made with the Clonyfy account that owns the link don't earn a commission.",
  },
  {
    q: "Which pages can I link to?",
    a: "Any Clonyfy page. Add ?a=your-whop-username to the end of the URL and the referral is tracked.",
  },
];

export function AffiliateFaq() {
  return (
    <div className="divide-y divide-border rounded-3xl border border-border">
      {AFFILIATE_FAQ.map((item) => (
        <details key={item.q} className="group p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
            {item.q}
            <span
              aria-hidden="true"
              className="text-muted-foreground transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
