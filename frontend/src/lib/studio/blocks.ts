/**
 * Insertable building blocks for the Add panel: single elements and ready-made
 * sections. Markup uses inline styles with neutral colors and inherited fonts so it
 * blends into any cloned page — and it can then be restyled with one-click designs.
 */

export type BlockDef = { id: string; name: string; icon: string; html: string };

const BTN =
  "display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 22px;border-radius:10px;background:#111;color:#fff;font:inherit;font-weight:600;text-decoration:none;border:1px solid #111;cursor:pointer";
const BTN2 =
  "display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 22px;border-radius:10px;background:transparent;color:inherit;font:inherit;font-weight:600;text-decoration:none;border:1px solid rgba(0,0,0,.18);cursor:pointer";
const WRAP = "max-width:1160px;margin:0 auto;padding:0 24px";
const SECTION = "padding:88px 0;font-family:inherit;color:inherit";
const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9e7ff"/><stop offset="1" stop-color="#cfe8ff"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/><circle cx="420" cy="330" r="120" fill="#fff" opacity=".7"/><path d="M0 640 L360 420 L620 600 L860 460 L1200 680 L1200 800 L0 800Z" fill="#fff" opacity=".55"/></svg>`,
  );

export const ELEMENTS: BlockDef[] = [
  {
    id: "heading",
    name: "Heading",
    icon: "T",
    html: `<h2 style="font-size:40px;line-height:1.1;font-weight:700;letter-spacing:-0.02em;margin:0 0 16px">A clear, confident headline</h2>`,
  },
  {
    id: "paragraph",
    name: "Paragraph",
    icon: "¶",
    html: `<p style="font-size:17px;line-height:1.65;max-width:62ch;margin:0 0 16px;opacity:.82">Describe what makes this offer different in one or two sentences. Keep it specific and easy to scan.</p>`,
  },
  { id: "button", name: "Button", icon: "▰", html: `<a href="#" style="${BTN}">Get started →</a>` },
  {
    id: "button2",
    name: "Outline button",
    icon: "▭",
    html: `<a href="#" style="${BTN2}">Learn more</a>`,
  },
  {
    id: "image",
    name: "Image",
    icon: "◈",
    html: `<img src="${PLACEHOLDER}" alt="Placeholder image" style="display:block;width:100%;max-width:720px;height:auto;border-radius:16px">`,
  },
  {
    id: "container",
    name: "Container",
    icon: "▤",
    html: `<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;padding:24px;border:1px dashed rgba(0,0,0,.18);border-radius:14px;min-height:80px"><p style="margin:0;opacity:.6">Container — drop or paste content here</p></div>`,
  },
  {
    id: "section",
    name: "Section",
    icon: "▧",
    html: `<section style="${SECTION}"><div style="${WRAP}"><h2 style="font-size:36px;line-height:1.1;margin:0 0 12px">New section</h2><p style="font-size:17px;line-height:1.6;margin:0;opacity:.8">Start writing here.</p></div></section>`,
  },
  {
    id: "list",
    name: "List",
    icon: "≡",
    html: `<ul style="margin:0 0 16px;padding-left:20px;line-height:1.8"><li>First benefit</li><li>Second benefit</li><li>Third benefit</li></ul>`,
  },
  {
    id: "quote",
    name: "Quote",
    icon: "❝",
    html: `<blockquote style="margin:0;padding:8px 0 8px 20px;border-left:3px solid currentColor;font-size:22px;line-height:1.5;font-style:italic">“The fastest way we have ever shipped a website.”</blockquote>`,
  },
  {
    id: "input",
    name: "Input",
    icon: "⌨",
    html: `<input type="email" placeholder="you@company.com" style="display:block;width:100%;max-width:360px;padding:12px 14px;border-radius:10px;border:1px solid rgba(0,0,0,.2);font:inherit;background:#fff;color:#111">`,
  },
  {
    id: "video",
    name: "Video",
    icon: "▷",
    html: `<div style="position:relative;width:100%;max-width:720px;aspect-ratio:16/9;border-radius:16px;overflow:hidden;background:#111"><iframe src="https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ" title="Video" style="position:absolute;inset:0;width:100%;height:100%;border:0" allowfullscreen></iframe></div>`,
  },
  {
    id: "divider",
    name: "Divider",
    icon: "—",
    html: `<hr style="border:0;border-top:1px solid rgba(0,0,0,.12);margin:32px 0">`,
  },
  {
    id: "spacer",
    name: "Spacer",
    icon: "↕",
    html: `<div style="height:64px" aria-hidden="true"></div>`,
  },
  {
    id: "badge",
    name: "Badge",
    icon: "●",
    html: `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:rgba(0,0,0,.06);font-size:13px;font-weight:600">✦ New release</span>`,
  },
];

