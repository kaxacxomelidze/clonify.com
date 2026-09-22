import { useSiteLanguage } from "@/hooks/use-site-language";
import { Reveal, SplitHeading } from "@/components/anim";
import { ProductGraphic } from "./product-graphic";
export function Freedom() {
  const { t: tr } = useSiteLanguage();
  return (
    <section className="freedom-section">
      <div className="site-width freedom-layout">
        <div>
          <p className="section-index">{tr("05 / OWN EVERY PIXEL")}</p>
          <SplitHeading
            as="h2"
            scrollTriggered
            text={tr("Your code.")}
            className="editorial-heading"
          />
          <SplitHeading
            as="h2"
            scrollTriggered
            text={tr("Your rules.")}
            className="editorial-heading muted-type"
          />
          <Reveal>
            <p className="freedom-lead">{tr("Zero dependencies. Total freedom.")}</p>
            <p className="freedom-copy">
              {tr(
                "Export your project as a clean ZIP, push it to GitHub, or deploy instantly to Vercel, Netlify, or any host you want. No lock-in, no restrictions. If you ever decide to leave, your code leaves with you, fully yours, forever.",
              )}
            </p>
          </Reveal>
        </div>
        <Reveal className="freedom-diagram">
          <div className="diagram-label">
            <span>{tr("EXPORT ANYWHERE")}</span>
            <span>{tr("NO LOCK-IN ↗")}</span>
          </div>
          <ProductGraphic kind="export" />
          <div className="diagram-label">
            <span>{tr("YOUR WORKSPACE")}</span>
            <span>{tr("THE WORLD")}</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
