import { useSiteLanguage } from "@/hooks/use-site-language";
import { BrandMark } from "./brand";
import { OrbitScene } from "./section-motion";
const PILLS = [
  "I can't afford a developer",
  "I saw the perfect website",
  "Builders are too limiting",
  "I don't have time to learn",
  "Design isn't my thing",
  "Freelancers are too slow",
];
export function Orbit() {
  const { t: tr } = useSiteLanguage();
  return (
    <section className="possibility-section">
      <div className="site-width">
        <p className="section-index">{tr("01 / LESS EXCUSES. MORE POSSIBILITIES.")}</p>
        <OrbitScene>
          <svg className="orbit-art" viewBox="0 0 700 700" fill="none" aria-hidden="true">
            <circle cx="350" cy="350" r="275" stroke="currentColor" opacity=".12" />
            <circle cx="350" cy="350" r="205" stroke="currentColor" opacity=".08" />
            <circle cx="350" cy="75" r="4" fill="currentColor" />
            <circle cx="350" cy="625" r="3" fill="currentColor" opacity=".4" />
            <path d="M337 66h26m-13-13v26" stroke="currentColor" opacity=".3" />
          </svg>
          <div className="orbit-center">
            <BrandMark />
            <h2>
              {tr("You don't need excuses.")}
              <br />
              <span>{tr("You need Clonyfy.")}</span>
            </h2>
            <p>
              {tr(
                "We are not building a website builder. We are building a website production accelerator that integrates into existing workflows and reduces site creation from days to minutes.",
              )}
            </p>
            <span className="orbit-price">{tr("GET YOURS FOR JUST $19.99 ↗")}</span>
          </div>
          <div className="orbit-pill-field">
            {PILLS.map((p, i) => {
              const angle = (i / PILLS.length) * Math.PI * 2 - Math.PI / 2;
              return (
                <div
                  key={p}
                  className="orbit-pill"
                  style={{
                    left: `calc(50% + ${Math.cos(angle) * 39}%)`,
                    top: `calc(50% + ${Math.sin(angle) * 39}%)`,
                  }}
                >
                  <span className="orbit-pill-inner">{tr(p)}</span>
                </div>
              );
            })}
          </div>
        </OrbitScene>
      </div>
    </section>
  );
}
