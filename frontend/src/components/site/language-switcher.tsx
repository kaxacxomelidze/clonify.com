import { useRouterState } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { useSiteLanguage } from "@/hooks/use-site-language";
import { localizePath, type SiteLanguage } from "@/lib/site-language";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

const getHash = () => window.location.hash;
const getServerHash = () => "";

export function LanguageSwitcher() {
  const { language } = useSiteLanguage();
  const location = useRouterState({ select: (state) => state.location });
  // URL fragments are not sent to the server, so read them after hydration.
  const hash = useSyncExternalStore(subscribeToHash, getHash, getServerHash);
  return (
    <nav
      className="language-switcher"
      aria-label={language === "fr" ? "Langue du site" : "Website language"}
    >
      {(["en", "fr"] as const).map((option: SiteLanguage) => (
        <a
          key={option}
          href={`${localizePath(location.pathname.replace(/\/$/, "") || "/", option)}${location.searchStr}${hash}`}
          hrefLang={option}
          lang={option}
          aria-label={option === "fr" ? "Lire le site en français" : "Read the site in English"}
          aria-current={language === option ? "page" : undefined}
        >
          {option.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}
