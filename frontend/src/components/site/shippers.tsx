import { useSiteLanguage } from "@/hooks/use-site-language";
import { Reveal, SplitHeading } from "@/components/anim";
import { Cta } from "./cta";

const GROUPS = [
  {
    title: "Agencies",
    body: "Clone a client's inspiration site in seconds. Redesign it, export clean code, deliver faster than your competitors quote.",
  },
  {
    title: "Freelancers",
    body: "Stop rebuilding from scratch. Clone the structure, make it yours, ship it tonight.",
  },
  {
    title: "Online Entrepreneurs",
    body: "See a site that converts. Clone the layout, swap the content, launch your offer.",
  },
];

export function Shippers() {
  const { t: tr } = useSiteLanguage();
  return (
    <section className="shippers-section">
      <div className="site-width">
        <div className="section-heading-row">
          <div>
            <p className="section-index">{tr("07 / FOR PEOPLE IN MOTION")}</p>
            <SplitHeading
              as="h2"
              scrollTriggered
              text={tr("Built for people")}
              className="editorial-heading"
            />
            <SplitHeading
              as="h2"
              scrollTriggered
              text={tr("who ship.")}
              className="editorial-heading muted-type"
            />
          </div>
          <Cta className="editorial-cta">
            {tr("Start Cloning")} <span aria-hidden="true">↗</span>
          </Cta>
        </div>
        <div className="shipper-rows">
          {GROUPS.map((g, i) => (
            <Reveal key={g.title}>
              <div className="shipper-row">
                <span>0{i + 1}</span>
                <h3>{tr(g.title)}</h3>
                <p>{tr(g.body)}</p>
                <svg viewBox="0 0 88 64" fill="none" aria-hidden="true">
                  <rect
                    x={10 + i * 6}
                    y="12"
                    width="42"
                    height="34"
                    rx="3"
                    stroke="currentColor"
                    opacity=".35"
                  />
                  <rect x="29" y="25" width="42" height="34" rx="3" stroke="currentColor" />
                  <path d="M42 43h14m-5-5 5 5-5 5" stroke="currentColor" />
                </svg>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
