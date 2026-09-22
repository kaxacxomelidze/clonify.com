import { useSiteLanguage } from "@/hooks/use-site-language";
import { Link } from "@tanstack/react-router";
import { Instagram } from "lucide-react";
import { Reveal } from "@/components/anim";
import { Brand } from "./brand";

const COLS = [
  {
    title: "Product",
    links: [
      { label: "Process", href: "#process" },
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Support", href: "mailto:support@clonyfy.com" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function Footer() {
  const { t: tr, language } = useSiteLanguage();
  return (
    <footer className="studio-footer relative overflow-hidden border-t border-border">
      <div className="footer-inner site-width pt-16">
        <div className="footer-grid grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <Reveal className="footer-intro">
            <div>
              <Brand />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-foreground/60">
                {tr("We don't help you start from scratch. We help you start from reality.")}
              </p>
              <a
                href="https://www.instagram.com/clonyfy"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm text-foreground/65 transition-colors duration-300 hover:text-foreground"
              >
                <Instagram size={18} aria-hidden="true" />
                Instagram
                <span className="sr-only"> {tr("(opens in a new tab)")}</span>
              </a>
            </div>
          </Reveal>

          {COLS.map((c, i) => (
            <Reveal key={c.title} className="footer-group" delay={0.08 * (i + 1)}>
              <div>
                <p className="eyebrow">{tr(c.title)}</p>
                <ul className="mt-5 space-y-3">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="group relative text-sm text-foreground/65 transition-colors duration-300 hover:text-foreground"
                      >
                        {tr(l.label)}
                        <span className="absolute -bottom-0.5 left-0 h-px w-full origin-right scale-x-0 bg-foreground transition-transform duration-500 group-hover:origin-left group-hover:scale-x-100" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}

          <Reveal className="footer-group" delay={0.24}>
            <div>
              <p className="eyebrow">{tr("Account")}</p>
              <ul className="mt-5 space-y-3 text-sm">
                <li>
                  <Link
                    to={language === "fr" ? "/fr/login" : "/login"}
                    className="text-foreground/65 transition-colors hover:text-foreground"
                  >
                    {tr("Log in")}
                  </Link>
                </li>
                <li>
                  <Link
                    to={language === "fr" ? "/fr/register" : "/register"}
                    className="text-foreground/65 transition-colors hover:text-foreground"
                  >
                    {tr("Create account")}
                  </Link>
                </li>
              </ul>
            </div>
          </Reveal>
        </div>

        <div className="footer-legal mt-16 flex flex-col gap-4 border-t border-border py-8 text-xs text-foreground/50 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {tr("Clonyfy. All rights reserved.")}
          </span>
          <span>{tr("Built for people who ship.")}</span>
        </div>

        {/* Each letter responds independently to the pointer. */}
        <div aria-hidden className="footer-wordmark">
          {"Clonyfy.".split("").map((letter, index) => (
            <span key={index} style={{ transitionDelay: `${index * 25}ms` }}>
              {letter}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
