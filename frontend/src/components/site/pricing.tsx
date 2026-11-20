import { useSiteLanguage } from "@/hooks/use-site-language";
import { useState, useRef, useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Reveal, SplitHeading } from "@/components/anim";
import { Cta } from "./cta";
import { useSignedIn } from "@/hooks/use-auth";
import { ArrowGlyph } from "./brand";
import { PRICING_PLANS, annualPerMonth, annualTotal, type PlanKey } from "@/lib/pricing";
/** Card copy around the shared pricing table (lib/pricing.ts holds prices and features). */
const CARD_COPY: Record<PlanKey, { note: string; blurb: string; action: string }> = {
  starter: {
    note: "≈ 1 coffee per week",
    blurb: "For testing on real projects before committing.",
    action: "Get started",
  },
  growth: { note: "", blurb: "For growing teams shipping faster every week.", action: "Start now" },
  unlimited: {
    note: "",
    blurb: "For high-volume cloning across every project.",
    action: "Start now",
  },
};

export function Pricing() {
  const { t: tr, language, locale } = useSiteLanguage();
  const amount = (value: number) =>
    value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [yearly, setYearly] = useState(false);
  const signedIn = useSignedIn();
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
            <span>{tr("45% less with yearly billing.")}</span>
          </div>
        </div>
        <div ref={grid} className="pricing-cards" onMouseLeave={() => setHovered(null)}>
          <motion.div
            aria-hidden="true"
            className="pricing-light"
            animate={light}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 210, damping: 29 }}
          />
          {PRICING_PLANS.map((p, i) => {
            const copy = CARD_COPY[p.key];
            return (
            <article
              ref={(el) => {
                cards.current[i] = el;
              }}
              key={p.key}
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
              <p className="plan-blurb">{tr(copy.blurb)}</p>
              <div className="plan-price">
                {yearly && (
                  <s className="plan-price-was">
                    {language === "en" && "$"}
                    {amount(p.monthly)}
                  </s>
                )}
                <span className="text-5xl">
                  {language === "en" && "$"}
                  {amount(yearly ? annualPerMonth(p.monthly) : p.monthly)}
                </span>
                <span>{language === "fr" ? "$US /mois" : "/mo"}</span>
              </div>
              <p className="billing-note">
                {yearly
                  ? language === "fr"
                    ? `${amount(annualTotal(p.monthly))} $US facturés par an`
                    : `${annualTotal(p.monthly).toFixed(2)} billed yearly`
                  : tr(copy.note || "Billed monthly. Cancel anytime.")}
              </p>
              <Cta
                size="md"
                className="plan-cta"
                variant={active === i ? "solid" : "ghost"}
                href={`${signedIn ? "/checkout" : language === "fr" ? "/fr/register" : "/register"}?plan=${p.key}${yearly ? "&interval=annual" : ""}`}
              >
                {tr(copy.action)}
                <ArrowGlyph />
              </Cta>
              <ul>
                {p.features.map((f) =>
                  f.included ? (
                    <li key={f.label}>
                      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.3" />
                      </svg>
                      {tr(f.label)}
                    </li>
                  ) : (
                    <li key={f.label} className="plan-feature-excluded">
                      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path
                          d="M4.5 4.5l7 7M11.5 4.5l-7 7"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="sr-only">{tr("Not included:")} </span>
                      {tr(f.label)}
                    </li>
                  ),
                )}
              </ul>
            </article>
            );
          })}
        </div>
        <div className="pricing-bottomnote">
          <span>{tr("$2,000+ average dev cost for one site.")}</span>
          <span>{tr("YOURS IN MINUTES. YOURS TO KEEP. ↗")}</span>
        </div>
      </div>
    </section>
  );
}
