import { useSiteLanguage } from "@/hooks/use-site-language";
import { Reveal, SplitHeading } from "@/components/anim";
import { ComparisonGraphic } from "./section-motion";

const TRADITIONAL = [
  "Paying thousands for a website",
  "Spending weeks rebuilding something that already exists",
  "Learning design just to launch a product",
  "Waiting on a freelancer who delivers late and over budget",
  "Starting from a blank page every single time",
];

const CLONYFY = [
  "Clone any site in 2 minutes, full code, yours forever",
  "Redesign it visually, no coding required",
  "Export to Figma, ZIP, or deploy directly",
  "Launch today, not next month",
  "Complete code ownership, no lock-in",
];

const AUDIENCE = [
  {
    title: "Online Hustlers",
    body: "See a site that works. Clone it, make it yours, launch it today.",
  },
  {
    title: "Developers",
    body: "Speed up frontend development and skip repetitive rebuilds.",
  },
  {
    title: "Agencies",
    body: "Deliver client websites faster and increase margins.",
  },
];

export function Problem() {
  const { t: tr } = useSiteLanguage();
  return (
    <section className="problem-section">
      <div className="site-width">
        <p className="section-index">{tr("02 / A BETTER STARTING POINT")}</p>
        <div className="problem-layout">
          <div>
            <SplitHeading
              as="h2"
              scrollTriggered
              text={tr("Stop doing it")}
              className="editorial-heading"
            />
            <SplitHeading
              as="h2"
              scrollTriggered
              text={tr("the hard way.")}
              direction="right"
              className="editorial-heading muted-type"
            />
            <ComparisonGraphic />
          </div>
          <div className="comparison-columns">
            <Reveal>
              <h3>
                <span>−</span> {tr("Traditional way")}
              </h3>
              <ul>
                {TRADITIONAL.map((t) => (
                  <li key={t}>{tr(t)}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.12} className="comparison-better">
              <h3>
                <span>+</span> {tr("The Clonyfy way")}
              </h3>
              <ul>
                {CLONYFY.map((t) => (
                  <li key={t}>{tr(t)}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
        <div className="audience-strip">
          {AUDIENCE.map((a, i) => (
            <Reveal key={a.title}>
              <span className="audience-index">0{i + 1}</span>
              <div>
                <h4>{tr(a.title)}</h4>
                <p>{tr(a.body)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
