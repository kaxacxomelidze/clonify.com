import { useId } from "react";
import type { gsap as Gsap } from "gsap";
import { useScene } from "@/hooks/use-scene";

function animateEngine(gsap: typeof Gsap, element: HTMLDivElement) {
  const select = gsap.utils.selector(element);
  return gsap
    .timeline({ repeat: -1 })
    .to(
      select(".engine-meridian"),
      {
        scaleX: 0.12,
        transformOrigin: "50% 50%",
        duration: 2,
        stagger: 0.3,
        yoyo: true,
        repeat: 1,
        ease: "sine.inOut",
      },
      0,
    )
    .to(
      select(".engine-orbit"),
      { rotation: 360, svgOrigin: "116 188", duration: 8, ease: "none" },
      0,
    )
    .fromTo(
      select(".engine-packet"),
      { x: 0, opacity: 0 },
      {
        x: 80,
        opacity: 1,
        duration: 1.5,
        stagger: 0.6,
        repeat: 3,
        repeatDelay: 0.2,
        ease: "power1.inOut",
      },
      0,
    )
    .to(
      select(".engine-core"),
      {
        scale: 1.08,
        transformOrigin: "50% 50%",
        duration: 1,
        yoyo: true,
        repeat: 7,
        ease: "sine.inOut",
      },
      0,
    )
    .to(
      select(".engine-page"),
      { y: -62, duration: 3, yoyo: true, repeat: 1, repeatDelay: 1, ease: "power1.inOut" },
      0,
    )
    .to(select(".engine-scan"), { y: 86, duration: 2, repeat: 3, ease: "none" }, 0);
}

export function CloneEngine({ domain, running }: { domain: string; running: boolean }) {
  const id = useId().replaceAll(":", "");
  const ref = useScene(animateEngine, running);
  return (
    <div ref={ref} className="demo-scanning-browser">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <span className="min-w-0 truncate text-xs text-muted-foreground">{domain}</span>
        <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
          AI process · demo
        </span>
      </div>
      <svg
        viewBox="0 0 640 400"
        role="img"
        aria-label="A revolving source globe feeds pages into an AI reconstruction core, then into a scrolling editable workspace"
      >
        <defs>
          <clipPath id={`${id}-page`}>
            <rect x="444" y="138" width="156" height="116" rx="4" />
          </clipPath>
          <radialGradient id={`${id}-halo`}>
            <stop offset="0" stopColor="var(--foreground)" stopOpacity=".1" />
            <stop offset="1" stopColor="var(--foreground)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="320" cy="188" r="156" fill={`url(#${id}-halo)`} />
        <g fill="none" stroke="var(--border)">
          <path d="M36 84h568M36 300h568" />
          <path d="M188 188h92m84 0h68" strokeDasharray="3 7" />
          <path d="m264 182 6 6-6 6m150-12 6 6-6 6" stroke="var(--muted-foreground)" />
        </g>
        <g fill="none" stroke="var(--foreground)" strokeWidth="1.25">
          <circle cx="116" cy="188" r="68" opacity=".5" />
          <ellipse className="engine-meridian" cx="116" cy="188" rx="44" ry="68" opacity=".4" />
          <ellipse className="engine-meridian" cx="116" cy="188" rx="20" ry="68" opacity=".6" />
          <ellipse cx="116" cy="188" rx="68" ry="24" opacity=".3" />
          <path d="M48 188h136M59 152h114M59 224h114" opacity=".2" />
        </g>
        <g className="engine-orbit" fill="none">
          <ellipse
            cx="116"
            cy="188"
            rx="84"
            ry="36"
            transform="rotate(-35 116 188)"
            stroke="var(--muted-foreground)"
            strokeDasharray="3 6"
            opacity=".45"
          />
          <circle cx="185" cy="145" r="4" fill="var(--foreground)" />
        </g>
        <g fill="var(--foreground)">
          <rect className="engine-packet" x="192" y="185" width="10" height="6" rx="3" />
          <rect className="engine-packet" x="354" y="185" width="10" height="6" rx="3" />
        </g>
        <g className="engine-core">
          <rect
            x="280"
            y="148"
            width="80"
            height="80"
            rx="24"
            fill="var(--card)"
            stroke="var(--muted-foreground)"
          />
          <rect x="290" y="158" width="60" height="60" rx="18" fill="none" stroke="var(--border)" />
          <path
            d="M305 182h18v18h-18zm12-12h18v18h-18z"
            fill="none"
            stroke="var(--foreground)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>
        <rect
          x="432"
          y="110"
          width="180"
          height="156"
          rx="12"
          fill="var(--background)"
          stroke="var(--border)"
        />
        <path d="M432 132h180" stroke="var(--border)" />
        <g fill="var(--muted-foreground)">
          <circle cx="446" cy="121" r="2" />
          <circle cx="454" cy="121" r="2" opacity=".6" />
          <circle cx="462" cy="121" r="2" opacity=".3" />
        </g>
        <g clipPath={`url(#${id}-page)`}>
          <g className="engine-page">
            <rect x="448" y="146" width="88" height="7" rx="3" fill="var(--foreground)" />
            <path d="M448 166h140m-140 10h104" stroke="var(--muted-foreground)" opacity=".4" />
            <rect
              x="448"
              y="190"
              width="64"
              height="18"
              rx="9"
              fill="var(--foreground)"
              opacity=".7"
            />
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <rect
                  x={448 + i * 50}
                  y="222"
                  width="42"
                  height="68"
                  rx="6"
                  fill="var(--card)"
                  stroke="var(--border)"
                />
                <path
                  d={`M${456 + i * 50} 240h26m-26 10h18`}
                  stroke="var(--muted-foreground)"
                  opacity=".5"
                />
              </g>
            ))}
          </g>
          <path
            className="engine-scan"
            d="M444 142h156"
            stroke="var(--foreground)"
            strokeOpacity=".5"
          />
          <path d="m568 206 3 20 5-7 8-2Z" fill="var(--foreground)" stroke="var(--background)" />
        </g>
        <g fontSize="12" textAnchor="middle" fill="var(--foreground)">
          <text x="116" y="326">
            01 · Discover
          </text>
          <text x="320" y="326">
            02 · Reconstruct
          </text>
          <text x="522" y="326">
            03 · Make it yours
          </text>
        </g>
        <g fontSize="10" textAnchor="middle" fill="var(--muted-foreground)">
          <text x="116" y="348">
            Pages + assets
          </text>
          <text x="320" y="348">
            Structure + components
          </text>
          <text x="522" y="348">
            Preview + export
          </text>
        </g>
        <text x="36" y="56" fill="var(--muted-foreground)" fontSize="10" letterSpacing="3">
          FROM SOURCE TO WORKSPACE
        </text>
        <text x="604" y="56" textAnchor="end" fill="var(--foreground)" fontSize="10">
          {running ? "PROCESSING" : "READY"}
        </text>
      </svg>
    </div>
  );
}
