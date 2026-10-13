/**
 * One-click section designs. A design = LOOK (palette, fonts, corners, buttons) ×
 * LAYOUT (kind-specific arrangement). Cloned pages have arbitrary markup, so a
 * section is first analysed: its parts get role attributes (data-cfy-r = heading,
 * button, card, media, brand, row, panel…) and the generated CSS targets those roles,
 * scoped to the section's studio id. Nothing site-specific; text, links and element
 * identities are never changed.
 */

export type SectionKind = "nav" | "hero" | "cards" | "cta" | "footer" | "content";

export type DesignChoice = { kind: SectionKind; look: string; layout: string };

export type Palette = {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  border: string;
  dark: boolean;
};

export type Look = {
  id: string;
  name: string;
  note: string;
  palette: Palette;
  heading: string;
  body: string;
  radius: number;
  button: "solid" | "pill" | "outline" | "soft" | "brutal";
  headingCase: "none" | "uppercase";
  headingWeight: number;
  tracking: string;
  blur?: boolean;
};

const P = (
  bg: string,
  surface: string,
  text: string,
  muted: string,
  accent: string,
  accentText: string,
  border: string,
  dark: boolean,
): Palette => ({ bg, surface, text, muted, accent, accentText, border, dark });

export const LOOKS: Look[] = [
  {
    id: "paper",
    name: "Clean paper",
    note: "White, crisp, black accent",
    palette: P(
      "#ffffff",
      "#f5f5f4",
      "#111111",
      "#57534e",
      "#111111",
      "#ffffff",
      "rgba(0,0,0,.09)",
      false,
    ),
    heading: "Inter",
    body: "Inter",
    radius: 10,
    button: "solid",
    headingCase: "none",
    headingWeight: 700,
    tracking: "-0.02em",
  },
  {
    id: "midnight",
    name: "Midnight",
    note: "Deep navy, periwinkle glow",
    palette: P(
      "#0b0f1a",
      "#141a2b",
      "#f4f6fb",
      "#9aa4bd",
      "#7c93ff",
      "#0b0f1a",
      "rgba(255,255,255,.1)",
      true,
    ),
    heading: "Plus Jakarta Sans",
    body: "Inter",
    radius: 14,
    button: "pill",
    headingCase: "none",
    headingWeight: 700,
    tracking: "-0.02em",
  },
  {
    id: "editorial",
    name: "Warm editorial",
    note: "Cream paper, serif, terracotta",
    palette: P(
      "#f6f0e4",
      "#efe6d4",
      "#2b2118",
      "#6f5f4f",
      "#b5562c",
      "#fffaf2",
      "rgba(43,33,24,.14)",
      false,
    ),
    heading: "Fraunces",
    body: "Lora",
    radius: 4,
    button: "outline",
    headingCase: "none",
    headingWeight: 600,
    tracking: "-0.01em",
  },
  {
    id: "forest",
    name: "Forest",
    note: "Deep green, mint accent",
    palette: P(
      "#0f2a22",
      "#163a2f",
      "#eaf5ee",
      "#a9c7b6",
      "#8fe3b0",
      "#0f2a22",
      "rgba(234,245,238,.12)",
      true,
    ),
    heading: "Manrope",
    body: "Manrope",
    radius: 999,
    button: "pill",
    headingCase: "none",
    headingWeight: 800,
    tracking: "-0.02em",
  },
  {
    id: "ocean",
    name: "Ocean",
    note: "Navy with electric cyan",
    palette: P(
      "#0a2540",
      "#10305a",
      "#ffffff",
      "#adbdcc",
      "#00d4ff",
      "#0a2540",
      "rgba(255,255,255,.12)",
      true,
    ),
    heading: "Plus Jakarta Sans",
    body: "Plus Jakarta Sans",
    radius: 12,
    button: "solid",
    headingCase: "none",
    headingWeight: 800,
    tracking: "-0.03em",
  },
  {
    id: "sunset",
    name: "Sunset",
    note: "Coral-to-magenta gradient",
    palette: P(
      "linear-gradient(135deg,#ff8a5b 0%,#ff4d8d 100%)",
      "rgba(255,255,255,.16)",
      "#ffffff",
      "rgba(255,255,255,.86)",
      "#ffffff",
      "#e23d72",
      "rgba(255,255,255,.28)",
      true,
    ),
    heading: "Outfit",
    body: "Outfit",
    radius: 18,
    button: "pill",
    headingCase: "none",
    headingWeight: 800,
    tracking: "-0.02em",
  },
  {
    id: "lavender",
    name: "Lavender",
    note: "Soft lilac, violet accent",
    palette: P(
      "#f4f1ff",
      "#ffffff",
      "#211a3a",
      "#5d5577",
      "#7c5cff",
      "#ffffff",
      "rgba(33,26,58,.1)",
      false,
    ),
    heading: "DM Sans",
    body: "DM Sans",
    radius: 16,
    button: "pill",
    headingCase: "none",
    headingWeight: 700,
    tracking: "-0.02em",
  },
  {
    id: "neon",
    name: "Neon night",
    note: "Black, acid-lime, uppercase",
    palette: P(
      "#050505",
      "#121212",
      "#f5f5f5",
      "#a3a3a3",
      "#c6ff00",
      "#050505",
      "rgba(255,255,255,.12)",
      true,
    ),
    heading: "Space Grotesk",
    body: "Space Grotesk",
    radius: 0,
    button: "solid",
    headingCase: "uppercase",
    headingWeight: 700,
    tracking: "0.01em",
  },
  {
    id: "sand",
    name: "Sand",
    note: "Beige calm, charcoal ink",
    palette: P(
      "#efe7da",
      "#f7f2ea",
      "#26231f",
      "#6b645a",
      "#26231f",
      "#efe7da",
      "rgba(38,35,31,.14)",
      false,
    ),
    heading: "Lora",
    body: "DM Sans",
    radius: 6,
    button: "solid",
    headingCase: "none",
    headingWeight: 600,
    tracking: "-0.01em",
  },
  {
    id: "blush",
    name: "Blush",
    note: "Pink tint, rose accent",
    palette: P(
      "#fff1f3",
      "#ffffff",
      "#3b0d16",
      "#7a4a54",
      "#e11d48",
      "#ffffff",
      "rgba(59,13,22,.1)",
      false,
    ),
    heading: "Poppins",
    body: "Poppins",
    radius: 999,
    button: "pill",
    headingCase: "none",
    headingWeight: 700,
    tracking: "-0.01em",
  },
  {
    id: "slate",
    name: "Slate pro",
    note: "Cool gray, product blue",
    palette: P(
      "#f1f5f9",
      "#ffffff",
      "#0f172a",
      "#475569",
      "#2563eb",
      "#ffffff",
      "rgba(15,23,42,.1)",
      false,
    ),
    heading: "Inter",
    body: "Inter",
    radius: 8,
    button: "solid",
    headingCase: "none",
    headingWeight: 700,
    tracking: "-0.025em",
  },
  {
    id: "glass",
    name: "Glass",
    note: "Frosted white, soft blur",
    palette: P(
      "rgba(255,255,255,.62)",
      "rgba(255,255,255,.7)",
      "#0f172a",
      "#475569",
      "#0f172a",
      "#ffffff",
      "rgba(15,23,42,.1)",
      false,
    ),
    heading: "Sora",
    body: "Inter",
    radius: 20,
    button: "soft",
    headingCase: "none",
    headingWeight: 700,
    tracking: "-0.02em",
    blur: true,
  },
  {
    id: "brutalist",
    name: "Brutalist",
    note: "Hard borders, offset shadows",
    palette: P("#fffdf5", "#ffffff", "#000000", "#2b2b2b", "#ffde03", "#000000", "#000000", false),
    heading: "Space Grotesk",
    body: "Space Mono",
    radius: 0,
    button: "brutal",
    headingCase: "uppercase",
    headingWeight: 700,
    tracking: "0",
  },
  {
    id: "luxe",
    name: "Luxe gold",
    note: "Near-black, gold, refined serif",
    palette: P(
      "#0d0c0a",
      "#17150f",
      "#f3ead8",
      "#b3a68c",
      "#c9a24a",
      "#0d0c0a",
      "rgba(201,162,74,.22)",
      true,
    ),
    heading: "Playfair Display",
    body: "Lora",
    radius: 2,
    button: "outline",
    headingCase: "uppercase",
    headingWeight: 600,
    tracking: "0.06em",
  },
  {
    id: "mono",
    name: "Mono minimal",
    note: "Black & white, typewriter",
    palette: P(
      "#ffffff",
      "#fafafa",
      "#0a0a0a",
      "#525252",
      "#0a0a0a",
      "#ffffff",
      "rgba(0,0,0,.12)",
      false,
    ),
    heading: "JetBrains Mono",
    body: "JetBrains Mono",
    radius: 0,
    button: "outline",
    headingCase: "uppercase",
    headingWeight: 600,
    tracking: "0.02em",
  },
  {
    id: "aurora",
    name: "Aurora",
    note: "Teal-violet night gradient",
    palette: P(
      "linear-gradient(140deg,#071a24 0%,#13233f 55%,#2a1449 100%)",
      "rgba(255,255,255,.06)",
      "#eef6ff",
      "#a7b8cf",
      "#5eead4",
      "#071a24",
      "rgba(255,255,255,.12)",
      true,
    ),
    heading: "Sora",
    body: "Inter",
    radius: 16,
    button: "pill",
    headingCase: "none",
    headingWeight: 700,
    tracking: "-0.02em",
  },
  {
    id: "citrus",
    name: "Citrus",
    note: "Sunny yellow, bold black",
    palette: P(
      "#ffe45e",
      "#fff3b0",
      "#141414",
      "#3d3d3d",
      "#141414",
      "#ffe45e",
      "rgba(20,20,20,.16)",
      false,
    ),
    heading: "Outfit",
    body: "Outfit",
    radius: 12,
    button: "solid",
    headingCase: "none",
    headingWeight: 800,
    tracking: "-0.03em",
  },
  {
    id: "coral",
    name: "Coral fresh",
    note: "White with coral pop",
    palette: P(
      "#ffffff",
      "#fff4f0",
      "#1f1a17",
      "#6b625d",
      "#ff6b4a",
      "#ffffff",
      "rgba(31,26,23,.1)",
      false,
    ),
    heading: "Plus Jakarta Sans",
    body: "Plus Jakarta Sans",
    radius: 14,
    button: "solid",
    headingCase: "none",
    headingWeight: 800,
    tracking: "-0.025em",
  },
];

