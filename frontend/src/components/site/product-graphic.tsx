import { useSiteLanguage } from "@/hooks/use-site-language";
import type { gsap as Gsap } from "gsap";
import { useScene } from "@/hooks/use-scene";

export type GraphicKind =
  "speed" | "code" | "editor" | "figma" | "git" | "security" | "pages" | "export";

function animateGraphic(gsap: typeof Gsap, element: HTMLDivElement) {
  const select = gsap.utils.selector(element);
  const timeline = gsap.timeline({ repeat: -1, repeatDelay: 2 });
  if (select("[data-bar]").length)
    timeline.fromTo(
      select("[data-bar]"),
      { scaleY: 0.15, svgOrigin: "0 208" },
      { scaleY: 1, duration: 1.8, stagger: 0.14, ease: "power2.inOut" },
      0,
    );
  if (select("[data-rise]").length)
    timeline.fromTo(
      select("[data-rise]"),
      { y: 8, opacity: 0.5 },
      { y: 0, opacity: 1, duration: 1.7, stagger: 0.12, ease: "power2.inOut" },
    );
  if (select("[data-flow]").length)
    timeline.fromTo(
      select("[data-flow]"),
      { strokeDashoffset: 100 },
      { strokeDashoffset: 0, duration: 3, ease: "none" },
      0,
    );
  if (select("[data-knob]").length)
    timeline.to(
      select("[data-knob]"),
      { x: 28, duration: 2, yoyo: true, repeat: 1, ease: "power2.inOut" },
      0,
    );
  return timeline;
}