const card = (title: string, text: string) =>
  `<div style="padding:28px;border-radius:16px;border:1px solid rgba(0,0,0,.1);background:rgba(255,255,255,.6)"><div style="width:40px;height:40px;border-radius:12px;background:rgba(0,0,0,.08);margin-bottom:18px"></div><h3 style="font-size:20px;margin:0 0 8px">${title}</h3><p style="margin:0;line-height:1.6;opacity:.75">${text}</p></div>`;

export const SECTIONS: BlockDef[] = [
  {
    id: "hero",
    name: "Hero",
    icon: "★",
    html: `<section style="${SECTION};padding:120px 0"><div style="${WRAP};text-align:center"><span style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(0,0,0,.06);font-size:13px;font-weight:600;margin-bottom:22px">Introducing something new</span><h1 style="font-size:clamp(40px,6vw,72px);line-height:1.02;letter-spacing:-0.03em;margin:0 auto 20px;max-width:16ch">Build the page your idea deserves</h1><p style="font-size:19px;line-height:1.6;margin:0 auto 32px;max-width:56ch;opacity:.78">A short promise that explains the value in one sentence, written for the people you want to reach.</p><div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><a href="#" style="${BTN}">Start free</a><a href="#" style="${BTN2}">See how it works</a></div></div></section>`,
  },
  {
    id: "features",
    name: "Feature grid",
    icon: "▦",
    html: `<section style="${SECTION}"><div style="${WRAP}"><h2 style="font-size:40px;line-height:1.1;margin:0 0 12px;letter-spacing:-0.02em">Everything you need</h2><p style="font-size:18px;margin:0 0 40px;opacity:.75;max-width:56ch">Three reasons teams switch — and stay.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px">${card("Fast by default", "Pages load instantly on every device.")}${card("Easy to edit", "Change any text, image or color in seconds.")}${card("Built to grow", "Add sections and pages as your business evolves.")}</div></div></section>`,
  },
  {
    id: "cta",
    name: "Call to action",
    icon: "↗",
    html: `<section style="${SECTION}"><div style="${WRAP}"><div style="padding:56px;border-radius:24px;background:#111;color:#fff;text-align:center"><h2 style="font-size:40px;line-height:1.1;margin:0 0 12px;color:#fff">Ready to get started?</h2><p style="font-size:18px;margin:0 auto 28px;max-width:48ch;opacity:.8;color:#fff">Join thousands of teams already building with us.</p><a href="#" style="${BTN};background:#fff;color:#111;border-color:#fff">Create your account</a></div></div></section>`,
  },
  {
    id: "stats",
    name: "Stats",
    icon: "№",
    html: `<section style="${SECTION};padding:64px 0"><div style="${WRAP};display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:24px;text-align:center">${[
      ["120+", "Projects shipped"],
      ["34", "Countries"],
      ["99.9%", "Uptime"],
      ["4.9/5", "Customer rating"],
    ]
      .map(
        ([n, l]) =>
          `<div><div style="font-size:48px;font-weight:800;letter-spacing:-0.03em">${n}</div><div style="opacity:.7">${l}</div></div>`,
      )
      .join("")}</div></section>`,
  },
  {
    id: "testimonials",
    name: "Testimonials",
    icon: "❝",
    html: `<section style="${SECTION}"><div style="${WRAP}"><h2 style="font-size:40px;margin:0 0 36px;letter-spacing:-0.02em">Loved by teams</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px">${[
      ["“We launched in a weekend.”", "Maya R., Founder"],
      ["“Our conversion rate doubled.”", "Daniel K., Growth lead"],
      ["“Finally, a site we can edit ourselves.”", "Sofia L., Marketing"],
    ]
      .map(
        ([q, w]) =>
          `<figure style="margin:0;padding:28px;border-radius:16px;border:1px solid rgba(0,0,0,.1)"><blockquote style="margin:0 0 18px;font-size:19px;line-height:1.5">${q}</blockquote><figcaption style="opacity:.7;font-size:14px">${w}</figcaption></figure>`,
      )
      .join("")}</div></div></section>`,
  },
  {
    id: "pricing",
    name: "Pricing",
    icon: "$",
    html: `<section style="${SECTION}"><div style="${WRAP}"><h2 style="font-size:40px;margin:0 0 36px;text-align:center;letter-spacing:-0.02em">Simple pricing</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px">${[
      ["Starter", "$0", "For trying things out"],
      ["Pro", "$29", "For growing teams"],
      ["Business", "$99", "For scale and support"],
    ]
      .map(
        ([n, p, d], i) =>
          `<div style="padding:32px;border-radius:18px;border:${i === 1 ? "2px solid currentColor" : "1px solid rgba(0,0,0,.12)"}"><h3 style="margin:0 0 6px;font-size:20px">${n}</h3><p style="margin:0 0 18px;opacity:.7">${d}</p><div style="font-size:44px;font-weight:800;margin-bottom:20px">${p}<span style="font-size:16px;font-weight:500;opacity:.6">/mo</span></div><a href="#" style="${i === 1 ? BTN : BTN2};width:100%;box-sizing:border-box">Choose ${n}</a></div>`,
      )
      .join("")}</div></div></section>`,
  },
  {
    id: "faq",
    name: "FAQ",
    icon: "?",
    html: `<section style="${SECTION}"><div style="${WRAP};max-width:780px"><h2 style="font-size:40px;margin:0 0 28px;letter-spacing:-0.02em">Frequently asked questions</h2>${[
      ["How long does setup take?", "Most teams are live in under an hour."],
      ["Can I cancel anytime?", "Yes — there are no long-term contracts."],
      [
        "Do you offer support?",
        "Every plan includes email support; Business adds a dedicated manager.",
      ],
    ]
      .map(
        ([q, a]) =>
          `<details style="border-bottom:1px solid rgba(0,0,0,.12);padding:18px 0"><summary style="cursor:pointer;font-weight:600;font-size:18px">${q}</summary><p style="margin:12px 0 0;line-height:1.6;opacity:.78">${a}</p></details>`,
      )
      .join("")}</div></section>`,
  },
  {
    id: "logos",
    name: "Logo strip",
    icon: "◎",
    html: `<section style="${SECTION};padding:48px 0"><div style="${WRAP};text-align:center"><p style="margin:0 0 22px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;opacity:.6">Trusted by teams at</p><div style="display:flex;flex-wrap:wrap;justify-content:center;gap:40px;font-weight:700;font-size:20px;opacity:.55">${["Northwind", "Acme", "Globex", "Initech", "Umbrella"].map((n) => `<span>${n}</span>`).join("")}</div></div></section>`,
  },
  {
    id: "newsletter",
    name: "Newsletter",
    icon: "✉",
    html: `<section style="${SECTION};padding:72px 0"><div style="${WRAP};text-align:center;max-width:640px"><h2 style="font-size:34px;margin:0 0 10px">Get the latest updates</h2><p style="margin:0 0 24px;opacity:.75">One short email a month. No spam.</p><form style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap" action="#"><input type="email" placeholder="you@company.com" style="flex:1;min-width:220px;max-width:340px;padding:12px 14px;border-radius:10px;border:1px solid rgba(0,0,0,.2);font:inherit;background:#fff;color:#111"><button type="submit" style="${BTN}">Subscribe</button></form></div></section>`,
  },
  {
    id: "gallery",
    name: "Gallery",
    icon: "▣",
    html: `<section style="${SECTION}"><div style="${WRAP}"><h2 style="font-size:40px;margin:0 0 32px;letter-spacing:-0.02em">Selected work</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">${[1, 2, 3].map(() => `<img src="${PLACEHOLDER}" alt="Project image" style="display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px">`).join("")}</div></div></section>`,
  },
  {
    id: "footer",
    name: "Footer",
    icon: "▁",
    html: `<footer style="padding:56px 0 40px;border-top:1px solid rgba(0,0,0,.1)"><div style="${WRAP};display:flex;flex-wrap:wrap;gap:32px;justify-content:space-between"><div><strong style="font-size:20px">Brand</strong><p style="margin:10px 0 0;opacity:.7;max-width:32ch">Building better websites, one section at a time.</p></div><div style="display:flex;gap:48px;flex-wrap:wrap">${[
      ["Product", ["Features", "Pricing", "Changelog"]],
      ["Company", ["About", "Careers", "Contact"]],
    ]
      .map(
        ([h, ls]) =>
          `<div><div style="font-weight:600;margin-bottom:10px">${h}</div>${(ls as string[]).map((l) => `<a href="#" style="display:block;color:inherit;opacity:.7;text-decoration:none;margin:6px 0">${l}</a>`).join("")}</div>`,
      )
      .join(
        "",
      )}</div></div><div style="${WRAP};margin-top:40px;opacity:.55;font-size:14px">© ${new Date().getFullYear()} Brand. All rights reserved.</div></footer>`,
  },
];