export const LAYOUTS: Record<SectionKind, Array<{ id: string; name: string }>> = {
  nav: [
    { id: "split", name: "Clean split" },
    { id: "centered", name: "Centered" },
    { id: "floating", name: "Floating pill" },
    { id: "underline", name: "Hairline" },
    { id: "compact", name: "Compact" },
  ],
  hero: [
    { id: "left", name: "Left aligned" },
    { id: "centered", name: "Centered" },
    { id: "spacious", name: "Spacious" },
    { id: "framed", name: "Framed panel" },
  ],
  cards: [
    { id: "elevated", name: "Elevated cards" },
    { id: "outlined", name: "Outlined" },
    { id: "tinted", name: "Tinted" },
    { id: "flat", name: "Flat" },
  ],
  cta: [
    { id: "banner", name: "Accent banner" },
    { id: "card", name: "Inset card" },
    { id: "centered", name: "Centered" },
  ],
  footer: [
    { id: "standard", name: "Standard" },
    { id: "centered", name: "Centered" },
    { id: "compact", name: "Compact" },
  ],
  content: [
    { id: "standard", name: "Standard" },
    { id: "centered", name: "Centered" },
    { id: "spacious", name: "Spacious" },
    { id: "framed", name: "Framed panel" },
  ],
};

export const KIND_LABEL: Record<SectionKind, string> = {
  nav: "Navigation",
  hero: "Hero",
  cards: "Cards & features",
  cta: "Call to action",
  footer: "Footer",
  content: "Content section",
};

