import type { CSSProperties } from "react";
import { lookById, stack, type SectionKind } from "@/lib/studio/designs";

/** Miniature schematic of a section in a given look + layout. */
export function DesignThumb({
  kind,
  look,
  layout,
}: {
  kind: SectionKind;
  look: string;
  layout: string;
}) {
  const L = lookById(look);
  const p = L.palette;
  const centered = layout === "centered";
  const radius = L.button === "pill" ? 999 : Math.min(L.radius, 6);
  const btn: CSSProperties =
    L.button === "outline"
      ? { border: `1.5px solid ${p.accent}`, background: "transparent" }
      : L.button === "brutal"
        ? { background: p.accent, border: "1.5px solid #000", boxShadow: "2px 2px 0 #000" }
        : { background: L.button === "soft" ? p.text : p.accent };
  const bar = (w: string, h = 3, color = p.text, o = 1): CSSProperties => ({
    width: w,
    height: h,
    borderRadius: 2,
    background: color,
    opacity: o,
  });
  const frame: CSSProperties = {
    background: p.bg,
    borderRadius: layout === "floating" ? 999 : layout === "framed" || layout === "card" ? 8 : 4,
    margin: layout === "floating" || layout === "framed" || layout === "card" ? "6px 8px" : 0,
    border: layout === "underline" ? "none" : `1px solid ${p.border}`,
    borderBottom: layout === "underline" ? `1.5px solid ${p.text}` : undefined,
    backdropFilter: L.blur ? "blur(6px)" : undefined,
    fontFamily: stack(L.heading),
  };
  const wrap: CSSProperties = {
    height: 64,
    borderRadius: 8,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    background: L.blur ? "linear-gradient(135deg,#c7d2fe,#fbcfe8)" : p.dark ? "#1b1b1b" : "#e9e7e2",
  };

  if (kind === "nav") {
    return (
      <div style={wrap}>
        <div
          style={{
            ...frame,
            display: "flex",
            alignItems: "center",
            justifyContent: centered ? "center" : "space-between",
            gap: 8,
            padding: layout === "compact" ? "5px 10px" : "10px 12px",
          }}
        >
          <span style={bar("18px", 5)} />
          <span style={{ display: "flex", gap: 4 }}>
            <span style={bar("10px", 2, p.muted)} />
            <span style={bar("10px", 2, p.muted)} />
            <span style={bar("10px", 2, p.muted)} />
          </span>
          <span style={{ ...btn, width: 16, height: 7, borderRadius: radius }} />
        </div>
      </div>
    );
  }
  if (kind === "cards") {
    const card: CSSProperties =
      layout === "outlined"
        ? { border: `1px solid ${p.border}` }
        : layout === "tinted"
          ? { background: `color-mix(in srgb, ${p.accent} 18%, transparent)` }
          : layout === "flat"
            ? {}
            : { background: p.surface, boxShadow: "0 3px 6px -3px rgba(0,0,0,.4)" };
    return (
      <div style={{ ...wrap, background: p.bg }}>
        <div style={{ display: "flex", gap: 4, padding: "0 8px" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 36,
                borderRadius: Math.min(L.radius, 6),
                padding: 5,
                ...card,
              }}
            >
              <span style={{ display: "block", ...bar("70%", 3) }} />
              <span style={{ display: "block", marginTop: 4, ...bar("90%", 2, p.muted) }} />
              <span style={{ display: "block", marginTop: 3, ...bar("60%", 2, p.muted) }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "footer") {
    return (
      <div style={{ ...wrap, background: p.bg }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: layout === "compact" ? "4px 10px" : "8px 10px",
            justifyContent: centered ? "center" : "space-between",
            borderTop: `1px solid ${p.border}`,
          }}
        >
          <span style={bar("20px", 5)} />
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={bar("14px", 2)} />
              <span style={bar("12px", 2, p.muted)} />
              <span style={bar("10px", 2, p.muted)} />
            </span>
          ))}
        </div>
      </div>
    );
  }
  // hero / cta / content
  const banner = kind === "cta" && layout === "banner";
  const bg = banner ? p.accent : p.bg;
  const fg = banner ? p.accentText : p.text;
  return (
    <div style={wrap}>
      <div
        style={{
          ...frame,
          background: bg,
          flex: layout === "framed" || layout === "card" ? undefined : 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: centered || kind === "cta" ? "center" : "flex-start",
          gap: 4,
          padding: layout === "spacious" ? "14px 12px" : "8px 12px",
        }}
      >
        <span style={bar(kind === "hero" ? "62%" : "50%", kind === "hero" ? 6 : 4, fg)} />
        <span style={bar("44%", 2, banner ? fg : p.muted, 0.8)} />
        <span style={{ display: "flex", gap: 4, marginTop: 3 }}>
          <span
            style={{
              ...btn,
              ...(banner ? { background: p.accentText } : {}),
              width: 20,
              height: 7,
              borderRadius: radius,
            }}
          />
          {kind === "hero" && (
            <span
              style={{
                width: 16,
                height: 7,
                borderRadius: radius,
                border: `1px solid ${p.border}`,
              }}
            />
          )}
        </span>
      </div>
    </div>
  );
}
