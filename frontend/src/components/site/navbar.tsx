import { useSiteLanguage } from "@/hooks/use-site-language";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Brand } from "./brand";
import { LanguageSwitcher } from "./language-switcher";

import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Process", href: "#process" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function Navbar() {
  const { t: tr, language } = useSiteLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          "mx-auto flex max-w-7xl items-center justify-between px-5 transition-all duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
          scrolled ? "mt-3 rounded-full py-2.5 glass md:px-6" : "mt-0 py-5",
        )}
        style={scrolled ? { maxWidth: "72rem" } : undefined}
      >
        <Link
          to={language === "fr" ? "/fr" : "/"}
          className="flex shrink-0 items-center"
          aria-label={tr("Clonyfy home")}
        >
          <Brand />
        </Link>

        <nav className="hidden items-center gap-5 lg:flex xl:gap-8">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="group relative text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
            >
              {tr(l.label)}
              <span className="absolute -bottom-1 left-0 h-px w-full origin-right scale-x-0 bg-foreground transition-transform duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:origin-left group-hover:scale-x-100" />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link
            to={language === "fr" ? "/fr/login" : "/login"}
            className="hidden items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_18px_50px_-22px_var(--foreground)] transition-transform duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] sm:inline-flex"
          >
            {tr("Log in")}
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? tr("Close menu") : tr("Open menu")}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            className="grid h-9 w-9 place-items-center rounded-full border border-border lg:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-navigation"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="mx-4 mt-2 overflow-hidden rounded-3xl glass p-5 lg:hidden"
          >
            <div className="flex flex-col gap-1">
              {LINKS.map((l, i) => (
                <motion.a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.06 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="border-b border-border/60 py-3 font-display text-2xl tracking-tight"
                >
                  {tr(l.label)}
                </motion.a>
              ))}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  to={language === "fr" ? "/fr/login" : "/login"}
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
                >
                  {tr("Log in")}
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