export const lookById = (id: string) => LOOKS.find((l) => l.id === id) || LOOKS[0]!;

const SERIF = /Fraunces|Lora|Playfair|DM Serif|Cormorant|Baskerville/;
const MONO = /Mono/;
export function stack(family: string) {
  return `"${family}", ${SERIF.test(family) ? "Georgia, serif" : MONO.test(family) ? "ui-monospace, monospace" : "system-ui, sans-serif"}`;
}

/* ------------------------------------------------------------- analysis */

const ROLE = "data-cfy-r";

function rendered(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2;
}

function addRole(el: Element, role: string) {
  const cur = (el.getAttribute(ROLE) || "").split(/\s+/).filter(Boolean);
  if (!cur.includes(role)) cur.push(role);
  el.setAttribute(ROLE, cur.join(" "));
}

export function clearRoles(section: Element) {
  section.querySelectorAll(`[${ROLE}]`).forEach((el) => el.removeAttribute(ROLE));
}

/**
 * Alpha of a computed CSS color in ANY format browsers return — rgb()/rgba(),
 * modern space-separated `/ alpha`, oklab()/oklch()/lab()/color() (Tailwind v4).
 */
export function colorAlpha(color: string): number {
  const c = String(color || "").trim();
  if (!c || c === "transparent") return 0;
  const slash = c.match(/\/\s*([\d.]+)(%?)\s*\)$/);
  if (slash) return slash[2] ? parseFloat(slash[1]!) / 100 : parseFloat(slash[1]!);
  const rgba = c.match(/^rgba\(([^)]+)\)$/);
  if (rgba) {
    const a = rgba[1]!.split(",")[3];
    return a === undefined ? 1 : parseFloat(a);
  }
  return 1;
}

