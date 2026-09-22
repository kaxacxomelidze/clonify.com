import { useSiteLanguage } from "@/hooks/use-site-language";
import { useState } from "react";
import { Reveal, SplitHeading } from "@/components/anim";

const TESTIMONIALS = [
  {
    quote:
      "Clonyfy saved us 3 weeks of work. We cloned a competitor's pricing page, tweaked it to match our brand, and shipped the same day. Insane ROI.",
    initials: "SC",
    name: "Sarah Chen",
    role: "Head of Growth, Orbit SaaS",
  },
  {
    quote:
      "The code output is actually clean. I was expecting messy div soup but it exports proper components with Tailwind. I'd write it similarly myself.",
    initials: "MO",
    name: "Marcus Okonkwo",
    role: "Senior Engineer, Liftoff",
  },
  {
    quote:
      "As a freelancer, I quote clients on day one and deliver prototypes the same afternoon. Clonyfy is essentially a second developer on my team.",
    initials: "PN",
    name: "Priya Nair",
    role: "Freelance Product Designer",
  },
  {
    quote:
      "We use it to build rapid reference designs before sprints. Cloning existing great UIs as a starting point is way faster than building from scratch.",
    initials: "JM",
    name: "Jake Morrison",
    role: "Design Lead, Cascade",
  },
  {
    quote:
      "The AI redesign mode is what keeps me here. I clone a site, then tell it 'make it more minimalist'. It just works every single time.",
    initials: "AW",
    name: "Aiko Watanabe",
    role: "Product Manager, Synthex",
  },
  {
    quote:
      "Setup was zero. Paste URL, wait 7 seconds, done. No API keys, no config. The competition takes 10 steps just to get started.",
    initials: "DV",
    name: "Dmitri Volkov",
    role: "CTO, Refract",
  },
  {
    quote:
      "We replaced our entire prototyping workflow with Clonyfy. The visual editor alone is worth the subscription. Super polished tool.",
    initials: "MP",
    name: "Maya Patel",
    role: "UX Director, Cloudform",
  },
  {
    quote:
      "Exported clean Next.js code on first try. I just had to swap in our actual data and it was basically production-ready. Wild.",
    initials: "BH",
    name: "Ben Hartley",
    role: "Fullstack Dev, Stackflow",
  },
];

export function SocialProof() {
  const { t: tr } = useSiteLanguage();
  const [active, setActive] = useState(0);
  const t = TESTIMONIALS[active]!;
  return (
    <section className="testimonials-section">
      <div className="site-width">
        <p className="section-index">{tr("08 / IN GOOD COMPANY")}</p>
        <div className="testimonial-layout">
          <div>
            <SplitHeading
              as="h2"
              scrollTriggered
              text={tr("Loved by builders")}
              className="editorial-heading"
            />
            <SplitHeading
              as="h2"
              scrollTriggered
              text={tr("everywhere.")}
              className="editorial-heading muted-type"
            />
            <p className="testimonial-intro">
              {tr(
                "9,000+ developers and designers trust Clonyfy for rapid prototyping and production deployments.",
              )}
            </p>
            <div className="testimonial-rating">
              <span>★★★★★</span>
              <span>{tr("4.9 / 5 USER RATING")}</span>
            </div>
          </div>
          <div className="testimonial-stage">
            <span className="quote-mark" aria-hidden="true">
              “
            </span>
            <figure key={active} className="customer-quote" aria-live="polite">
              <blockquote>{tr(t.quote)}</blockquote>
              <figcaption>
                <span className="customer-monogram">{t.initials}</span>
                <span>
                  <strong>{t.name}</strong>
                  <span>{tr(t.role)}</span>
                </span>
              </figcaption>
            </figure>
            <div className="testimonial-controls">
              <span>
                0{active + 1} / 0{TESTIMONIALS.length}
              </span>
              <div>
                <button
                  type="button"
                  aria-label={tr("Previous testimonial")}
                  onClick={() =>
                    setActive((i) => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)
                  }
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label={tr("Next testimonial")}
                  onClick={() => setActive((i) => (i + 1) % TESTIMONIALS.length)}
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
