import { useEffect, useState, type ReactNode } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  BookmarkPlus,
  Box,
  ChevronRight,
  Copy,
  CornerLeftUp,
  Eraser,
  Eye,
  EyeOff,
  Film,
  Heading,
  Image as ImageIcon,
  ImagePlus,
  Italic,
  LayoutGrid,
  LayoutTemplate,
  Link2,
  List,
  Lock,
  Move,
  MousePointerClick,
  Paintbrush,
  Pencil,
  Play,
  RotateCcw,
  Shapes,
  Sparkles,
  SquareDashed,
  Trash2,
  Type,
  Underline,
  Unlink,
  Unlock,
  Wand2,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  FONT_LIBRARY,
  SHADOW_PRESETS,
  type ElementKind,
  type SelectionInfo,
} from "@/lib/editor-dom";
import {
  KIND_LABEL,
  LAYOUTS,
  LOOKS,
  type DesignChoice,
  type SectionKind,
} from "@/lib/studio/designs";
import {
  DEFAULT_MOTION,
  MOTION_EASINGS,
  MOTION_EFFECTS,
  type MotionConfig,
} from "@/lib/studio/motion";
import type { StudioInfo } from "@/lib/studio/describe";
import type { Scope } from "@/lib/studio/engine";
import {
  ColorField,
  FIELD,
  Group,
  IconAction,
  NumberField,
  Row,
  Segmented,
  SliderField,
  TextButton,
  ToolButton,
} from "./controls";
import { DesignThumb } from "./design-thumb";

export type SectionTarget = {
  kind: SectionKind;
  choice: DesignChoice | null;
  name: string;
  isSelf: boolean;
};

export type StudioActions = {
  editText: () => void;
  selectAncestor: (levelsUp: number) => void;
  selectSection: () => void;
  duplicate: () => void;
  move: (dir: "up" | "down") => void;
  toggleHidden: () => void;
  toggleLock: () => void;
  remove: () => void;
  deselect: () => void;
  saveToLibrary: () => void;
  rename: (name: string) => void;
  style: (props: Record<string, string>, key: string) => void;
  setFont: (family: string | null, scope: "element" | "page") => void;
  matchSimilar: () => void;
  removeShadows: () => void;
  resetStyles: () => void;
  setText: (text: string) => void;
  setLink: (href: string, newTab: boolean) => void;
  removeLink: () => void;
  setAlt: (alt: string) => void;
  replaceImage: () => void;
  replaceBackground: () => void;
  removeBackground: () => void;
  applyDesign: (choice: DesignChoice | null) => void;
  applyLookToPage: (lookId: string) => void;
  clearPageDesigns: () => void;
  setMotion: (cfg: MotionConfig | null) => void;
  replayMotion: () => void;
};

type Props = {
  sel: SelectionInfo | null;
  studio: StudioInfo | null;
  selKey: number;
  section: SectionTarget | null;
  pageLook: string | null;
  scope: Scope;
  editingText: boolean;
  dirty: boolean;
  uploading: boolean;
  palette: string[];
  actions: StudioActions;
};

const KIND_ICON: Record<ElementKind, typeof Type> = {
  heading: Heading,
  text: Type,
  link: Link2,
  button: MousePointerClick,
  image: ImageIcon,
  icon: Shapes,
  media: Film,
  list: List,
  field: SquareDashed,
  section: LayoutTemplate,
  container: Box,
};

const SCOPE_LABEL: Record<Scope, string> = {
  base: "Base · All devices",
  tablet: "Tablet override · ≤1024px",
  mobile: "Mobile override · ≤640px",
};

const GRADIENTS = [
  "linear-gradient(135deg,#667eea,#764ba2)",
  "linear-gradient(135deg,#ff8a5b,#ff4d8d)",
  "linear-gradient(135deg,#43e97b,#38f9d7)",
  "linear-gradient(135deg,#0f2027,#2c5364)",
  "linear-gradient(135deg,#f6d365,#fda085)",
  "linear-gradient(135deg,#a1c4fd,#c2e9fb)",
  "linear-gradient(135deg,#141e30,#243b55)",
  "linear-gradient(135deg,#fbc2eb,#a6c1ee)",
];

/* --------------------------------------------------------------- designs */

