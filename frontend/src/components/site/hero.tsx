import { useSiteLanguage } from "@/hooks/use-site-language";
import { useEffect, useRef } from "react";
import { HeroUrlCta } from "./hero-url-cta";
import { CloneStudio } from "./clone-studio";
import { HeroProof } from "./hero-proof";

export function Hero() {
  const { t: tr } = useSiteLanguage();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let disposed = false;
    let revert: (() => void) | undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    void import("gsap").then(({ gsap }) => {
      if (disposed || !ref.current) return;
      const context = gsap.context(() => {
        gsap.from("[data-hero-line]", {
          yPercent: 105,
          duration: 1.2,
          stagger: 0.11,
          ease: "expo.out",
        });
        gsap.from("[data-hero-reveal]", {
          y: 18,
          opacity: 0,
          duration: 1,
          stagger: 0.12,
          delay: 0.3,
          ease: "power3.out",
        });
      }, ref);
      revert = () => context.revert();
    });
    return () => {
      disposed = true;
      revert?.();
    };
  }, []);

  return (
    <section ref={ref} className="editorial-hero">
      <div className="hero-composition site-width">
        <div className="hero-editorial-copy">
          <h1 className="hero-heading">
            <span className="hero-line">
              <span data-hero-line>{tr("See it.")}</span>
            </span>
            <span className="hero-line">
              <span data-hero-line>{tr("Clone it.")}</span>
            </span>
            <span className="hero-line">
              <span data-hero-line className="hero-outline-type">
                {tr("Make it yours.")}
              </span>
            </span>
          </h1>
          <p className="hero-description" data-hero-reveal>
            {tr(
              "Clone any website with AI in seconds. Turn a URL into a pixel-perfect, fully editable starting point. No design or coding skills required.",
            )}
          </p>
          <div className="hero-actions" data-hero-reveal>
            <HeroUrlCta />
            <a href="#process" className="text-action">
              <span className="play-symbol">▷</span> {tr("See how it works")}
            </a>
          </div>
          <HeroProof />
        </div>
        <div className="hero-visual" data-hero-reveal>
          <CloneStudio />
        </div>
      </div>
    </section>
  );
}
