import { useSiteLanguage } from "@/hooks/use-site-language";
import { useId, type PointerEvent } from "react";
import type { gsap as Gsap } from "gsap";
import { useScene } from "@/hooks/use-scene";
import { BrandMark } from "./brand";

/** A mathematical ribbon sculpture, drawn as vector contours rather than a bitmap. */
export function Ribbon({ className = "" }: { className?: string }) {
  const id = useId().replaceAll(":", "");
  return (
    <svg viewBox="0 0 360 360" fill="none" className={`ribbon-art ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="80" y1="30" x2="280" y2="330" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--sculpture-light)" />
          <stop offset=".4" stopColor="var(--sculpture-mid)" />
          <stop offset=".65" stopColor="var(--sculpture-light)" />
          <stop offset="1" stopColor="var(--sculpture-dark)" />
        </linearGradient>
      </defs>
      <g className="ribbon-contours" transform="translate(180 180) rotate(-32)">
        {Array.from({ length: 42 }, (_, i) => {
          const t = i / 41;
          // Keep SVG coordinates identical across server and browser math implementations.
          return (
            <ellipse
              key={i}
              cx={(Math.sin(t * Math.PI * 2) * 18).toFixed(4)}
              cy={((t - 0.5) * 132).toFixed(4)}
              rx={(64 + Math.sin(t * Math.PI) * 52).toFixed(4)}
              ry={(22 + Math.sin(t * Math.PI) * 39).toFixed(4)}
              stroke={`url(#${id})`}
              strokeWidth={1.25}
              transform={`rotate(${(t * 90 - 45).toFixed(4)})`}
            />
          );
        })}
      </g>
    </svg>
  );
}

export function SampleSite({
  wireframe = false,
  edited = false,
}: {
  wireframe?: boolean;
  edited?: boolean;
}) {
  const { t: tr } = useSiteLanguage();
  return (
    <div className={`sample-site ${wireframe ? "is-wireframe" : ""} ${edited ? "is-edited" : ""}`}>
      <div className="sample-nav">
        <span>
          forma<span>®</span>
        </span>
        <div>
          <i />
          <i />
          <i />
        </div>
        <span>{tr("LET’S TALK ↗")}</span>
      </div>
      <div className="sample-content">
        <div className="sample-copy">
          <span className="sample-eyebrow">{tr("INDEPENDENT DESIGN STUDIO")}</span>
          <strong>
            {tr("Objects.")}
            <br />
            {tr("With a")}
            <br />
            <em>{tr("point of view.")}</em>
          </strong>
          <span className="sample-rule" />
          <span className="sample-bottom">
            {tr("Discover the collection")} <span>↗</span>
          </span>
        </div>
        <Ribbon />
      </div>
      <div className="sample-foot">
        <span>{tr("FORM MEETS FEELING.")}</span>
        <span>© FORMA STUDIO / 2026</span>
      </div>
      {wireframe && (
        <div className="wireframe-guides" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}

function animateStudio(gsap: typeof Gsap, element: HTMLDivElement) {
  const select = gsap.utils.selector(element);
  return gsap
    .timeline({ repeat: -1 })
    .fromTo(select(".scan-beam"), { top: "12%", opacity: 0 }, { opacity: 0.8, duration: 0.35 })
    .to(select(".scan-beam"), { top: "90%", duration: 2.5, ease: "power1.inOut" })
    .to(select(".scan-beam"), { opacity: 0, duration: 0.35 })
    .fromTo(
      select(".component-outline"),
      { opacity: 0 },
      { opacity: 1, duration: 0.7, stagger: 0.15 },
      "<",
    )
    .to(select(".component-outline"), { opacity: 0.3, duration: 1.5 }, "+=.5")
    .to(select(".ribbon-art"), { rotation: 360, duration: 24, ease: "none" }, 0);
}

export function CloneStudio() {
  const { t: tr } = useSiteLanguage();
  const ref = useScene(animateStudio);
  const tilt = (event: PointerEvent<HTMLDivElement>) => {
    if (
      event.pointerType !== "mouse" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty(
      "--scene-ry",
      `${((event.clientX - rect.left) / rect.width - 0.5) * 15}deg`,
    );
    el.style.setProperty(
      "--scene-rx",
      `${((event.clientY - rect.top) / rect.height - 0.5) * -10}deg`,
    );
  };
  const resetTilt = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty("--scene-rx", "0deg");
    event.currentTarget.style.setProperty("--scene-ry", "0deg");
  };
  return (
    <div ref={ref} className="clone-studio" onPointerMove={tilt} onPointerLeave={resetTilt}>
      <div className="studio-canvas">
        <div className="studio-orbit" aria-hidden="true">
          <span />
          <span />
        </div>
        <div className="source-window browser-frame">
          <div className="browser-bar">
            <div className="window-dots">
              <i />
              <i />
              <i />
            </div>
            <span>forma.example</span>
            <span>↗</span>
          </div>
          <SampleSite wireframe />
          <span className="window-label">{tr("01 / THE INSPIRATION")}</span>
        </div>
        <div className="result-window browser-frame">
          <div className="browser-bar">
            <BrandMark />
            <span>{tr("forma / your workspace")}</span>
            <span className="browser-status">{tr("EDITABLE")}</span>
          </div>
          <SampleSite />
          <div className="scan-beam" aria-hidden="true" />
          <div className="component-outline outline-title" aria-hidden="true">
            <span>Hero.tsx</span>
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="component-outline outline-art" aria-hidden="true">
            <span>Artwork.svg</span>
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="editor-bottom">
            <span>
              <span className="status-dot" /> React + Tailwind
            </span>
            <span>{tr("Yours to make your own. ↗")}</span>
          </div>
        </div>
      </div>
      <div className="studio-receipt">
        <BrandMark />
        <div>
          <strong>{tr("Good design. Your next starting point.")}</strong>
          <span>{tr("Structure captured. Possibilities unlocked.")}</span>
        </div>
      </div>
    </div>
  );
}