function opaqueBg(cs: CSSStyleDeclaration) {
  if (cs.backgroundImage && cs.backgroundImage !== "none" && !/url\(/.test(cs.backgroundImage))
    return true;
  return colorAlpha(cs.backgroundColor) > 0.05;
}

function isButtonLike(el: HTMLElement, view: Window) {
  if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") return true;
  if (el.matches('input[type="submit"],input[type="button"]')) return true;
  if (el.tagName !== "A") return false;
  if (/\b(btn|button|cta)\b/i.test(String(el.getAttribute("class") || ""))) return true;
  const cs = view.getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const padded = parseFloat(cs.paddingLeft) >= 8 && r.height >= 26 && r.height <= 90;
  const framed = opaqueBg(cs) || parseFloat(cs.borderTopWidth) >= 1;
  return padded && framed;
}

/** Detect what a section is, from its markup and geometry. */
export function detectKind(section: HTMLElement, index: number, total: number): SectionKind {
  const tag = section.tagName;
  const view = section.ownerDocument.defaultView!;
  const links = section.querySelectorAll("a").length;
  const rect = section.getBoundingClientRect();
  if (tag === "NAV" || tag === "HEADER" || section.getAttribute("role") === "navigation")
    return "nav";
  if (index === 0 && rect.height < 180 && links >= 3) return "nav";
  if (tag === "FOOTER" || (index === total - 1 && links >= 5)) return "footer";
  if (section.querySelector("h1") && index <= 2) return "hero";
  if (findCardGroups(section).length) return "cards";
  const text = (section.innerText || "").replace(/\s+/g, " ").trim();
  const hasButton = Array.from(section.querySelectorAll<HTMLElement>("a,button")).some((b) =>
    isButtonLike(b, view),
  );
  if (hasButton && text.length < 420 && section.querySelector("h1,h2,h3")) return "cta";
  if (index <= 1 && section.querySelector("h2") && rect.height > 300) return "hero";
  return "content";
}

/** Groups of ≥3 similar siblings that look like cards. */
function findCardGroups(section: HTMLElement): HTMLElement[][] {
  const groups: HTMLElement[][] = [];
  const containers = [
    section,
    ...Array.from(section.querySelectorAll<HTMLElement>("div,ul,ol,section")),
  ].slice(0, 600);
  for (const parent of containers) {
    const kids = Array.from(parent.children).filter(
      (c) => c instanceof parent.ownerDocument.defaultView!.HTMLElement && rendered(c),
    ) as HTMLElement[];
    if (kids.length < 3) continue;
    const sig = (el: HTMLElement) =>
      `${el.tagName}.${String(el.getAttribute("class") || "")
        .split(/\s+/)
        .sort()
        .join(".")}`;
    const counts = new Map<string, HTMLElement[]>();
    for (const k of kids) counts.set(sig(k), [...(counts.get(sig(k)) || []), k]);
    for (const list of counts.values()) {
      if (list.length < 3) continue;
      const ok = list.every((el) => {
        const r = el.getBoundingClientRect();
        return r.width >= 120 && r.height >= 80 && (el.innerText || "").trim().length > 8;
      });
      if (ok && !groups.some((g) => g.some((c) => c.contains(list[0]!)))) groups.push(list);
    }
  }
  return groups;
}

/** Tag the parts of a section so design CSS can address them. */
export function analyzeSection(section: HTMLElement, kind: SectionKind) {
  const view = section.ownerDocument.defaultView!;
  clearRoles(section);
  const sRect = section.getBoundingClientRect();

  // Buttons (first in a group = primary, later siblings = secondary "alt").
  const seenParents = new Map<Element, number>();
  for (const el of Array.from(
    section.querySelectorAll<HTMLElement>("a,button,[role=button],input[type=submit]"),
  )) {
    if (!rendered(el)) continue;
    if (isButtonLike(el, view)) {
      const parent =
        el.parentElement?.closest("div,nav,ul,p,section,header,footer,form") || el.parentElement!;
      const n = seenParents.get(parent) || 0;
      seenParents.set(parent, n + 1);
      addRole(el, "button");
      if (n > 0) addRole(el, "alt");
      const row = el.parentElement;
      if (row && view.getComputedStyle(row).display.includes("flex")) addRole(row, "row");
    } else if (el.tagName === "A") {
      addRole(el, "link");
    }
  }

  // Headings.
  section.querySelectorAll<HTMLElement>("h1,h2,h3,h4").forEach((h) => {
    addRole(h, "heading");
    const parent = h.parentElement;
    if (parent && parent !== section && view.getComputedStyle(parent).display.includes("flex"))
      addRole(parent, "stack");
  });

  // Media.
  section.querySelectorAll<HTMLElement>("img,video,picture,svg,canvas").forEach((m) => {
    // Parts drawn inside an <svg> belong to that svg (which is tagged itself).
    if (m.tagName.toLowerCase() !== "svg" && m.closest("svg")) return;
    const r = m.getBoundingClientRect();
    if (r.width >= 64 && r.height >= 48) addRole(m, "media");
  });

  // Navigation: brand + main row.
  if (kind === "nav") {
    const brand = Array.from(section.querySelectorAll<HTMLElement>("a,img,svg")).find((el) => {
      const r = el.getBoundingClientRect();
      return (
        rendered(el) &&
        r.left - sRect.left < sRect.width * 0.35 &&
        (el.matches("img,svg") ||
          !!el.querySelector("img,svg") ||
          (el.innerText || "").trim().length < 24)
      );
    });
    if (brand) addRole(brand.matches("a") ? brand : brand, "brand");
    let best: HTMLElement | null = null;
    let bestW = 0;
    section.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const cs = view.getComputedStyle(el);
      if (!cs.display.includes("flex") || el.children.length < 2) return;
      const w = el.getBoundingClientRect().width;
      if (w > bestW && el.querySelectorAll("a").length >= 2) {
        best = el;
        bestW = w;
      }
    });
    if (best) addRole(best, "row");
    if (view.getComputedStyle(section).display.includes("flex")) addRole(section, "row");
  }

  // Cards.
  if (kind !== "nav") {
    for (const group of findCardGroups(section)) group.forEach((c) => addRole(c, "card"));
  }

  // Inner full-width panels with their own background would hide the new palette.
  section
    .querySelectorAll<HTMLElement>("div,section,article,header,footer,nav,main")
    .forEach((el) => {
      if (el.getAttribute(ROLE)?.includes("card") || el.closest(`[${ROLE}~="card"]`)) return;
      const r = el.getBoundingClientRect();
      if (r.width < sRect.width * 0.7 || r.height < Math.min(sRect.height * 0.4, 120)) return;
      const cs = view.getComputedStyle(el);
      // Any tint, glass blur or frame would sit between the new palette and the content.
      const tinted = colorAlpha(cs.backgroundColor) > 0;
      const glass = !!cs.backdropFilter && cs.backdropFilter !== "none";
      if (opaqueBg(cs) || tinted || glass) addRole(el, "panel");
    });
}