export function ProductGraphic({
  kind,
  className = "",
}: {
  kind: GraphicKind;
  className?: string;
}) {
  const { t: tr } = useSiteLanguage();
  const ref = useScene(animateGraphic);
  return (
    <div ref={ref} className={`product-graphic graphic-${kind} ${className}`}>
      <svg viewBox="0 0 480 280" fill="none" aria-hidden="true">
        <g className="graphic-guide" stroke="currentColor" opacity=".09">
          <path d="M30 30h14m-7-7v14M436 30h14m-7-7v14M30 250h14m-7-7v14M436 250h14m-7-7v14" />
        </g>
        {kind === "speed" && (
          <>
            <path d="M65 213H417" stroke="currentColor" opacity=".18" />
            {[42, 78, 119, 167].map((height, i) => (
              <g key={height}>
                <rect
                  data-bar
                  x={72 + i * 88}
                  y={208 - height}
                  width="57"
                  height={height}
                  rx="3"
                  fill="currentColor"
                  opacity={0.14 + i * 0.15}
                />
                <path d={`M${72 + i * 88} ${208 - height}h57`} stroke="currentColor" opacity=".8" />
                <text x={100 + i * 88} y="235" textAnchor="middle">
                  {[tr("CAPTURE"), tr("ANALYZE"), tr("STRUCTURE"), tr("READY")][i]}
                </text>
              </g>
            ))}
            <path
              d="M69 164C133 165 114 144 195 138S282 64 405 50"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeDasharray="5 5"
              data-flow
            />
            <circle cx="405" cy="50" r="4" fill="currentColor" />
          </>
        )}
        {kind === "code" && (
          <>
            <rect x="42" y="38" width="396" height="207" rx="7" className="graphic-panel" />
            <path d="M42 76H438M77 76V245" stroke="currentColor" opacity=".13" />
            <text x="61" y="62">
              HeroSection.tsx
            </text>
            <text x="354" y="62">
              REACT ↗
            </text>
            {[
              "export function Hero() {",
              "  return (",
              '    <section className="py-24">',
              "      <h1>Make it yours.</h1>",
              "    </section>",
              "  );",
              "}",
            ].map((line, i) => (
              <g key={line} data-rise>
                <text x="56" y={101 + i * 19} opacity=".35">
                  {i + 1}
                </text>
                <text x="91" y={101 + i * 19} className="code-svg-line">
                  {line}
                </text>
              </g>
            ))}
            <path
              d="M398 208v14"
              stroke="currentColor"
              strokeWidth="5"
              data-flow
              strokeDasharray="6 4"
            />
          </>
        )}
        {kind === "editor" && (
          <>
            <rect x="45" y="41" width="272" height="194" rx="6" className="graphic-panel" />
            <path d="M66 65h32M269 65h27M66 91H296" stroke="currentColor" opacity=".3" />
            <rect x="64" y="114" width="157" height="12" rx="2" fill="currentColor" opacity=".65" />
            <rect x="64" y="135" width="120" height="7" rx="2" fill="currentColor" opacity=".15" />
            <rect
              x="61"
              y="170"
              width="126"
              height="36"
              rx="3"
              stroke="currentColor"
              strokeDasharray="3 3"
              data-flow
            />
            <rect x="68" y="177" width="112" height="22" rx="3" fill="currentColor" />
            <text x="86" y="192" fill="var(--background)">
              {tr("MAKE IT YOURS ↗")}
            </text>
            <g data-rise>
              <rect x="268" y="102" width="170" height="132" rx="6" className="graphic-panel" />
              <text x="282" y="125">
                {tr("DESIGN PROPERTIES")}
              </text>
              <path d="M282 140h140" stroke="currentColor" opacity=".15" />
              <text x="282" y="160">
                {tr("Radius")}
              </text>
              <path d="M339 157h71" stroke="currentColor" opacity=".4" />
              <circle cx="350" cy="157" r="4" fill="currentColor" data-knob />
              <text x="282" y="186">
                {tr("Spacing")}
              </text>
              <path d="M339 183h71" stroke="currentColor" opacity=".4" />
              <circle cx="364" cy="183" r="4" fill="currentColor" data-knob />
              <text x="282" y="212">
                {tr("Color")}
              </text>
              <circle cx="347" cy="209" r="6" fill="currentColor" />
              <circle cx="366" cy="209" r="6" fill="currentColor" opacity=".4" />
              <circle cx="385" cy="209" r="6" fill="currentColor" opacity=".15" />
            </g>
          </>
        )}
        {kind === "figma" && (
          <>
            {[0, 1, 2].map((i) => (
              <g key={i} transform={`translate(${(i - 1) * 20} ${-i * 27})`}>
                <g data-rise>
                  <path d="M103 168 224 222 363 164 242 110Z" className="graphic-panel" />
                  <path
                    d="m132 168 91 39 109-45-91-38Z"
                    stroke="currentColor"
                    opacity={0.18 + i * 0.18}
                  />
                </g>
              </g>
            ))}
            <path
              d="M242 38V81M110 91l40 18M342 69l-34 29"
              stroke="currentColor"
              opacity=".35"
              strokeDasharray="3 4"
              data-flow
            />
            <rect x="237" y="31" width="9" height="9" stroke="currentColor" />
            <circle cx="107" cy="89" r="4" fill="currentColor" />
            <circle cx="345" cy="67" r="4" fill="currentColor" />
            <text x="240" y="258" textAnchor="middle">
              {tr("LAYERS. VECTORS. FULLY EDITABLE.")}
            </text>
          </>
        )}
        {kind === "git" && (
          <>
            <path
              d="M119 50V226M119 90C119 127 246 81 246 129V173C246 208 119 166 119 222"
              stroke="currentColor"
              opacity=".25"
            />
            <path
              d="M119 50V226M119 90C119 127 246 81 246 129V173C246 208 119 166 119 222"
              stroke="currentColor"
              strokeDasharray="5 11"
              data-flow
            />
            {[55, 91, 160, 221].map((y, i) => (
              <g key={y}>
                <circle cx="119" cy={y} r="6" className="graphic-panel" />
                <circle cx="119" cy={y} r="2" fill="currentColor" />
                <text x="139" y={y + 3}>
                  {["main", "initial clone", "edit hero", tr("merge & ship")][i]}
                </text>
              </g>
            ))}
            <circle cx="246" cy="135" r="6" className="graphic-panel" />
            <text x="264" y="139">
              your-next-idea
            </text>
            <rect x="281" y="186" width="142" height="30" rx="4" className="graphic-panel" />
            <text x="352" y="205" textAnchor="middle">
              {tr("CHANGES COMMITTED ✓")}
            </text>
          </>
        )}
        {kind === "security" && (
          <>
            <circle cx="240" cy="131" r="98" stroke="currentColor" opacity=".08" />
            <circle
              cx="240"
              cy="131"
              r="80"
              stroke="currentColor"
              opacity=".13"
              strokeDasharray="2 7"
              data-flow
            />
            <path
              d="M240 61 298 82V134C298 174 269 196 240 208 211 196 182 174 182 134V82Z"
              className="graphic-panel"
            />
            <g data-rise>
              <rect x="218" y="123" width="44" height="35" rx="6" stroke="currentColor" />
              <path
                d="M227 123V113a13 13 0 0 1 26 0v10M240 137v7"
                stroke="currentColor"
                strokeWidth="2"
              />
            </g>
            <path
              d="M60 131H159M321 131H420"
              stroke="currentColor"
              opacity=".3"
              strokeDasharray="3 6"
              data-flow
            />
            <text x="240" y="244" textAnchor="middle">
              {tr("YOUR CONTENT. YOUR CONTROL.")}
            </text>
          </>
        )}
        {kind === "pages" && (
          <>
            <path
              d="M240 104V143M83 173V143H397V173M187 143V173M292 143V173"
              stroke="currentColor"
              opacity=".35"
              strokeDasharray="3 4"
              data-flow
            />
            <rect x="184" y="38" width="112" height="66" rx="5" className="graphic-panel" />
            <path d="M196 53h37M196 67h87M196 78h59" stroke="currentColor" opacity=".4" />
            <text x="240" y="95" textAnchor="middle">
              {tr("/ HOME")}
            </text>
            {["/pricing", "/features", "/about", "/docs"].map((p, i) => (
              <g key={p}>
                <rect
                  x={42 + i * 104}
                  y="173"
                  width="83"
                  height="63"
                  rx="4"
                  className="graphic-panel"
                />
                <path
                  d={`M${54 + i * 104} 187h33m-33 9h56m-56 9h43`}
                  stroke="currentColor"
                  opacity=".25"
                />
                <text x={83 + i * 104} y="225" textAnchor="middle">
                  {p}
                </text>
              </g>
            ))}
          </>
        )}
        {kind === "export" && (
          <>
            <path
              d="M240 140C180 140 145 67 94 67M240 140C180 140 145 215 94 215M240 140C300 140 335 67 386 67M240 140C300 140 335 215 386 215"
              stroke="currentColor"
              opacity=".28"
            />
            <path
              d="M240 140C180 140 145 67 94 67M240 140C180 140 145 215 94 215M240 140C300 140 335 67 386 67M240 140C300 140 335 215 386 215"
              stroke="currentColor"
              strokeDasharray="4 16"
              data-flow
            />
            <rect x="206" y="106" width="68" height="68" rx="12" className="graphic-panel" />
            <rect
              x="222"
              y="122"
              width="24"
              height="24"
              rx="6"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect
              x="234"
              y="134"
              width="24"
              height="24"
              rx="6"
              stroke="currentColor"
              strokeWidth="2"
            />
            {[
              { x: 45, y: 45, t: tr("ZIP / CODE") },
              { x: 45, y: 193, t: "GITHUB" },
              { x: 338, y: 45, t: "VERCEL" },
              { x: 338, y: 193, t: "NETLIFY" },
            ].map((p) => (
              <g key={p.t} data-rise>
                <rect x={p.x} y={p.y} width="96" height="44" rx="6" className="graphic-panel" />
                <text x={p.x + 48} y={p.y + 26} textAnchor="middle">
                  {p.t} ↗
                </text>
              </g>
            ))}
          </>
        )}
      </svg>
    </div>
  );
}
