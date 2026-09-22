import { useSiteLanguage } from "@/hooks/use-site-language";
import { useState, useRef, useEffect } from "react";
import { SplitHeading } from "@/components/anim";
import { SampleSite } from "./clone-studio";
import { ArrowGlyph, BrandMark } from "./brand";

const STEPS = [
  {
    n: "01",
    title: "Paste any URL",
    body: "Input any public website URL to start. Clonyfy will analyze the structure.",
    label: "A starting point. Not a blank page.",
  },
  {
    n: "02",
    title: "AI parsing & cloning",
    body: "Our Vision AI crawls the assets and structures the React components.",
    label: "Every detail, understood.",
  },
  {
    n: "03",
    title: "Redesign in browser",
    body: "Click any text, image, or section to edit visually. Code updates instantly.",
    label: "Their inspiration. Your expression.",
  },
  {
    n: "04",
    title: "1-Click deploy",
    body: "Export as React + Tailwind code, Figma file, or deploy directly to Vercel.",
    label: "All yours. Ready for the world.",
  },
];

export function HowItWorks() {
  const { t: tr } = useSiteLanguage();
  const [active, setActive] = useState(0);
  const [edited, setEdited] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let revert: (() => void) | undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    void import("gsap").then(({ gsap }) => {
      if (disposed || !panel.current) return;
      const context = gsap.context(() => {
        gsap.from("[data-step-content]", {
          y: 14,
          opacity: 0.2,
          duration: 0.65,
          ease: "power3.out",
        });
      }, panel);
      revert = () => context.revert();
    });
    return () => {
      disposed = true;
      revert?.();
    };
  }, [active]);
  return (
    <section id="process" className="process-section">
      <div className="site-width">
        <div className="section-heading-row">
          <div>
            <p className="section-index">
              <span>{tr("03 / THE PROCESS")}</span>
              <i />
            </p>
            <h2 className="editorial-heading">
              <SplitHeading
                as="span"
                className="block"
                text={tr("An idea. A URL.")}
                scrollTriggered
              />
              <SplitHeading
                as="span"
                className="block muted-type"
                text={tr("A head start.")}
                direction="right"
                scrollTriggered
              />
            </h2>
          </div>
          <p className="section-sidecopy">
            {tr("See the cloning process in action.")}
            <br />
            {tr("From raw URL to production-ready React component in under two minutes.")}
          </p>
        </div>
        <div className="process-layout">
          <div className="process-steps" aria-label={tr("Explore the cloning process")}>
            {STEPS.map((step, index) => (
              <button
                type="button"
                key={step.n}
                className={`process-step ${active === index ? "is-active" : ""}`}
                aria-pressed={active === index}
                aria-controls="process-preview"
                onClick={() => setActive(index)}
              >
                <span className="step-number">{step.n}</span>
                <span className="step-copy">
                  <strong>{tr(step.title)}</strong>
                  <span>{tr(step.body)}</span>
                </span>
                <ArrowGlyph />
              </button>
            ))}
            <p className="process-hint">
              {tr("FOUR STEPS. INFINITE POSSIBILITIES.")} <span>↗</span>
            </p>
          </div>
          <div ref={panel} id="process-preview" className="process-preview">
            <div className="preview-topbar">
              <span>
                <BrandMark /> {tr("THE CLONYFY WORKSPACE")}
              </span>
              <span>
                {tr("STEP")} {STEPS[active]?.n} / 04
              </span>
            </div>
            <div className="process-stage" data-step-content>
              <div className="process-stage-title">
                <span>0{active + 1}</span>
                <h3>{tr(STEPS[active]?.label)}</h3>
              </div>
              {active === 0 && (
                <>
                  <div className="demo-url">
                    <span>↗</span>
                    <span>https://forma.example</span>
                    <span className="demo-url-tag">{tr("READY TO CLONE")}</span>
                  </div>
                  <div className="process-sample">
                    <SampleSite />
                  </div>
                  <div className="stage-note">
                    <span className="status-dot" />{" "}
                    {tr("A public website. A world of possibilities.")}
                  </div>
                </>
              )}
              {active === 1 && (
                <div className="parsing-scene">
                  <div className="process-sample">
                    <SampleSite wireframe />
                  </div>
                  <div className="parse-components">
                    {["Navigation.tsx", "Hero.tsx", "Artwork.svg", "Footer.tsx"].map((file, i) => (
                      <div key={file}>
                        <span>0{i + 1}</span>
                        <strong>{file}</strong>
                        <span>{tr("EXTRACTED ✓")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {active === 2 && (
                <>
                  <div className="process-sample editable-sample">
                    <SampleSite edited={edited} />
                  </div>
                  <div className="demo-editor-controls">
                    <span>{tr("TRY A DIFFERENT DIRECTION")}</span>
                    <button
                      type="button"
                      aria-pressed={edited}
                      onClick={() => setEdited((e) => !e)}
                    >
                      {edited ? tr("Restore original") : tr("Invert the canvas")} <ArrowGlyph />
                    </button>
                  </div>
                  <div className="stage-note">
                    {tr("An editable design. With the code to match.")}
                  </div>
                </>
              )}
              {active === 3 && (
                <div className="export-scene">
                  <BrandMark className="export-brand" />
                  <span className="export-caption">{tr("forma / ready to ship")}</span>
                  <div className="export-files">
                    {["src / components", "public / artwork.svg", "package.json", "README.md"].map(
                      (file, i) => (
                        <div key={file}>
                          <span>{i === 0 ? "▱" : "↳"}</span>
                          {file}
                          <span>✓</span>
                        </div>
                      ),
                    )}
                  </div>
                  <div className="export-destinations">
                    {["React + Tailwind", "Figma", "ZIP", "Vercel"].map((v) => (
                      <span key={v}>{v} ↗</span>
                    ))}
                  </div>
                  <p>{tr("Your code leaves with you. Always.")}</p>
                </div>
              )}
            </div>
            <div className="preview-footer">
              <span>{tr("EXPLORE THE INTERACTIVE DEMO")}</span>
              <span>
                {tr("BUILT FROM POSSIBILITY")} <span>↗</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