/* ------------------------------------------------------------------ CSS */

function buttonCss(S: string, L: Look) {
  const p = L.palette;
  const radius = L.button === "pill" ? 999 : L.radius;
  const B = `${S} [${ROLE}~="button"]`;
  const A = `${S} [${ROLE}~="button"][${ROLE}~="alt"]`;
  const out: string[] = [];
  const base = `border-radius:${radius}px!important;font-family:${stack(L.body)}!important;transition:transform .2s ease,background-color .2s ease,box-shadow .2s ease!important`;
  switch (L.button) {
    case "outline":
      out.push(
        `${B}{${base};background:transparent!important;color:${p.accent}!important;border:1.5px solid ${p.accent}!important;box-shadow:none!important}`,
      );
      out.push(`${B}:hover{background:${p.accent}!important;color:${p.accentText}!important}`);
      out.push(`${A}{border-color:${p.border}!important;color:${p.text}!important}`);
      break;
    case "soft":
      out.push(
        `${B}{${base};background:${p.text}!important;color:${p.dark ? p.bg : "#fff"}!important;border:0!important;box-shadow:0 8px 24px -10px rgba(0,0,0,.35)!important}`,
      );
      out.push(
        `${A}{background:${p.surface}!important;color:${p.text}!important;box-shadow:none!important;border:1px solid ${p.border}!important}`,
      );
      break;
    case "brutal":
      out.push(
        `${B}{${base};background:${p.accent}!important;color:${p.accentText}!important;border:2px solid #000!important;box-shadow:4px 4px 0 #000!important}`,
      );
      out.push(
        `${B}:hover{transform:translate(-2px,-2px)!important;box-shadow:6px 6px 0 #000!important}`,
      );
      out.push(`${A}{background:#fff!important}`);
      break;
    default:
      out.push(
        `${B}{${base};background:${p.accent}!important;color:${p.accentText}!important;border:1px solid transparent!important;box-shadow:none!important}`,
      );
      out.push(`${B}:hover{transform:translateY(-1px)!important;filter:brightness(1.06)}`);
      out.push(
        `${A}{background:transparent!important;color:${p.text}!important;border-color:${p.border}!important}`,
      );
  }
  out.push(`${B} *{color:inherit!important}`);
  return out.join("");
}

