import { useSiteLanguage } from "@/hooks/use-site-language";
import { useEffect, useRef, type ReactNode } from "react";
import type { gsap as Gsap } from "gsap";
import { useScene } from "@/hooks/use-scene";

function animateOrbit(gsap: typeof Gsap, element: HTMLDivElement) {
  const select = gsap.utils.selector(element);
  return gsap
    .timeline({ repeat: -1 })
    .to(select(".orbit-art"), { rotation: 360, duration: 60, ease: "none" })
    .to(
      select(".orbit-pill-inner"),
      {
        y: -9,
        duration: 3,
        yoyo: true,
        repeat: 19,
        stagger: { each: 0.2, from: "center" },
        ease: "sine.inOut",
      },
      0,
    );
}

export function OrbitScene({ children }: { children: ReactNode }) {
  const ref = useScene(animateOrbit);
  return (
    <div ref={ref} className="orbit-scene">
      {children}
    </div>
  );
}

function animateComparison(gsap: typeof Gsap, element: HTMLDivElement) {
  const select = gsap.utils.selector(element);
  return gsap
    .timeline({ repeat: -1, repeatDelay: 2 })
    .fromTo(
      select(".comparison-trail"),
      { strokeDashoffset: 100 },
      {
        strokeDashoffset: 0,
        duration: 3.5,
        ease: "none",
      },
    )
    .fromTo(
      select(".comparison-shortcut"),
      { strokeDashoffset: 1 },
      {
        strokeDashoffset: 0,
        duration: 0.9,
        ease: "power2.inOut",
      },
      0.35,
    );
}

export function ComparisonGraphic() {
  const { t: tr } = useSiteLanguage();
  const ref = useScene(animateComparison);
  return (
    <div ref={ref} className="comparison-art" aria-hidden="true">
      <svg viewBox="0 0 440 240" fill="none">
        <path d="M20 135H420" stroke="currentColor" opacity=".12" />
        <text x="20" y="21" opacity=".6">
          {tr("REBUILD FROM ZERO")}
        </text>
        <text x="420" y="21" textAnchor="end" opacity=".6">
          {tr("7 DAYS")}
        </text>
        <path
          d="M28 88H76V55H125V112H176V66H227V103H278V49H331V88H407"
          stroke="currentColor"
          opacity=".4"
          className="comparison-route"
        />
        <path
          d="M28 88H76V55H125V112H176V66H227V103H278V49H331V88H407"
          stroke="currentColor"
          strokeDasharray="6 14"
          className="comparison-route comparison-trail"
        />
        <circle cx="28" cy="88" r="5" fill="var(--background)" stroke="currentColor" />
        <circle cx="407" cy="88" r="5" fill="var(--background)" stroke="currentColor" />
        <text x="20" y="163">
          {tr("START WITH CLONYFY")}
        </text>
        <text x="420" y="163" textAnchor="end">
          {tr("2 MIN.")}
        </text>
        <path d="M28 202H407" stroke="currentColor" opacity=".18" strokeWidth="3" />
        <path
          d="M28 202H407"
          stroke="currentColor"
          strokeWidth="3"
          pathLength="1"
          strokeDasharray="1"
          className="comparison-shortcut"
        />
        <circle cx="28" cy="202" r="5" fill="currentColor" />
        <path d="m397 192 10 10-10 10" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span>{tr("LESS FRICTION. MORE FORWARD.")}</span>
    </div>
  );
}

export function GainEquation() {
  const { t: tr } = useSiteLanguage();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        if (disposed || !ref.current) return;
        gsap.registerPlugin(ScrollTrigger);
        const element = ref.current;
        const media = gsap.matchMedia();
        media.add("(prefers-reduced-motion: no-preference)", () => {
          const select = gsap.utils.selector(element);
          gsap
            .timeline({
              scrollTrigger: {
                trigger: element,
                start: "top 82%",
                end: "bottom top",
                toggleActions: "restart none restart reset",
              },
            })
            .from(
              select(".gain-before"),
              { x: -20, opacity: 0, duration: 0.55, ease: "power2.out" },
              0,
            )
            .from(
              select(".gain-after"),
              { x: 20, opacity: 0, duration: 0.55, ease: "power2.out" },
              0.12,
            )
            .from(select(".gain-strike"), { scaleX: 0, duration: 0.65, ease: "power2.inOut" }, 0.9);
        });
        cleanup = () => media.revert();
      },
    );
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
  return (
    <div ref={ref} className="gain-equation" aria-label={tr("From over seven days to two minutes")}>
      <span className="gain-before" aria-hidden="true">
        {tr("7 days")}
        <i className="gain-strike" />
      </span>
      <svg viewBox="0 0 150 50" fill="none" aria-hidden="true">
        <path d="M0 25H142m-25-23 25 23-25 23" stroke="currentColor" />
      </svg>
      <strong className="gain-after" aria-hidden="true">
        {tr("2 min.")}
      </strong>
    </div>
  );
}
