import { useSiteLanguage } from "@/hooks/use-site-language";
import { Reveal, SplitHeading } from "@/components/anim";
import { ProductGraphic, type GraphicKind } from "./product-graphic";
const FEATURES: { tag: string; title: string; body: string; kind: GraphicKind }[] = [
  {
    tag: "Speed",
    title: "2 min cloning",
    body: "Distributed AI pipeline processes even complex sites in about 2 minutes.",
    kind: "speed",
  },
  {
    tag: "Code",
    title: "Clean code output",
    body: "Export semantic React + Tailwind components. Production-ready architecture.",
    kind: "code",
  },
  {
    tag: "Editor",
    title: "Visual editor",
    body: "Click any element to edit text, colors, spacing or layout. Pixel-level precision.",
    kind: "editor",
  },
  {
    tag: "Design",
    title: "Figma export",
    body: "Convert any website into editable Figma designs.",
    kind: "figma",
  },
  {
    tag: "DevOps",
    title: "GitHub integration",
    body: "Push clones directly to a repo. Commit history, branches, and PRs built in.",
    kind: "git",
  },
  {
    tag: "Security",
    title: "Privacy-first",
    body: "We never store your website content beyond your session. SOC 2 Type II.",
    kind: "security",
  },
  {
    tag: "Scale",
    title: "Multi-page cloning",
    body: "Clone entire site structures — linked pages, shared layouts — all in one pass.",
    kind: "pages",
  },
];
export function Features() {
  const { t: tr } = useSiteLanguage();
  return (
    <section id="features" className="feature-section">
      <div className="site-width">
        <div className="section-heading-row">
          <div>
            <p className="section-index">{tr("04 / YOUR UNFAIR ADVANTAGE")}</p>
            <SplitHeading
              as="h2"
              scrollTriggered
              text={tr("Everything you need.")}
              className="editorial-heading"
            />
            <SplitHeading
              as="h2"
              scrollTriggered
              text={tr("Nothing you don't.")}
              direction="right"
              className="editorial-heading muted-type"
            />
          </div>
          <p className="section-sidecopy">
            {tr(
              "The distance between a great reference and your next great project just got smaller.",
            )}
          </p>
        </div>
        <div className="feature-composition">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} className={`feature-story feature-story-${i}`} delay={0.035 * i}>
              <article>
                <div className="feature-caption">
                  <span>
                    0{i + 1} / {tr(f.tag).toUpperCase()}
                  </span>
                  <span>↗</span>
                </div>
                <ProductGraphic kind={f.kind} />
                <div className="feature-description">
                  <h3>{tr(f.title)}</h3>
                  <p>{tr(f.body)}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
