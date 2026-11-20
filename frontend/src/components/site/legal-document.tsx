import { Fragment, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Brand } from "@/components/site/brand";

/**
 * Renders the legal texts (Qlyra, Inc.'s documents, copied verbatim into
 * src/content/legal/*.md). Supports the subset they use: #/##/### headings, paragraphs,
 * "- " lists, "---" rules, **bold** and [links](url).
 */

const DOC_LINKS: Record<string, string> = {
  "Terms of Use": "/terms",
  "Privacy Policy": "/privacy",
  "Legal Notice": "/legal-notice",
};
const EMAIL_RE = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/;
const LINK_CLASS = "underline underline-offset-2 hover:text-foreground";

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function boldContent(text: string, key: string): ReactNode {
  const doc = DOC_LINKS[text];
  if (doc)
    return (
      <Link key={key} to={doc as never} className={`font-semibold text-foreground ${LINK_CLASS}`}>
        {text}
      </Link>
    );
  if (EMAIL_RE.test(text))
    return (
      <a
        key={key}
        href={`mailto:${text}`}
        className={`font-semibold text-foreground ${LINK_CLASS}`}
      >
        {text}
      </a>
    );
  return (
    <strong key={key} className="font-semibold text-foreground">
      {text}
    </strong>
  );
}

/** **bold**, [text](url) and [**text**](url). */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[(\*\*)?([^\]]+?)(\*\*)?\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let i = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `i${i++}`;
    if (m[4]) {
      const label = m[2] ?? "";
      const href = m[4].replace(/^http:\/\//, "https://");
      const external = /^https?:\/\//.test(href);
      out.push(
        <a
          key={key}
          href={href}
          className={`${m[1] ? "font-semibold text-foreground " : ""}${LINK_CLASS}`}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {label}
        </a>,
      );
    } else {
      out.push(boldContent(m[5] ?? "", key));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: "h1" | "h2" | "h3" | "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "hr" };

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  let list: string[] | null = null;
  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (item) {
      if (!list) {
        list = [];
        blocks.push({ kind: "ul", items: list });
      }
      list.push(item[1] ?? "");
      continue;
    }
    list = null;
    if (!line) continue;
    if (line === "---") blocks.push({ kind: "hr" });
    else if (line.startsWith("### ")) blocks.push({ kind: "h3", text: line.slice(4) });
    else if (line.startsWith("## ")) blocks.push({ kind: "h2", text: line.slice(3) });
    else if (line.startsWith("# ")) blocks.push({ kind: "h1", text: line.slice(2) });
    else blocks.push({ kind: "p", text: line });
  }
  return blocks;
}

export function LegalDocument({ source, current }: { source: string; current: string }) {
  const blocks = parse(source);
  return (
    <div className="site-width mx-auto max-w-3xl px-4 py-16">
      <Link to="/" className="mb-10 inline-block" aria-label="Clonyfy home">
        <Brand />
      </Link>
      <article className="text-sm leading-relaxed text-foreground/80">
        {blocks.map((b, i) => {
          switch (b.kind) {
            case "h1":
              return (
                <h1 key={i} className="font-display text-4xl tracking-tight text-foreground">
                  {b.text}
                </h1>
              );
            case "h2":
              return (
                <h2
                  key={i}
                  id={slug(b.text)}
                  className="mt-10 scroll-mt-24 font-display text-xl text-foreground"
                >
                  {b.text}
                </h2>
              );
            case "h3":
              return (
                <h3 key={i} className="mt-6 text-base font-semibold text-foreground">
                  {b.text}
                </h3>
              );
            case "ul":
              return (
                <ul key={i} className="mt-3 list-disc space-y-1.5 pl-5">
                  {b.items.map((it, j) => (
                    <li key={j}>{inline(it)}</li>
                  ))}
                </ul>
              );
            case "hr":
              return <hr key={i} className="mt-10 border-border" />;
            default:
              return (
                <p key={i} className="mt-3">
                  {inline(b.text).map((n, j) => (
                    <Fragment key={j}>{n}</Fragment>
                  ))}
                </p>
              );
          }
        })}
      </article>
      <nav className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-sm">
        {Object.entries(DOC_LINKS)
          .filter(([, to]) => to !== current)
          .map(([label, to]) => (
            <Link
              key={to}
              to={to as never}
              className="text-foreground/65 underline underline-offset-4 hover:text-foreground"
            >
              {label}
            </Link>
          ))}
      </nav>
    </div>
  );
}