function cardCss(S: string, L: Look, layout: string) {
  const p = L.palette;
  const C = `${S} [${ROLE}~="card"]`;
  const r = Math.min(L.radius, 28);
  const common = `border-radius:${r}px!important;color:${p.text}!important;transition:transform .25s ease,box-shadow .25s ease!important`;
  switch (layout) {
    case "outlined":
      return `${C}{${common};background:transparent!important;border:1px solid ${p.border}!important;box-shadow:none!important;padding:24px!important}`;
    case "tinted":
      return `${C}{${common};background:color-mix(in srgb,${p.accent} 12%,transparent)!important;border:0!important;box-shadow:none!important;padding:24px!important}`;
    case "flat":
      return `${C}{${common};background:transparent!important;border:0!important;box-shadow:none!important}`;
    default:
      return `${C}{${common};background:${p.surface}!important;border:1px solid ${p.border}!important;box-shadow:0 18px 40px -24px rgba(0,0,0,${p.dark ? ".8" : ".28"})!important;padding:24px!important}${C}:hover{transform:translateY(-3px)!important}`;
  }
}

function layoutCss(S: string, L: Look, c: DesignChoice) {
  const p = L.palette;
  const R = (role: string) => `${S} [${ROLE}~="${role}"]`;
  const center = `${S}{text-align:center!important}${R("row")}{justify-content:center!important}${R("stack")}{align-items:center!important}${S} :is(p,h1,h2,h3)[${ROLE}~="heading"],${S} p{margin-left:auto!important;margin-right:auto!important}`;
  switch (`${c.kind}:${c.layout}`) {
    case "nav:split":
      return `${S}{border-bottom:1px solid ${p.border}!important}`;
    case "nav:centered":
      return `${R("row")}{justify-content:center!important;flex-wrap:wrap!important;column-gap:28px!important}${S}{text-align:center!important;border-bottom:1px solid ${p.border}!important}`;
    case "nav:floating":
      return `${S}{margin:12px auto!important;width:calc(100% - 32px)!important;max-width:1200px!important;border-radius:${Math.max(L.radius, 16) >= 999 ? 999 : Math.max(L.radius, 18)}px!important;border:1px solid ${p.border}!important;box-shadow:0 16px 40px -18px rgba(0,0,0,.45)!important;padding-left:20px!important;padding-right:20px!important;left:0!important;right:0!important}`;
    case "nav:underline":
      return `${S}{background:transparent!important;border-bottom:1px solid ${p.text}!important;box-shadow:none!important}`;
    case "nav:compact":
      return `${S}{padding-top:6px!important;padding-bottom:6px!important;font-size:14px!important;border-bottom:1px solid ${p.border}!important}`;
    case "hero:centered":
    case "content:centered":
    case "cta:centered":
    case "footer:centered":
      return center;
    case "hero:spacious":
    case "content:spacious":
      return `${S}{padding-top:clamp(72px,10vw,140px)!important;padding-bottom:clamp(72px,10vw,140px)!important}${S} h1{font-size:clamp(40px,6vw,84px)!important;line-height:1.02!important}`;
    case "hero:framed":
    case "content:framed":
      return `${S}{margin:16px!important;border-radius:${Math.max(Math.min(L.radius, 32), 16)}px!important;overflow:hidden!important}`;
    case "cta:banner":
      return `${S}{background:${p.accent}!important;color:${p.accentText}!important}${S} :is(h1,h2,h3,h4,p,span,li){color:${p.accentText}!important}${R("button")}{background:${p.accentText}!important;color:${p.accent}!important;border-color:${p.accentText}!important}`;
    case "cta:card":
      return `${S}{margin:24px auto!important;width:calc(100% - 48px)!important;max-width:1180px!important;border-radius:${Math.max(Math.min(L.radius, 32), 18)}px!important;border:1px solid ${p.border}!important;overflow:hidden!important}`;
    case "footer:standard":
      return `${S}{border-top:1px solid ${p.border}!important}`;
    case "footer:compact":
      return `${S}{padding-top:28px!important;padding-bottom:28px!important;font-size:14px!important;border-top:1px solid ${p.border}!important}`;
    default:
      return "";
  }
}

