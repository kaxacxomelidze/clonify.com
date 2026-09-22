export type SiteLanguage = "en" | "fr";

export function getSiteLanguage(pathname: string): SiteLanguage {
  return pathname === "/fr" || pathname.startsWith("/fr/") ? "fr" : "en";
}

export function localizePath(path: string, language: SiteLanguage) {
  const base = path.replace(/^\/fr(?=\/|$)/, "") || "/";
  return language === "fr" ? `/fr${base === "/" ? "" : base}` : base;
}