function DesignsPanel({ section, actions }: { section: SectionTarget; actions: StudioActions }) {
  const [showAll, setShowAll] = useState(false);
  const layouts = LAYOUTS[section.kind];
  const current = section.choice;
  const layout = current?.layout || layouts[0]!.id;
  const looks = showAll ? LOOKS : LOOKS.slice(0, 8);
  const apply = (look: string, lay = layout) =>
    actions.applyDesign({ kind: section.kind, look, layout: lay });
  return (
    <Group
      title="One-click designs"
      icon={Wand2}
      aside={
        <span className="text-[10px] text-emerald-400">
          {LOOKS.length * layouts.length} variations
        </span>
      }
    >
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate text-muted-foreground">
          {KIND_LABEL[section.kind]} · <span className="text-foreground">{section.name}</span>
        </span>
        {!section.isSelf && (
          <button
            type="button"
            onClick={actions.selectSection}
            className="shrink-0 text-muted-foreground hover:text-foreground hover:underline"
          >
            Select section
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {layouts.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => apply(current?.look || LOOKS[0]!.id, l.id)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              layout === l.id && current
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {l.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {looks.map((look, i) => {
          const on = current?.look === look.id && current.layout === layout;
          return (
            <button
              key={look.id}
              type="button"
              onClick={() => apply(look.id)}
              className={`group overflow-hidden rounded-xl border p-1.5 text-left transition-all hover:-translate-y-0.5 ${
                on
                  ? "border-emerald-400 ring-2 ring-emerald-400/30"
                  : "border-border hover:border-foreground/30"
              }`}
              title={`${look.name} — ${look.note}`}
            >
              <DesignThumb kind={section.kind} look={look.id} layout={layout} />
              <div className="px-1 pb-0.5 pt-1.5">
                <p className="flex items-center gap-1 text-[11px] font-semibold">
                  <span className="tabular-nums text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate">{look.name}</span>
                </p>
                <p className="truncate text-[10px] text-muted-foreground">{look.note}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TextButton onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `Show all ${LOOKS.length} looks`}
        </TextButton>
        {current && (
          <>
            <TextButton onClick={() => actions.applyLookToPage(current.look)}>
              <Sparkles size={13} /> Use on every section
            </TextButton>
            <TextButton onClick={() => actions.applyDesign(null)}>
              <RotateCcw size={13} /> Original
            </TextButton>
          </>
        )}
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Click to apply · Undo to compare. Text, links and images stay intact.
      </p>
    </Group>
  );
}

function PageLooks({ pageLook, actions }: { pageLook: string | null; actions: StudioActions }) {
  return (
    <div className="space-y-3 p-4">
      <div>
        <p className="text-sm font-semibold">Transform the whole page</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          One click restyles every section — navigation, hero, cards, footer — each with a layout
          that suits it. Fine-tune any section afterwards.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {LOOKS.map((look) => (
          <button
            key={look.id}
            type="button"
            onClick={() => actions.applyLookToPage(look.id)}
            className={`overflow-hidden rounded-xl border p-1.5 text-left transition-all hover:-translate-y-0.5 ${
              pageLook === look.id
                ? "border-emerald-400 ring-2 ring-emerald-400/30"
                : "border-border hover:border-foreground/30"
            }`}
          >
            <DesignThumb kind="hero" look={look.id} layout="centered" />
            <p className="truncate px-1 pt-1.5 text-[11px] font-semibold">{look.name}</p>
            <p className="truncate px-1 pb-0.5 text-[10px] text-muted-foreground">{look.note}</p>
          </button>
        ))}
      </div>
      <TextButton onClick={actions.clearPageDesigns}>
        <RotateCcw size={13} /> Restore original designs
      </TextButton>
    </div>
  );
}

/* --------------------------------------------------------------- content */

function ContentGroup({
  sel,
  studio,
  selKey,
  uploading,
  a,
}: {
  sel: SelectionInfo;
  studio: StudioInfo;
  selKey: number;
  uploading: boolean;
  a: StudioActions;
}) {
  const [name, setName] = useState(studio.customName);
  const [text, setText] = useState(sel.plainText ?? "");
  const [href, setHref] = useState(sel.href ?? "");
  const [newTab, setNewTab] = useState(sel.linkNewTab);
  const [alt, setAlt] = useState(sel.alt);
  useEffect(() => {
    setName(studio.customName);
    setText(sel.plainText ?? "");
    setHref(sel.href ?? "");
    setNewTab(sel.linkNewTab);
    setAlt(sel.alt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);
  const commitText = () => {
    if (sel.plainText !== null && text !== sel.plainText && text.trim()) a.setText(text);
  };
  return (
    <Group title="Content" icon={Type}>
      <Row label="Layer name">
        <input
          value={name}
          placeholder={sel.name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== studio.customName && a.rename(name)}
          onKeyDown={(e) => e.key === "Enter" && a.rename(name)}
          className={FIELD}
          aria-label="Layer name"
        />
      </Row>
      {sel.canEditText &&
        (sel.plainText !== null ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commitText();
            }}
            rows={Math.min(7, Math.max(2, Math.ceil(text.length / 34)))}
            className="w-full resize-y rounded-lg border border-border bg-background/60 px-2.5 py-2 text-xs leading-relaxed outline-none focus:border-foreground/40"
            aria-label="Element text"
          />
        ) : (
          <TextButton onClick={a.editText}>
            <Pencil size={13} /> Edit text on canvas
          </TextButton>
        ))}
      <Row label="Link">
        <input
          value={href}
          onChange={(e) => setHref(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && href.trim() && a.setLink(href.trim(), newTab)}
          placeholder="/pricing or https://…"
          className={FIELD}
          aria-label="Link address"
        />
      </Row>
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Switch checked={newTab} onCheckedChange={setNewTab} aria-label="Open in a new tab" /> New
          tab
        </label>
        <div className="flex gap-1.5">
          <TextButton onClick={() => a.setLink(href.trim(), newTab)} disabled={!href.trim()}>
            <Link2 size={13} /> {sel.href !== null ? "Update" : "Add"}
          </TextButton>
          {sel.href !== null && (
            <TextButton onClick={a.removeLink}>
              <Unlink size={13} />
            </TextButton>
          )}
        </div>
      </div>
      {sel.isImage && (
        <>
          {sel.imageSrc && (
            <div className="overflow-hidden rounded-lg border border-border bg-[repeating-conic-gradient(#2a2a2a_0_25%,#202020_0_50%)] bg-[length:12px_12px]">
              <img src={sel.imageSrc} alt="" className="mx-auto max-h-28 w-auto object-contain" />
            </div>
          )}
          <div className="flex gap-2">
            <TextButton onClick={a.replaceImage} disabled={uploading}>
              <ImagePlus size={13} /> {uploading ? "Uploading…" : "Replace image"}
            </TextButton>
          </div>
          <Row label="Fit">
            <Segmented
              label="Image fit"
              value={
                (["cover", "contain", "fill"].includes(sel.objectFit)
                  ? sel.objectFit
                  : "fill") as string
              }
              options={[
                { value: "cover", label: "Cover" },
                { value: "contain", label: "Contain" },
                { value: "fill", label: "Stretch" },
              ]}
              onChange={(v) => a.style({ "object-fit": v }, "object-fit")}
            />
          </Row>
          <Row label="Alt text">
            <input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              onBlur={() => alt !== sel.alt && a.setAlt(alt)}
              placeholder="Describe the image"
              className={FIELD}
              aria-label="Image alt text"
            />
          </Row>
        </>
      )}
    </Group>
  );
}

/* ------------------------------------------------------------ appearance */

function AppearanceGroup({
  sel,
  palette,
  a,
}: {
  sel: SelectionInfo;
  palette: string[];
  a: StudioActions;
}) {
  const [g1, setG1] = useState("#6d5dfc");
  const [g2, setG2] = useState("#ff6b9a");
  const [angle, setAngle] = useState(135);
  const shadow =
    SHADOW_PRESETS.find((p) => p.value.replace(/\s/g, "") === sel.boxShadow.replace(/\s/g, ""))
      ?.id ?? (sel.boxShadow === "none" ? "none" : "");
  const gradient = (c1 = g1, c2 = g2, deg = angle) =>
    a.style({ "background-image": `linear-gradient(${deg}deg,${c1},${c2})` }, "gradient");
  return (
    <Group
      title="Appearance"
      icon={Paintbrush}
      aside={<span className="text-[10px] text-muted-foreground">Selected layer only</span>}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">Text color</span>
          <ColorField
            label="Text color"
            value={sel.color}
            palette={palette}
            onChange={(hex) => a.style({ color: hex }, "color")}
          />
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">Background</span>
          <ColorField
            label="Background color"
            value={sel.backgroundColor}
            none={sel.backgroundTransparent}
            palette={palette}
            onChange={(hex) =>
              a.style({ "background-color": hex, "background-image": "none" }, "background")
            }
            onNone={() =>
              a.style(
                { "background-color": "transparent", "background-image": "none" },
                "background",
              )
            }
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <span className="text-[10px] text-muted-foreground">Gradient</span>
        <div className="grid grid-cols-8 gap-1.5">
          {GRADIENTS.map((g) => (
            <button
              key={g}
              type="button"
              title="Apply gradient"
              onClick={() => a.style({ "background-image": g }, "gradient")}
              className="h-6 rounded-md border border-white/10 transition-transform hover:scale-110"
              style={{ background: g }}
            />
          ))}
        </div>
        <div className="grid grid-cols-[1fr_1fr_64px] gap-1.5">
          <ColorField
            label="Gradient start"
            value={g1}
            palette={palette}
            onChange={(c) => {
              setG1(c);
              gradient(c, g2);
            }}
          />
          <ColorField
            label="Gradient end"
            value={g2}
            palette={palette}
            onChange={(c) => {
              setG2(c);
              gradient(g1, c);
            }}
          />
          <NumberField
            label="Gradient angle"
            unit="°"
            min={0}
            max={360}
            value={angle}
            onCommit={(n) => {
              setAngle(n);
              gradient(g1, g2, n);
            }}
          />
        </div>
      </div>
      <Row label="Radius">
        <SliderField
          label="Corner radius"
          value={sel.radius}
          min={0}
          max={80}
          unit="px"
          onChange={(n) => a.style({ "border-radius": `${n}px` }, "radius")}
        />
      </Row>
      <Row label="Opacity">
        <SliderField
          label="Opacity"
          value={sel.opacity}
          min={0}
          max={100}
          unit="%"
          onChange={(n) => a.style({ opacity: String(n / 100) }, "opacity")}
        />
      </Row>
      <Row label="Shadow">
        <Segmented
          label="Shadow"
          value={shadow}
          options={SHADOW_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
          onChange={(id) =>
            a.style({ "box-shadow": SHADOW_PRESETS.find((p) => p.id === id)!.value }, "shadow")
          }
        />
      </Row>
      {sel.hasShadow && (
        <button
          type="button"
          onClick={a.removeShadows}
          className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
        >
          Remove every shadow inside this element
        </button>
      )}
      <Row label="Border">
        <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-2">
          <NumberField
            label="Border width"
            unit="px"
            min={0}
            max={24}
            value={sel.borderWidth}
            onCommit={(n) =>
              a.style(
                n > 0
                  ? { "border-width": `${n}px`, "border-style": "solid" }
                  : { "border-width": "0px" },
                "border-width",
              )
            }
          />
          <ColorField
            label="Border color"
            value={sel.borderColor}
            palette={palette}
            onChange={(hex) =>
              a.style(
                {
                  "border-color": hex,
                  ...(sel.borderWidth ? {} : { "border-width": "1px", "border-style": "solid" }),
                },
                "border-color",
              )
            }
          />
        </div>
      </Row>
    </Group>
  );
}

function TypographyGroup({
  sel,
  palette,
  a,
}: {
  sel: SelectionInfo;
  palette: string[];
  a: StudioActions;
}) {
  const known = FONT_LIBRARY.some((g) => g.families.includes(sel.fontFamily));
  return (
    <Group
      title="Typography"
      icon={Type}
      defaultOpen={["heading", "text", "link", "button"].includes(sel.kind)}
      aside={
        sel.similarCount > 1 ? (
          <button
            type="button"
            onClick={a.matchSimilar}
            className="rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Apply to {sel.similarCount - 1} similar
          </button>
        ) : null
      }
    >
      <Row label="Font">
        <select
          className={`${FIELD} cursor-pointer`}
          value={known ? sel.fontFamily : "__original__"}
          onChange={(e) =>
            a.setFont(e.target.value === "__original__" ? null : e.target.value, "element")
          }
          aria-label="Font family"
        >
          <option value="__original__">
            {known ? "Original font" : `${sel.fontFamily || "Original"} (original)`}
          </option>
          {FONT_LIBRARY.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.families.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Row>
      {known && (
        <button
          type="button"
          onClick={() => a.setFont(sel.fontFamily, "page")}
          className="-mt-1 block w-full text-right text-[10px] text-muted-foreground hover:text-foreground hover:underline"
        >
          Use {sel.fontFamily} across the whole page
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Font size"
          unit="px"
          value={sel.fontSize}
          min={6}
          max={400}
          onCommit={(n) => a.style({ "font-size": `${n}px` }, "font-size")}
        />
        <select
          className={`${FIELD} cursor-pointer`}
          value={String(Math.round(sel.fontWeight / 100) * 100)}
          onChange={(e) => a.style({ "font-weight": e.target.value }, "font-weight")}
          aria-label="Font weight"
        >
          {[
            ["300", "Light"],
            ["400", "Regular"],
            ["500", "Medium"],
            ["600", "Semibold"],
            ["700", "Bold"],
            ["800", "Extra bold"],
            ["900", "Black"],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l} · {v}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Line height"
          unit="×"
          step={0.05}
          min={0.6}
          max={4}
          value={sel.lineHeight}
          onCommit={(n) => a.style({ "line-height": String(n) }, "line-height")}
        />
        <NumberField
          label="Letter spacing"
          unit="px"
          step={0.1}
          min={-10}
          max={40}
          value={sel.letterSpacing}
          onCommit={(n) => a.style({ "letter-spacing": `${n}px` }, "letter-spacing")}
        />
      </div>
      <Segmented
        label="Text alignment"
        value={
          (sel.textAlign === "start"
            ? "left"
            : sel.textAlign === "end"
              ? "right"
              : sel.textAlign) as string
        }
        options={[
          { value: "left", label: "Left", icon: AlignLeft },
          { value: "center", label: "Center", icon: AlignCenter },
          { value: "right", label: "Right", icon: AlignRight },
          { value: "justify", label: "Justify", icon: AlignJustify },
        ]}
        onChange={(v) => a.style({ "text-align": v }, "align")}
      />
      <div className="flex items-center gap-1 rounded-lg border border-border bg-background/60 p-0.5">
        <IconAction
          label="Bold"
          active={sel.bold}
          onClick={() => a.style({ "font-weight": sel.bold ? "400" : "700" }, "bold")}
        >
          <Bold size={14} />
        </IconAction>
        <IconAction
          label="Italic"
          active={sel.italic}
          onClick={() => a.style({ "font-style": sel.italic ? "normal" : "italic" }, "italic")}
        >
          <Italic size={14} />
        </IconAction>
        <IconAction
          label="Underline"
          active={sel.underline}
          onClick={() =>
            a.style({ "text-decoration-line": sel.underline ? "none" : "underline" }, "underline")
          }
        >
          <Underline size={14} />
        </IconAction>
        <span className="mx-1 h-4 w-px bg-border" />
        <div className="flex-1">
          <Segmented
            label="Letter case"
            value={
              (["none", "uppercase", "capitalize", "lowercase"].includes(sel.textTransform)
                ? sel.textTransform
                : "none") as string
            }
            options={[
              { value: "none", label: "Aa" },
              { value: "uppercase", label: "AA" },
              { value: "capitalize", label: "Ab" },
              { value: "lowercase", label: "aa" },
            ]}
            onChange={(v) => a.style({ "text-transform": v }, "transform")}
          />
        </div>
      </div>
      <Row label="Color">
        <ColorField
          label="Text color"
          value={sel.color}
          palette={palette}
          onChange={(hex) => a.style({ color: hex }, "color")}
        />
      </Row>
    </Group>
  );
}

/* --------------------------------------------------------------- layout */

function SizeField({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const v = draft.trim();
    if (v === value) return;
    if (
      v === "" ||
      /^(auto|none|fit-content|max-content|min-content|\d+(\.\d+)?(px|%|vw|vh|rem|em)?)$/.test(v)
    ) {
      onCommit(/^\d+(\.\d+)?$/.test(v) ? `${v}px` : v);
    } else setDraft(value);
  };
  return (
    <label className="block space-y-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <input
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className={FIELD}
        aria-label={label}
      />
    </label>
  );
}

function LayoutGroup({ studio, a }: { studio: StudioInfo; a: StudioActions }) {
  const isFlex = studio.display.includes("flex");
  const isGrid = studio.display.includes("grid");
  const displayValue = [
    "block",
    "flex",
    "inline-flex",
    "grid",
    "inline-block",
    "inline",
    "none",
  ].includes(studio.display)
    ? studio.display
    : "block";
  return (
    <Group title="Layout & sizing" icon={LayoutGrid} defaultOpen={false}>
      <Row label="Display">
        <select
          className={`${FIELD} cursor-pointer`}
          value={displayValue}
          onChange={(e) => a.style({ display: e.target.value }, "display")}
          aria-label="Display"
        >
          <option value="block">Block</option>
          <option value="flex">Flex</option>
          <option value="inline-flex">Inline flex</option>
          <option value="grid">Grid</option>
          <option value="inline-block">Inline block</option>
          <option value="inline">Inline</option>
        </select>
      </Row>
      {isFlex && (
        <>
          <Row label="Direction">
            <select
              className={`${FIELD} cursor-pointer`}
              value={studio.flexDirection}
              onChange={(e) => a.style({ "flex-direction": e.target.value }, "flex-direction")}
              aria-label="Direction"
            >
              <option value="row">Row</option>
              <option value="column">Column</option>
              <option value="row-reverse">Reverse row</option>
              <option value="column-reverse">Reverse column</option>
            </select>
          </Row>
          <Row label="Wrap">
            <Segmented
              label="Wrapping"
              value={
                studio.flexWrap === "wrap" || studio.flexWrap === "wrap-reverse"
                  ? studio.flexWrap
                  : "nowrap"
              }
              options={[
                { value: "nowrap", label: "No wrap" },
                { value: "wrap", label: "Wrap" },
                { value: "wrap-reverse", label: "Reverse" },
              ]}
              onChange={(v) => a.style({ "flex-wrap": v }, "flex-wrap")}
            />
          </Row>
        </>
      )}
      {isGrid && (
        <Row label="Columns">
          <NumberField
            label="Grid columns"
            min={1}
            max={12}
            value={Math.max(1, studio.gridColumns)}
            onCommit={(n) =>
              a.style({ "grid-template-columns": `repeat(${n}, minmax(0, 1fr))` }, "grid-cols")
            }
          />
        </Row>
      )}
      {(isFlex || isGrid) && (
        <>
          <Row label="Align">
            <select
              className={`${FIELD} cursor-pointer`}
              value={studio.alignItems}
              onChange={(e) => a.style({ "align-items": e.target.value }, "align-items")}
              aria-label="Align items"
            >
              <option value="normal">Auto</option>
              <option value="flex-start">Start</option>
              <option value="center">Center</option>
              <option value="flex-end">End</option>
              <option value="stretch">Stretch</option>
              <option value="baseline">Baseline</option>
            </select>
          </Row>
          <Row label="Justify">
            <select
              className={`${FIELD} cursor-pointer`}
              value={studio.justifyContent}
              onChange={(e) => a.style({ "justify-content": e.target.value }, "justify")}
              aria-label="Justify content"
            >
              <option value="normal">Auto</option>
              <option value="flex-start">Start</option>
              <option value="center">Center</option>
              <option value="flex-end">End</option>
              <option value="space-between">Space between</option>
              <option value="space-around">Space around</option>
              <option value="space-evenly">Space evenly</option>
            </select>
          </Row>
          <Row label="Gap">
            <SliderField
              label="Gap"
              value={studio.gap}
              min={0}
              max={120}
              unit="px"
              onChange={(n) => a.style({ gap: `${n}px` }, "gap")}
            />
          </Row>
        </>
      )}
      <div className="grid grid-cols-3 gap-2">
        <SizeField
          label="Width"
          value={studio.width}
          placeholder={`${studio.computedWidth}px`}
          onCommit={(v) => a.style({ width: v }, "width")}
        />
        <SizeField
          label="Height"
          value={studio.height}
          placeholder={`${studio.computedHeight}px`}
          onCommit={(v) => a.style({ height: v }, "height")}
        />
        <SizeField
          label="Max width"
          value={studio.maxWidth}
          placeholder="none"
          onCommit={(v) => a.style({ "max-width": v }, "max-width")}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">auto · % · px · vw — leave empty to reset</p>
    </Group>
  );
}

function BoxEditor({
  label,
  box,
  prefix,
  a,
}: {
  label: string;
  box: StudioInfo["padding"];
  prefix: "padding" | "margin";
  a: StudioActions;
}) {
  const [linked, setLinked] = useState(false);
  const min = prefix === "margin" ? -400 : 0;
  const set = (side: keyof typeof box, n: number) => {
    if (linked)
      a.style(
        {
          [`${prefix}-top`]: `${n}px`,
          [`${prefix}-right`]: `${n}px`,
          [`${prefix}-bottom`]: `${n}px`,
          [`${prefix}-left`]: `${n}px`,
        },
        `${prefix}-all`,
      );
    else a.style({ [`${prefix}-${side}`]: `${n}px` }, `${prefix}-${side}`);
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label} · top right bottom left</span>
        <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Switch
            checked={linked}
            onCheckedChange={setLinked}
            aria-label={`Link all ${prefix} sides`}
          />{" "}
          All sides
        </label>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {(["top", "right", "bottom", "left"] as const).map((side) => (
          <NumberField
            key={side}
            label={`${prefix} ${side}`}
            min={min}
            max={800}
            value={box[side]}
            onCommit={(n) => set(side, n)}
          />
        ))}
      </div>
    </div>
  );
}

function SpacingGroup({ studio, a }: { studio: StudioInfo; a: StudioActions }) {
  return (
    <Group title="Spacing" icon={SquareDashed} defaultOpen={false}>
      <BoxEditor label="Padding" prefix="padding" box={studio.padding} a={a} />
      <BoxEditor label="Margin" prefix="margin" box={studio.margin} a={a} />
    </Group>
  );
}

function PositionGroup({
  studio,
  uploading,
  a,
}: {
  studio: StudioInfo;
  uploading: boolean;
  a: StudioActions;
}) {
  const filter = (blur: number, bright: number) => {
    const parts = [
      blur ? `blur(${blur}px)` : "",
      bright !== 100 ? `brightness(${bright}%)` : "",
    ].filter(Boolean);
    a.style({ filter: parts.join(" ") || "none" }, "filter");
  };
  return (
    <Group title="Position & effects" icon={Move} defaultOpen={false}>
      <Row label="Position">
        <select
          className={`${FIELD} cursor-pointer`}
          value={studio.position}
          onChange={(e) => a.style({ position: e.target.value }, "position")}
          aria-label="Position"
        >
          <option value="static">Flow</option>
          <option value="relative">Relative</option>
          <option value="absolute">Absolute</option>
          <option value="fixed">Fixed</option>
          <option value="sticky">Sticky</option>
        </select>
      </Row>
      {studio.position !== "static" && (
        <div className="grid grid-cols-3 gap-2">
          <SizeField
            label="Top"
            value={studio.top}
            placeholder="auto"
            onCommit={(v) => a.style({ top: v }, "top")}
          />
          <SizeField
            label="Left"
            value={studio.left}
            placeholder="auto"
            onCommit={(v) => a.style({ left: v }, "left")}
          />
          <SizeField
            label="Z index"
            value={studio.zIndex}
            placeholder="auto"
            onCommit={(v) => a.style({ "z-index": v.replace(/px$/, "") }, "z")}
          />
        </div>
      )}
      <Row label="Offset">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
          <NumberField
            label="Move X"
            unit="x"
            min={-4000}
            max={4000}
            value={studio.translate.x}
            onCommit={(n) => a.style({ translate: `${n}px ${studio.translate.y}px` }, "translate")}
          />
          <NumberField
            label="Move Y"
            unit="y"
            min={-4000}
            max={4000}
            value={studio.translate.y}
            onCommit={(n) => a.style({ translate: `${studio.translate.x}px ${n}px` }, "translate")}
          />
          <IconAction
            label="Reset position"
            onClick={() => a.style({ translate: "" }, "translate")}
            disabled={!studio.translate.x && !studio.translate.y}
          >
            <RotateCcw size={13} />
          </IconAction>
        </div>
      </Row>
      <p className="-mt-1 text-[10px] text-muted-foreground">
        Tip: drag the selected element on the canvas to move it. Hold Shift to lock an axis.
      </p>
      <Row label="Overflow">
        <Segmented
          label="Overflow"
          value={
            ["visible", "hidden", "auto"].includes(studio.overflow) ? studio.overflow : "visible"
          }
          options={[
            { value: "visible", label: "Visible" },
            { value: "hidden", label: "Hidden" },
            { value: "auto", label: "Scroll" },
          ]}
          onChange={(v) => a.style({ overflow: v }, "overflow")}
        />
      </Row>
      <Row label="Rotate">
        <SliderField
          label="Rotate"
          value={studio.rotate}
          min={-180}
          max={180}
          unit="°"
          onChange={(n) => a.style({ rotate: n ? `${n}deg` : "" }, "rotate")}
        />
      </Row>
      <Row label="Scale">
        <SliderField
          label="Scale"
          value={Math.round(studio.scale * 100)}
          min={20}
          max={300}
          unit="%"
          onChange={(n) => a.style({ scale: n === 100 ? "" : String(n / 100) }, "scale")}
        />
      </Row>
      <Row label="Blur">
        <SliderField
          label="Blur"
          value={studio.blur}
          min={0}
          max={40}
          unit="px"
          onChange={(n) => filter(n, studio.brightness)}
        />
      </Row>
      <Row label="Brightness">
        <SliderField
          label="Brightness"
          value={studio.brightness}
          min={0}
          max={200}
          unit="%"
          onChange={(n) => filter(studio.blur, n)}
        />
      </Row>
      <div className="space-y-1.5">
        <span className="text-[10px] text-muted-foreground">Background image</span>
        <div className="flex flex-wrap gap-1.5">
          <TextButton onClick={a.replaceBackground} disabled={uploading}>
            <ImagePlus size={13} /> {studio.backgroundImage ? "Replace" : "Upload"}
          </TextButton>
          {studio.backgroundImage && (
            <TextButton onClick={a.removeBackground}>
              <Eraser size={13} /> Remove
            </TextButton>
          )}
        </div>
        {studio.backgroundImage && (
          <div className="grid grid-cols-2 gap-1.5">
            <select
              className={`${FIELD} cursor-pointer`}
              value={
                ["cover", "contain", "auto"].includes(studio.backgroundSize)
                  ? studio.backgroundSize
                  : "cover"
              }
              onChange={(e) => a.style({ "background-size": e.target.value }, "bg-size")}
              aria-label="Background size"
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="auto">Original size</option>
            </select>
            <select
              className={`${FIELD} cursor-pointer`}
              value={studio.backgroundPosition}
              onChange={(e) => a.style({ "background-position": e.target.value }, "bg-pos")}
              aria-label="Background position"
            >
              <option value="50% 50%">Center</option>
              <option value="50% 0%">Top</option>
              <option value="50% 100%">Bottom</option>
              <option value="0% 50%">Left</option>
              <option value="100% 50%">Right</option>
            </select>
          </div>
        )}
      </div>
    </Group>
  );
}

/* ----------------------------------------------------------------- motion */

function MotionTab({ studio, a }: { studio: StudioInfo; a: StudioActions }) {
  const cfg = studio.motion || DEFAULT_MOTION;
  const active = !!studio.motion;
  const set = (patch: Partial<MotionConfig>) => a.setMotion({ ...cfg, ...patch });
  return (
    <div>
      <Group
        title="Animation studio"
        icon={Play}
        aside={<span className="text-[10px] text-emerald-400">{active ? "Live" : "Off"}</span>}
      >
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => a.setMotion(null)}
            className={`rounded-lg border px-2 py-2 text-left text-[11px] transition-colors ${!active ? "border-foreground bg-foreground text-background" : "border-border hover:bg-accent"}`}
          >
            <span className="font-semibold">None</span>
            <span className="block text-[10px] opacity-70">No animation</span>
          </button>
          {MOTION_EFFECTS.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() =>
                set({
                  effect: e.id,
                  ...(e.id === "parallax" ? { trigger: "scroll" as const } : {}),
                })
              }
              className={`rounded-lg border px-2 py-2 text-left text-[11px] transition-colors ${active && cfg.effect === e.id ? "border-emerald-400 bg-emerald-400/10" : "border-border hover:bg-accent"}`}
            >
              <span className="font-semibold">{e.name}</span>
              <span className="block text-[10px] text-muted-foreground">{e.note}</span>
            </button>
          ))}
        </div>
      </Group>
      {active && (
        <Group title="Timing" icon={Film}>
          <Row label="Trigger">
            <Segmented
              label="Trigger"
              value={cfg.trigger}
              options={[
                { value: "load", label: "Page load" },
                { value: "scroll", label: "Scroll in" },
                { value: "hover", label: "Hover" },
              ]}
              onChange={(v) => set({ trigger: v })}
            />
          </Row>
          <Row label="Duration">
            <SliderField
              label="Duration"
              value={cfg.duration}
              min={0.1}
              max={6}
              step={0.1}
              unit="s"
              onChange={(n) => set({ duration: n })}
            />
          </Row>
          <Row label="Delay">
            <SliderField
              label="Delay"
              value={cfg.delay}
              min={0}
              max={4}
              step={0.1}
              unit="s"
              onChange={(n) => set({ delay: n })}
            />
          </Row>
          <Row label="Easing">
            <select
              className={`${FIELD} cursor-pointer`}
              value={cfg.easing}
              onChange={(e) => set({ easing: e.target.value })}
              aria-label="Easing"
            >
              {MOTION_EASINGS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Repeat">
            <Segmented
              label="Repeat"
              value={cfg.repeat}
              options={[
                { value: "once", label: "Play once" },
                { value: "loop", label: "Loop" },
              ]}
              onChange={(v) => set({ repeat: v })}
            />
          </Row>
          <div className="flex gap-2">
            <TextButton onClick={a.replayMotion}>
              <Play size={13} /> Replay
            </TextButton>
            <TextButton onClick={() => a.setMotion(null)}>
              <Trash2 size={13} /> Remove animation
            </TextButton>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Animations apply to this layer only and are included in every export. Scroll triggers
            use the browser’s scroll timeline; reduced-motion preferences are respected. Switch to
            Preview to try hover effects.
          </p>
        </Group>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ panel */

export function StudioInspector({
  sel,
  studio,
  selKey,
  section,
  pageLook,
  scope,
  editingText,
  dirty,
  uploading,
  palette,
  actions: a,
}: Props) {
  const [tab, setTab] = useState<"design" | "motion" | "ai">("design");
  const KindIcon = sel ? KIND_ICON[sel.kind] : MousePointerClick;
  const locked = !!studio && (studio.locked || studio.lockedBy);

  let body: ReactNode;
  if (tab === "ai") {
    body = (
      <div className="m-4 space-y-3 rounded-xl border border-dashed border-border p-5 text-center">
        <Lock size={20} className="mx-auto text-muted-foreground" />
        <p className="text-sm font-semibold">AI Design is coming soon</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Describe a mood and explore editable directions. Until then, use One-click designs —{" "}
          {LOOKS.length} looks × layouts for every section.
        </p>
        <TextButton onClick={() => setTab("design")}>
          <Wand2 size={13} /> Open One-click designs
        </TextButton>
      </div>
    );
  } else if (!sel || !studio) {
    body =
      tab === "motion" ? (
        <p className="p-6 text-center text-xs text-muted-foreground">
          Select an element to animate it.
        </p>
      ) : (
        <PageLooks pageLook={pageLook} actions={a} />
      );
  } else if (locked) {
    body = (
      <div className="m-4 space-y-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-center">
        <Lock size={18} className="mx-auto text-amber-400" />
        <p className="text-sm font-semibold">
          {studio.locked ? "This layer is locked" : "Inside a locked layer"}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Locked layers can’t be moved, restyled or deleted.
        </p>
        {studio.locked && (
          <TextButton onClick={a.toggleLock}>
            <Unlock size={13} /> Unlock
          </TextButton>
        )}
      </div>
    );
  } else if (tab === "motion") {
    body = <MotionTab studio={studio} a={a} />;
  } else {
    body = (
      <div>
        {section && <DesignsPanel section={section} actions={a} />}
        <ContentGroup sel={sel} studio={studio} selKey={selKey} uploading={uploading} a={a} />
        <AppearanceGroup sel={sel} palette={palette} a={a} />
        <TypographyGroup sel={sel} palette={palette} a={a} />
        <LayoutGroup studio={studio} a={a} />
        <SpacingGroup studio={studio} a={a} />
        <PositionGroup studio={studio} uploading={uploading} a={a} />
        <div className="p-4">
          <TextButton onClick={a.resetStyles}>
            <RotateCcw size={13} /> Reset this layer’s styles
          </TextButton>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            {scope === "base"
              ? "Base styles cascade to tablet and mobile."
              : "You are editing a device override — switch to Desktop to edit base styles."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={250}>
      <aside className="flex h-full min-h-0 flex-col bg-card/40" aria-label="Design inspector">
        <div className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-3">
          <p className="text-sm font-semibold">Design Inspector</p>
          <span className="rounded-md bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            Precision
          </span>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-1 border-b border-hairline p-2">
          {(
            [
              ["design", "Design", Paintbrush],
              ["motion", "Motion", Play],
              ["ai", "AI Design", Sparkles],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs transition-colors ${
                tab === id
                  ? "bg-accent text-foreground shadow-[inset_0_0_0_1px_var(--border)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={13} /> {label}
              {id === "ai" && <Lock size={10} className="opacity-60" />}
            </button>
          ))}
        </div>

        {sel && studio && tab !== "ai" && (
          <div className="shrink-0 border-b border-hairline px-4 pb-3 pt-3">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-background/70">
                <KindIcon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {editingText ? (
                    <span className="text-emerald-400">Editing text</span>
                  ) : (
                    sel.kindLabel
                  )}
                  <span className="rounded bg-accent px-1 font-mono text-[9px] normal-case tracking-normal">
                    {sel.tag}
                  </span>
                  {studio.locked && <Lock size={10} className="text-amber-400" />}
                  {sel.hidden && <span className="text-amber-400">Hidden</span>}
                </p>
                <p
                  className="mt-0.5 truncate text-sm font-medium"
                  title={studio.customName || sel.name}
                >
                  {studio.customName ||
                    (["heading", "text", "link", "button"].includes(sel.kind)
                      ? sel.label
                      : sel.name) ||
                    sel.name}
                </p>
              </div>
              <IconAction label="Deselect (Esc)" onClick={a.deselect}>
                <X size={14} />
              </IconAction>
            </div>
            <nav
              aria-label="Element path"
              className="mt-2 flex flex-wrap items-center gap-0.5 font-mono text-[10px]"
            >
              {sel.path.map((tag, i) => {
                const up = sel.path.length - 1 - i;
                return (
                  <span key={i} className="flex items-center gap-0.5">
                    {i > 0 && <ChevronRight size={10} className="text-muted-foreground/50" />}
                    <button
                      type="button"
                      disabled={up === 0}
                      onClick={() => a.selectAncestor(up)}
                      className={`rounded px-1 py-0.5 ${up === 0 ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                    >
                      {tag}
                    </button>
                  </span>
                );
              })}
            </nav>
            <div className="mt-2.5 grid grid-cols-8 gap-0.5 rounded-xl border border-border bg-background/50 p-1">
              <ToolButton
                icon={Pencil}
                label="Edit"
                hint="Edit text (Enter)"
                onClick={a.editText}
                disabled={!sel.canEditText || editingText || locked}
              />
              <ToolButton
                icon={CornerLeftUp}
                label="Parent"
                hint="Select parent"
                onClick={() => a.selectAncestor(1)}
                disabled={!sel.hasParent}
              />
              <ToolButton
                icon={Copy}
                label="Copy"
                hint="Duplicate (Ctrl+D)"
                onClick={a.duplicate}
                disabled={locked}
              />
              <ToolButton
                icon={ArrowUp}
                label="Up"
                hint="Move up"
                onClick={() => a.move("up")}
                disabled={!sel.canMoveUp || locked}
              />
              <ToolButton
                icon={ArrowDown}
                label="Down"
                hint="Move down"
                onClick={() => a.move("down")}
                disabled={!sel.canMoveDown || locked}
              />
              <ToolButton
                icon={sel.hidden ? Eye : EyeOff}
                label={sel.hidden ? "Show" : "Hide"}
                hint={sel.hidden ? "Show" : "Hide"}
                onClick={a.toggleHidden}
                active={sel.hidden}
                disabled={locked}
              />
              <ToolButton
                icon={studio.locked ? Unlock : Lock}
                label={studio.locked ? "Unlock" : "Lock"}
                hint="Lock layer"
                onClick={a.toggleLock}
                active={studio.locked}
                disabled={studio.lockedBy}
              />
              <ToolButton
                icon={Trash2}
                label="Delete"
                hint="Delete (Del)"
                onClick={a.remove}
                danger
                disabled={locked}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">
                Editing scope{" "}
                <span className={scope === "base" ? "text-emerald-400" : "text-amber-400"}>
                  {SCOPE_LABEL[scope]}
                </span>
              </span>
              <button
                type="button"
                onClick={a.saveToLibrary}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <BookmarkPlus size={11} /> Save to library
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{body}</div>

        <div className="flex shrink-0 items-center gap-2 border-t border-hairline px-4 py-2.5 text-[11px]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${dirty ? "bg-amber-400" : "bg-emerald-400"}`}
          />
          <span className="text-muted-foreground">
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
        </div>
      </aside>
    </TooltipProvider>
  );
}
