import type { gsap as Gsap } from "gsap";
import { useScene } from "@/hooks/use-scene";

function animatePipeline(gsap: typeof Gsap, element: HTMLDivElement) {
  return gsap
    .timeline({ repeat: -1, repeatDelay: 0.6 })
    .fromTo(
      element.querySelectorAll(".pipeline-packet"),
      { scaleX: 0.15, opacity: 0.25 },
      {
        scaleX: 1,
        opacity: 0.8,
        duration: 1.2,
        stagger: 0.5,
        transformOrigin: "left center",
        ease: "power1.inOut",
      },
    )
    .to(
      element.querySelectorAll(".pipeline-line"),
      { opacity: 0.35, duration: 0.8, stagger: 0.15, yoyo: true, repeat: 1 },
      0.4,
    );
}

export function CapturePipeline() {
  const ref = useScene(animatePipeline);
  return (
    <div ref={ref} className="capture-pipeline">
      <div>
        <p className="eyebrow">From source to starting point</p>
        <h2>Your next build starts here.</h2>
        <p>Capture the pages. Keep the assets. Make it yours.</p>
      </div>
      <ol className="pipeline-stages" aria-label="Website capture workflow">
        {["Source", "Capture", "Create"].map((label, index) => (
          <li key={label}>
            <svg viewBox="0 0 136 112" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="134" height="110" rx="12" stroke="var(--border)" />
              <path d="M1 24h134" stroke="var(--border)" />
              <g fill="var(--foreground)">
                <circle cx="16" cy="12" r="2" />
                <circle cx="24" cy="12" r="2" opacity=".5" />
                <circle cx="32" cy="12" r="2" opacity=".25" />
              </g>
              {index === 0 ? (
                <g fill="var(--foreground)">
                  <rect className="pipeline-line" x="16" y="40" width="60" height="8" rx="3" />
                  <rect
                    className="pipeline-packet"
                    x="16"
                    y="60"
                    width="104"
                    height="4"
                    rx="2"
                    opacity=".4"
                  />
                  <rect x="16" y="72" width="68" height="4" rx="2" opacity=".3" />
                </g>
              ) : index === 1 ? (
                <g fill="var(--foreground)">
                  <rect x="16" y="40" width="44" height="52" rx="4" opacity=".15" />
                  <rect
                    className="pipeline-line"
                    x="72"
                    y="40"
                    width="44"
                    height="24"
                    rx="4"
                    opacity=".65"
                  />
                  <rect
                    className="pipeline-packet"
                    x="72"
                    y="72"
                    width="44"
                    height="20"
                    rx="4"
                    opacity=".25"
                  />
                </g>
              ) : (
                <path
                  className="pipeline-line"
                  d="m40 52-12 12 12 12m56-24 12 12-12 12m-24-32-12 40"
                  stroke="var(--foreground)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
            <span>
              <small>0{index + 1}</small>
              {label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