export function designCss(id: string, c: DesignChoice): string {
  const L = lookById(c.look);
  const p = L.palette;
  const S = `[data-cfy="${id}"]`;
  const out: string[] = [];
  out.push(
    `${S}{background:${p.bg}!important;color:${p.text}!important;font-family:${stack(L.body)}!important;${L.blur ? "backdrop-filter:blur(16px) saturate(1.4)!important;-webkit-backdrop-filter:blur(16px) saturate(1.4)!important;" : ""}}`,
  );
  out.push(`${S} *{border-color:${p.border}!important}`);
  out.push(
    `${S} [${ROLE}~="panel"]{background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;border-color:transparent!important}`,
  );
  // Glass/tint layers drawn with ::before/::after on the section or its inner panels.
  out.push(
    `${S}::before,${S}::after,${S} [${ROLE}~="panel"]::before,${S} [${ROLE}~="panel"]::after{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:none!important;border-color:transparent!important}`,
  );
  out.push(
    `${S} :is(div,span,li,small,label,dt,dd,td,th,figcaption,blockquote,strong,em,b,i,a){color:inherit!important}`,
  );
  out.push(`${S} p{color:${p.muted}!important;font-family:${stack(L.body)}!important}`);
  out.push(
    `${S} :is(h1,h2,h3,h4,h5,h6),${S} [${ROLE}~="heading"]{color:${p.text}!important;font-family:${stack(L.heading)}!important;font-weight:${L.headingWeight}!important;letter-spacing:${L.tracking}!important;text-transform:${L.headingCase}!important}`,
  );
  out.push(
    `${S} a:not([${ROLE}~="button"]){color:${p.text}!important;transition:color .2s ease!important}${S} a:not([${ROLE}~="button"]):hover{color:${p.accent}!important}`,
  );
  out.push(
    `${S} :is(input,textarea,select){background:${p.dark ? "rgba(255,255,255,.06)" : "#fff"}!important;color:${p.text}!important;border:1px solid ${p.border}!important;border-radius:${Math.min(L.radius, 14)}px!important}`,
  );
  out.push(`${S} [${ROLE}~="media"]{border-radius:${Math.min(L.radius, 24)}px!important}`);
  if (c.kind === "nav") {
    out.push(
      `${S} [${ROLE}~="brand"],${S} [${ROLE}~="brand"] :is(img,svg){filter:${p.dark ? "brightness(0) invert(1)" : "brightness(0)"}!important}`,
    );
  }
  out.push(buttonCss(S, L));
  out.push(cardCss(S, L, c.kind === "cards" ? c.layout : "elevated"));
  out.push(layoutCss(S, L, c));
  return out.join("");
}

/** Fonts a look needs (loaded into the page as Google Fonts links). */
export function lookFonts(lookId: string): string[] {
  const L = lookById(lookId);
  return [...new Set([L.heading, L.body])];
}