/* --------------------------------------------------------------- graphics */

export type GraphicKind = "orbital" | "mesh" | "ribbons" | "grid";
export const GRAPHICS: Array<{ id: GraphicKind; name: string }> = [
  { id: "orbital", name: "Orbital sculpture" },
  { id: "mesh", name: "Soft color mesh" },
  { id: "ribbons", name: "Flowing ribbons" },
  { id: "grid", name: "Dot grid glow" },
];

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Editable SVG artwork from two colors and a seed (fully local, deterministic). */
export function generateGraphic(
  kind: GraphicKind,
  primary: string,
  accent: string,
  seed: number,
): string {
  const r = rng(seed);
  const W = 1200;
  const H = 800;
  let body = "";
  if (kind === "orbital") {
    const cx = 600 + (r() - 0.5) * 160;
    const cy = 400 + (r() - 0.5) * 100;
    body += `<radialGradient id="s" cx="35%" cy="30%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="${accent}"/><stop offset="1" stop-color="${primary}"/></radialGradient><rect width="${W}" height="${H}" fill="${primary}"/><circle cx="${cx}" cy="${cy}" r="${200 + r() * 60}" fill="url(#s)"/>`;
    for (let i = 0; i < 3; i++) {
      body += `<ellipse cx="${cx}" cy="${cy}" rx="${300 + i * 70 + r() * 40}" ry="${70 + i * 26}" transform="rotate(${-25 + r() * 50} ${cx} ${cy})" fill="none" stroke="${accent}" stroke-opacity="${0.55 - i * 0.14}" stroke-width="${10 - i * 3}"/>`;
    }
  } else if (kind === "mesh") {
    body += `<filter id="b"><feGaussianBlur stdDeviation="90"/></filter><rect width="${W}" height="${H}" fill="${primary}"/><g filter="url(#b)">`;
    for (let i = 0; i < 6; i++) {
      body += `<circle cx="${r() * W}" cy="${r() * H}" r="${160 + r() * 220}" fill="${i % 2 ? accent : "#ffffff"}" opacity="${0.35 + r() * 0.45}"/>`;
    }
    body += "</g>";
  } else if (kind === "ribbons") {
    body += `<rect width="${W}" height="${H}" fill="${primary}"/>`;
    for (let i = 0; i < 7; i++) {
      const y = 120 + i * 90 + r() * 40;
      body += `<path d="M -50 ${y} C ${300 + r() * 200} ${y - 200 + r() * 120}, ${700 + r() * 200} ${y + 200 - r() * 120}, ${W + 50} ${y - 40 + r() * 80}" fill="none" stroke="${accent}" stroke-width="${8 + r() * 26}" stroke-linecap="round" opacity="${0.18 + r() * 0.5}"/>`;
    }
  } else {
    body += `<radialGradient id="g" cx="${30 + r() * 40}%" cy="${30 + r() * 40}%" r="60%"><stop offset="0" stop-color="${accent}" stop-opacity=".85"/><stop offset="1" stop-color="${primary}" stop-opacity="0"/></radialGradient><rect width="${W}" height="${H}" fill="${primary}"/><rect width="${W}" height="${H}" fill="url(#g)"/><pattern id="d" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="#fff" opacity=".35"/></pattern><rect width="${W}" height="${H}" fill="url(#d)"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs/>${body}</svg>`;
}

export function svgDataUrl(svg: string) {
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
