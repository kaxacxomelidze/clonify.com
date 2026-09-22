import { useRouterState } from "@tanstack/react-router";
import { frenchCopy } from "@/lib/site-french";
import { getSiteLanguage, localizePath } from "@/lib/site-language";

const english = (text: string | undefined) => text ?? "";
const french = (text: string | undefined) => frenchCopy[text ?? ""] ?? text ?? "";

export function useSiteLanguage() {
  const language = useRouterState({ select: (state) => getSiteLanguage(state.location.pathname) });
  return {
    language,
    locale: language === "fr" ? "fr-FR" : "en-US",
    t: language === "fr" ? french : english,
    localPath: (path: string) => localizePath(path, language),
  };
}
