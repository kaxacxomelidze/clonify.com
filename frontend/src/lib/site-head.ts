import { localizePath, type SiteLanguage } from "./site-language";

const pages = {
  home: {
    path: "/",
    en: {
      title: "Clonyfy — Clone any website with AI in seconds",
      description:
        "Paste any URL and get a pixel-perfect, fully editable clone instantly. React + Tailwind code, Figma export and 1-click deploy. No design or coding skills required.",
    },
    fr: {
      title: "Clonyfy — Clonez et personnalisez un site grâce à l’IA",
      description:
        "Transformez une URL en un site fidèle à l’original et entièrement personnalisable grâce à l’IA. Code React + Tailwind, export Figma et publication en un clic. Sans coder.",
    },
  },
  login: {
    path: "/login",
    en: {
      title: "Log in — Clonyfy",
      description:
        "Log in to Clonyfy and keep cloning, redesigning and shipping websites in minutes.",
    },
    fr: {
      title: "Connexion — Clonyfy",
      description:
        "Connectez-vous à Clonyfy pour retrouver vos projets et continuer à cloner, personnaliser et publier vos sites.",
    },
  },
  register: {
    path: "/register",
    en: {
      title: "Create your Clonyfy account",
      description:
        "Create a Clonyfy account and clone any website into pixel-perfect, editable code in about two minutes.",
    },
    fr: {
      title: "Créez votre compte Clonyfy",
      description:
        "Créez votre compte et clonez votre premier site en moins de deux minutes. Personnalisez-le et publiez-le sans coder.",
    },
  },
};

export function siteHead(language: SiteLanguage, page: keyof typeof pages = "home") {
  const { title, description } = pages[page][language];
  const url = (locale: SiteLanguage) =>
    `https://www.clonyfy.com${localizePath(pages[page].path, locale)}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url(language) },
      { property: "og:locale", content: language === "fr" ? "fr_FR" : "en_US" },
      { property: "og:locale:alternate", content: language === "fr" ? "en_US" : "fr_FR" },
      { property: "og:image:alt", content: title },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image:alt", content: title },
    ],
    links: [
      { rel: "canonical", href: url(language) },
      { rel: "alternate", hrefLang: "en", href: url("en") },
      { rel: "alternate", hrefLang: "fr", href: url("fr") },
      { rel: "alternate", hrefLang: "x-default", href: url("en") },
    ],
  };
}
