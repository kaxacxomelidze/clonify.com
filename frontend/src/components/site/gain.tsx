import { useSiteLanguage } from "@/hooks/use-site-language";
import { Reveal, SplitHeading } from "@/components/anim";
import { GainEquation } from "./section-motion";

const GAINS = [
  {
    head: "+7 Days → 2 Minutes.",
    body: "Stop rebuilding what already exists. Clone it, adapt it, ship it.",
  },
  {
    head: "Edit without coding.",
    body: "The visual editor lets you modify any page directly in the browser.",
  },
  {
    head: "Figma file included.",
    body: "Every clone generates a ready-to-share Figma file.",
  },
  {
    head: "Deploy in 1 click.",
    body: "Next.js 14, Dockerfile included. Vercel, Netlify, Railway, your own VPS — ready to ship in 2 minutes.",
  },
];

export function Gain() {
  const { t: tr } = useSiteLanguage();
  return (
    <section className="gain-section">
      <div className="site-width">
        <p className="section-index">{tr("06 / WHAT YOU ACTUALLY GAIN")}</p>
        <div className="gain-head">
          <SplitHeading
            as="h2"
            scrollTriggered
            text={tr("Start from reality.")}
            className="gain-title"
          />
          <p>
            {tr("We don't help you start from scratch.")}
            <br />
            {tr("We help you start from reality.")}
          </p>
        </div>
        <GainEquation />
        <p className="gain-summary">
          {tr("The fastest way to rebuild, redesign & ship any website.")}
        </p>
        <div className="gain-points">
          {GAINS.map((g, i) => (
            <Reveal key={g.head}>
              <span>0{i + 1}</span>
              <h3>{tr(g.head)}</h3>
              <p>{tr(g.body)}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
