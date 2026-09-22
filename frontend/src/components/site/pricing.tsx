import { useSiteLanguage } from "@/hooks/use-site-language";
import { useState, useRef, useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Reveal, SplitHeading } from "@/components/anim";
import { Cta } from "./cta";
import { ArrowGlyph } from "./brand";
const PLANS = [
  {
    name: "Starter",
    price: 19.99,
    note: "≈ 1 coffee per week",
    blurb: "For testing on real projects before committing.",
    action: "Get started",
    popular: false,
    features: [
      "10 Website Clones / Month",
      "Unlimited Screens",
      "Code & ZIP Export",
      "Visual Builder & Editor",
      "6 Days/Week Support",
      "Cancel Anytime",
    ],
  },
  {
    name: "Growth",
    price: 29.99,
    note: "",
    blurb: "For growing teams shipping faster every week.",
    action: "Start now",
    popular: true,
    features: [
      "25 Website Clones / Month",
      "Unlimited Screens",
      "Code & ZIP Export",
      "Figma Export",
      "Visual Builder & Editor",
      "Access to Templates",
      "API Access",
      "6 Days/Week Support",
      "Cancel Anytime",
    ],
  },
  {
    name: "Scale",
    price: 59.99,
    note: "",
    blurb: "For high-volume cloning with priority support.",
    action: "Start now",
    popular: false,
    features: [
      "Unlimited Website Clones",
      "Unlimited Screens",
      "Code & ZIP Export",
      "Figma Export",
      "Visual Builder & Editor",
      "Access to Templates",
      "API Access",
      "7 Days/Week Priority Support",
      "Cancel Anytime",
    ],
  },
];

export function Pricing() {
  const { t: tr, language, locale } = useSiteLanguage();
  const amount = (value: number) =>
    value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [yearly, setYearly] = useState(false);
  const [selected, setSelected] = useState(1);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [light, setLight] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const active = hovered ?? focused ?? selected;
  const grid = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    const measure = () => {
      const card = cards.current[active];
      if (!card) return;
      const parent = el.getBoundingClientRect(),
        bounds = card.getBoundingClientRect();
      setLight({
        x: bounds.left - parent.left,
        y: bounds.top - parent.top,
        width: bounds.width,
        height: bounds.height,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    cards.current.forEach((card) => {
      if (card) observer.observe(card);
    });
    return () => observer.disconnect();
  }, [active, yearly]);
  return (
    <section id="pricing" className="pricing-section">
      <div className="site-width">
        <div className="section-heading-row">
          <div>
            <p className="section-index">{tr("09 / AN INVESTMENT IN MOMENTUM")}</p>
            <SplitHeading
              as="h2"
              scrollTriggered
              text={tr("Cheaper than a")}
              className="editorial-heading"
            />
            <SplitHeading
              as="h2"
              scrollTriggered
              text={tr("developer's hour.")}
              className="editorial-heading muted-type"
            />
          </div>
          <div className="billing-controls">
            <div className="billing-toggle" aria-label={tr("Billing period")}>
              {[tr("Monthly"), tr("Yearly")].map((label) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={(label === tr("Yearly")) === yearly}
                  onClick={() => setYearly(label === tr("Yearly"))}
                >
                  {label}
                </button>
              ))}
            </div>
            <span>{tr("20% less with yearly billing.")}</span>
          </div>
        </div>
        <div ref={grid} className="pricing-cards" onMouseLeave={() => setHovered(null)}>
          <motion.div
            aria-hidden="true"
            className="pricing-light"
            animate={light}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 210, damping: 29 }}
          />
          {PLANS.map((p, i) => (
            <article
              ref={(el) => {
                cards.current[i] = el;
              }}
              key={p.name}
              className={`price-card ${active === i ? "is-lit" : ""}`}
              onMouseEnter={() => setHovered(i)}
              onFocusCapture={() => setFocused(i)}
              onBlurCapture={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setFocused(null);
              }}
              onClick={() => setSelected(i)}
              data-plan={p.name}
            >
              <div className="plan-topline">
                <span>
                  0{i + 1} {tr("/ YOUR NEXT CHAPTER")}
                </span>
                {p.popular && <span className="popular-label">{tr("Most popular")}</span>}
              </div>
              <h3>
                <button
                  type="button"
                  aria-label={
                    language === "fr" ? `Choisir l’offre ${p.name}` : `Select ${p.name} plan`
                  }
                  aria-pressed={selected === i}
                  onClick={() => setSelected(i)}
                >
                  {p.name}
                  <ArrowGlyph />
                </button>
              </h3>
              <p className="plan-blurb">{tr(p.blurb)}</p>
              <div className="plan-price">
                <span className="text-5xl">
                  {language === "en" && "$"}
                  {amount(yearly ? p.price * 0.8 : p.price)}
                </span>
                <span>{language === "fr" ? "$US /mois" : "/mo"}</span>
              </div>
              <p className="billing-note">
                {yearly
                  ? language === "fr"
                    ? `${amount(p.price * 12 * 0.8)} $US facturés par an`
                    : `$${(p.price * 12 * 0.8).toFixed(2)} billed yearly`
                  : tr(p.note || "Billed monthly. Cancel anytime.")}
              </p>
              <Cta size="md" className="plan-cta" variant={active === i ? "solid" : "ghost"}>
                {tr(p.action)}
                <ArrowGlyph />
              </Cta>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.3" />
                    </svg>
                    {tr(f)}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="pricing-bottomnote">
          <span>{tr("$2,000+ average dev cost for one site.")}</span>
          <span>{tr("YOURS IN MINUTES. YOURS TO KEEP. ↗")}</span>
        </div>
      </div>
    </section>
  );
}
