import { useSiteLanguage } from "@/hooks/use-site-language";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { Reveal, SplitHeading } from "@/components/anim";
import { Cta } from "./cta";

const ITEMS = [
  {
    q: "Is it legal to clone websites?",
    a: "CLONYFY is designed for legitimate use cases: prototyping, client pitches, competitive analysis, archival, and reference implementations. You are responsible for complying with each website's terms of service. We enforce robots.txt by default and never crawl at disruptive rates. Always ensure you have permission to capture and use a site's content.",
  },
  {
    q: "What kinds of sites work best?",
    a: "Marketing sites, landing pages, portfolios, documentation and SaaS pages clone with the highest fidelity. Heavily gated apps or canvas-driven experiences are partially supported.",
  },
  {
    q: "How long does cloning take?",
    a: "Most sites finish in about two minutes. Simple pages are done in seconds; large multi-page structures take a little longer while linked pages and shared layouts are processed in one pass.",
  },
  {
    q: "Can I deploy the generated project to Vercel?",
    a: "Yes. Export as a clean ZIP, push straight to GitHub, or deploy in one click to Vercel, Netlify, Railway or your own VPS. A Dockerfile is included.",
  },
  {
    q: "Do you store the captured pages on your servers?",
    a: "No. We never store your website content beyond your session. Clonyfy is SOC 2 Type II with AES-256 encryption, zero logs and GDPR compliance.",
  },
];

export function Faq() {
  const { t: tr } = useSiteLanguage();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="faq-section">
      <div className="site-width faq-layout">
        <div>
          <p className="section-index">{tr("10 / GOOD QUESTIONS")}</p>
          <SplitHeading
            as="h2"
            scrollTriggered
            text={tr("Everything you")}
            className="editorial-heading"
          />
          <SplitHeading
            as="h2"
            scrollTriggered
            text={tr("want to know.")}
            className="editorial-heading muted-type"
          />
          <p className="faq-contact">
            {tr("Can't find the answer?")}
            <br />
            {tr("Reach out to our")} <a href="mailto:support@clonyfy.com">{tr("support team ↗")}</a>
          </p>
        </div>
        <div className="faq-list">
          {ITEMS.map((item, i) => (
            <div key={item.q} className="faq-item">
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                aria-controls={`faq-answer-${i}`}
                id={`faq-question-${i}`}
              >
                <span className="faq-number">0{i + 1}</span>
                <span>{tr(item.q)}</span>
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M3 10h14M10 3v14" stroke="currentColor" />
                </svg>
              </button>
              <div
                id={`faq-answer-${i}`}
                role="region"
                aria-labelledby={`faq-question-${i}`}
                hidden={open !== i}
              >
                <p>{tr(item.a)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
