import { useSiteLanguage } from "@/hooks/use-site-language";
import { Reveal, SplitHeading } from "@/components/anim";
import { Cta } from "./cta";
import { BrandMark, ArrowGlyph } from "./brand";
export function FinalCta() {
  const { t: tr } = useSiteLanguage();
  return (
    <section className="closing-section">
      <div className="closing-art" aria-hidden="true">
        <BrandMark />
      </div>
      <div className="site-width">
        <Reveal>
          <p className="section-index">{tr("11 / THE NEXT MOVE IS YOURS")}</p>
        </Reveal>
        <SplitHeading
          as="h2"
          scrollTriggered
          text={tr("Stop thinking.")}
          className="closing-heading"
        />
        <SplitHeading
          as="h2"
          scrollTriggered
          text={tr("Build what works.")}
          className="closing-heading muted-type"
        />
        <Reveal>
          <div className="closing-actions">
            <p>
              {tr("Join +9000 entrepreneurs.")}
              <br />
              {tr("Your next great project starts with a URL.")}
            </p>
            <Cta className="editorial-cta">
              {tr("Get Instant Access")}
              <ArrowGlyph />
            </Cta>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
