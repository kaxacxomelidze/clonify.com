import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Box,
  ChevronDown,
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
  Layers,
  LayoutTemplate,
  Link2,
  List,
  MousePointerClick,
  Paintbrush,
  PanelTop,
  Pencil,
  RotateCcw,
  Shapes,
  Sparkles,
  SquareDashed,
  Trash2,
  Type,
  Underline,
  Unlink,
  X,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FONT_LIBRARY,
  SHADOW_PRESETS,
  type ElementKind,
  type PageSection,
  type SelectionInfo,
} from "@/lib/editor-dom";

/* ------------------------------------------------------------------ types */

export type SectionAction = "select" | "up" | "down" | "duplicate" | "toggle" | "delete";

export type InspectorActions = {
  editText: () => void;
  selectAncestor: (levelsUp: number) => void;
  duplicate: () => void;
  move: (dir: "up" | "down") => void;
  toggleHidden: () => void;
  remove: () => void;
  deselect: () => void;
  /** Live style edit; `key` coalesces rapid changes into one undo step. */
  style: (props: Record<string, string>, key: string) => void;
  matchSimilar: () => void;
  setFont: (family: string | null, scope: "element" | "page") => void;
  removeShadows: () => void;
  resetStyles: () => void;
  setText: (text: string) => void;
  setLink: (href: string, newTab: boolean) => void;
  removeLink: () => void;
  setAlt: (alt: string) => void;
  replaceImage: () => void;
  replaceBackground: () => void;
  removeBackground: () => void;
  section: (el: HTMLElement, action: SectionAction) => void;
};

type Props = {
  sel: SelectionInfo | null;
  /** Bumps on every selection change so drafts reset. */
  selKey: number;
  selectedEl: HTMLElement | null;
  editingText: boolean;
  dirty: boolean;
  uploading: boolean;
  palette: string[];
  sections: PageSection[];
  actions: InspectorActions;
};

/* ------------------------------------------------------------- primitives */

const FIELD =
  "h-8 w-full rounded-lg border border-border bg-background/60 px-2.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-foreground/40 focus:bg-background";

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

function IconAction({
  label,
  onClick,
  disabled,
  active,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={active}
          className={`grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-30 ${
            active
              ? "bg-foreground text-background"
              : danger
                ? "text-red-400 hover:bg-red-500/10"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function Group({
  title,
  icon: Icon,
  children,
  aside,
  defaultOpen = true,
}: {
  title: string;
  icon: typeof Type;
  children: ReactNode;
  aside?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-hairline last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Icon size={13} />
          {title}
          {open ? (
            <ChevronDown size={13} className="ml-auto" />
          ) : (
            <ChevronRight size={13} className="ml-auto" />
          )}
        </button>
        {aside}
      </div>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function NumberField({
  value,
  onCommit,
  min = 0,
  max = 999,
  step = 1,
  unit,
  label,
}: {
  value: number;
  onCommit: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string | undefined;
  label: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return setDraft(String(value));
    const clamped = Math.min(max, Math.max(min, Math.round(n / step) * step));
    const fixed = Number(clamped.toFixed(2));
    setDraft(String(fixed));
    if (fixed !== value) onCommit(fixed);
  };
  return (
    <label className="flex h-8 items-center gap-1 rounded-lg border border-border bg-background/60 px-2 text-xs focus-within:border-foreground/40">
      <input
        value={draft}
        inputMode="decimal"
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(draft);
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const delta = (e.key === "ArrowUp" ? step : -step) * (e.shiftKey ? 10 : 1);
            commit(String((Number(draft) || 0) + delta));
          }
        }}
        className="w-full min-w-0 bg-transparent tabular-nums outline-none"
      />
      {unit && <span className="shrink-0 text-[10px] text-muted-foreground">{unit}</span>}
    </label>
  );
}

function SliderField({
  value,
  min,
  max,
  step = 1,
  unit,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string | undefined;
  label: string;
  onChange: (n: number) => void;
}) {
  const [live, setLive] = useState(value);
  useEffect(() => setLive(value), [value]);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_68px] items-center gap-2.5">
      <Slider
        value={[Math.min(max, Math.max(min, live))]}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onValueChange={(values) => {
          const n = values[0];
          if (n === undefined) return;
          setLive(n);
          onChange(n);
        }}
        className="[&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5"
      />
      <NumberField
        value={live}
        min={min}
        max={max}
        step={step}
        unit={unit}
        label={label}
        onCommit={onChange}
      />
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: typeof Type }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex rounded-lg border border-border bg-background/60 p-0.5"
    >
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.label}
            onClick={() => onChange(o.value)}
            className={`flex h-7 flex-1 items-center justify-center gap-1 rounded-md text-[11px] transition-colors ${
              on
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {Icon ? <Icon size={13} /> : o.label}
          </button>
        );
      })}
    </div>
  );
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
function normalizeHex(v: string) {
  const digits = v.trim().match(HEX_RE)?.[1];
  if (!digits) return null;
  const h =
    digits.length === 3
      ? digits
          .split("")
          .map((c) => c + c)
          .join("")
      : digits;
  return `#${h.toLowerCase()}`;
}

function ColorField({
  value,
  none,
  palette,
  label,
  onChange,
  onNone,
}: {
  value: string;
  none?: boolean;
  palette: string[];
  label: string;
  onChange: (hex: string) => void;
  onNone?: () => void;
}) {
  const [draft, setDraft] = useState(none ? "" : value);
  useEffect(() => setDraft(none ? "" : value), [value, none]);
  const pickerRef = useRef<HTMLInputElement>(null);
  const commit = () => {
    const hex = normalizeHex(draft);
    if (hex && hex !== value) onChange(hex);
    else setDraft(none ? "" : value);
  };
  return (
    <div className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background/60 pl-1 pr-1 focus-within:border-foreground/40">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${label}: choose color`}
            className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md border border-white/15"
            style={
              none
                ? {
                    backgroundImage: "repeating-conic-gradient(#555 0 25%, #333 0 50%)",
                    backgroundSize: "8px 8px",
                  }
                : { background: value }
            }
          />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 space-y-3 rounded-xl p-3">
          <p className="text-[11px] font-medium text-muted-foreground">Page colors</p>
          <div className="grid grid-cols-6 gap-1.5">
            {palette.map((hex) => (
              <button
                key={hex}
                type="button"
                title={hex}
                onClick={() => onChange(hex)}
                className={`h-7 rounded-md border transition-transform hover:scale-110 ${hex === value && !none ? "border-foreground ring-2 ring-foreground/30" : "border-white/10"}`}
                style={{ background: hex }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => pickerRef.current?.click()}
              className="h-8 flex-1 rounded-lg border border-border text-xs transition-colors hover:bg-accent"
            >
              Custom…
            </button>
            {onNone && (
              <button
                type="button"
                onClick={onNone}
                className="h-8 flex-1 rounded-lg border border-border text-xs transition-colors hover:bg-accent"
              >
                No fill
              </button>
            )}
          </div>
          <input
            ref={pickerRef}
            type="color"
            value={none ? "#ffffff" : value}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
        </PopoverContent>
      </Popover>
      <input
        value={draft}
        placeholder={none ? "None" : "#000000"}
        aria-label={label}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="w-full min-w-0 bg-transparent font-mono text-[11px] uppercase tracking-wide outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground/70"
      />
    </div>
  );
}

function TextButton({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-xs transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- sections */

function Typography({
  sel,
  palette,
  a,
}: {
  sel: SelectionInfo;
  palette: string[];
  a: InspectorActions;
}) {
  const known = FONT_LIBRARY.some((g) => g.families.includes(sel.fontFamily));
  return (
    <Group
      title="Typography"
      icon={Type}
      aside={
        sel.similarCount > 1 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={a.matchSimilar}
                className="rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Apply to {sel.similarCount - 1} similar
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              Copy this text style to every matching element on the page
            </TooltipContent>
          </Tooltip>
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
        <div className="-mt-1 flex justify-end">
          <button
            type="button"
            onClick={() => a.setFont(sel.fontFamily, "page")}
            className="text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Use {sel.fontFamily} across the whole page
          </button>
        </div>
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
      <Row label="Color">
        <ColorField
          label="Text color"
          value={sel.color}
          palette={palette}
          onChange={(hex) => a.style({ color: hex }, "color")}
        />
      </Row>
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
          { value: "left", label: "Align left", icon: AlignLeft },
          { value: "center", label: "Align center", icon: AlignCenter },
          { value: "right", label: "Align right", icon: AlignRight },
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
    </Group>
  );
}

function DesignTab({
  sel,
  palette,
  a,
}: {
  sel: SelectionInfo;
  palette: string[];
  a: InspectorActions;
}) {
  const hasText = sel.canEditText || ["heading", "text", "link", "button"].includes(sel.kind);
  const shadow =
    SHADOW_PRESETS.find((p) => p.value.replace(/\s/g, "") === sel.boxShadow.replace(/\s/g, ""))
      ?.id ?? (sel.boxShadow === "none" ? "none" : "");
  const padV = Math.round((sel.padding.top + sel.padding.bottom) / 2);
  const padH = Math.round((sel.padding.left + sel.padding.right) / 2);
  return (
    <div>
      {hasText && <Typography sel={sel} palette={palette} a={a} />}
      <Group title="Fill" icon={Paintbrush}>
        <Row label="Background">
          <ColorField
            label="Background color"
            value={sel.backgroundColor}
            none={sel.backgroundTransparent}
            palette={palette}
            onChange={(hex) => a.style({ "background-color": hex }, "background")}
            onNone={() => a.style({ "background-color": "transparent" }, "background")}
          />
        </Row>
        {sel.hasBackgroundImage && !sel.isImage && (
          <div className="flex gap-2">
            <TextButton onClick={a.replaceBackground}>
              <ImagePlus size={13} /> Replace image
            </TextButton>
            <TextButton onClick={a.removeBackground}>
              <Eraser size={13} /> Remove image
            </TextButton>
          </div>
        )}
      </Group>
      <Group title="Spacing" icon={SquareDashed}>
        <Row label="Padding ↕">
          <SliderField
            label="Vertical padding"
            value={padV}
            min={0}
            max={240}
            unit="px"
            onChange={(n) =>
              a.style({ "padding-top": `${n}px`, "padding-bottom": `${n}px` }, "pad-v")
            }
          />
        </Row>
        <Row label="Padding ↔">
          <SliderField
            label="Horizontal padding"
            value={padH}
            min={0}
            max={240}
            unit="px"
            onChange={(n) =>
              a.style({ "padding-left": `${n}px`, "padding-right": `${n}px` }, "pad-h")
            }
          />
        </Row>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Margin top"
            unit="px top"
            min={-400}
            max={800}
            value={sel.margin.top}
            onCommit={(n) => a.style({ "margin-top": `${n}px` }, "margin-top")}
          />
          <NumberField
            label="Margin bottom"
            unit="px btm"
            min={-400}
            max={800}
            value={sel.margin.bottom}
            onCommit={(n) => a.style({ "margin-bottom": `${n}px` }, "margin-bottom")}
          />
        </div>
      </Group>
      <Group title="Border & corners" icon={PanelTop} defaultOpen={false}>
        <Row label="Radius">
          <SliderField
            label="Corner radius"
            value={sel.radius}
            min={0}
            max={64}
            unit="px"
            onChange={(n) => a.style({ "border-radius": `${n}px` }, "radius")}
          />
        </Row>
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
      <Group title="Effects" icon={Sparkles} defaultOpen={false}>
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
          <div className="flex justify-end">
            <button
              type="button"
              onClick={a.removeShadows}
              className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Remove every shadow inside this element
            </button>
          </div>
        )}
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
      </Group>
    </div>
  );
}

function ContentTab({
  sel,
  selKey,
  uploading,
  a,
}: {
  sel: SelectionInfo;
  selKey: number;
  uploading: boolean;
  a: InspectorActions;
}) {
  const [text, setText] = useState(sel.plainText ?? "");
  const [href, setHref] = useState(sel.href ?? "");
  const [newTab, setNewTab] = useState(sel.linkNewTab);
  const [alt, setAlt] = useState(sel.alt);
  useEffect(() => {
    setText(sel.plainText ?? "");
    setHref(sel.href ?? "");
    setNewTab(sel.linkNewTab);
    setAlt(sel.alt);
    // Reset drafts only when the selection itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);

  const commitText = () => {
    if (sel.plainText !== null && text !== sel.plainText && text.trim()) a.setText(text);
  };

  return (
    <div>
      {sel.canEditText && (
        <Group title="Text" icon={Type}>
          {sel.plainText !== null ? (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={commitText}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commitText();
                }}
                rows={Math.min(8, Math.max(2, Math.ceil(text.length / 34)))}
                className="w-full resize-y rounded-lg border border-border bg-background/60 px-2.5 py-2 text-xs leading-relaxed outline-none focus:border-foreground/40"
                aria-label="Element text"
              />
              <p className="text-[10px] text-muted-foreground">
                Saved when you click away · Ctrl+Enter to apply now
              </p>
            </>
          ) : (
            <>
              <TextButton onClick={a.editText}>
                <Pencil size={13} /> Edit text on canvas
              </TextButton>
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                This text contains inline formatting, so it is edited in place to keep links and
                styling intact.
              </p>
            </>
          )}
        </Group>
      )}

      <Group title="Link" icon={Link2}>
        <input
          value={href}
          onChange={(e) => setHref(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && href.trim() && a.setLink(href.trim(), newTab)}
          placeholder="/pricing or https://…"
          className={FIELD}
          aria-label="Link address"
        />
        <label className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Open in a new tab</span>
          <Switch checked={newTab} onCheckedChange={setNewTab} aria-label="Open in a new tab" />
        </label>
        <div className="flex gap-2">
          <TextButton onClick={() => a.setLink(href.trim(), newTab)} disabled={!href.trim()}>
            <Link2 size={13} /> {sel.href !== null ? "Update link" : "Add link"}
          </TextButton>
          {sel.href !== null && (
            <TextButton onClick={a.removeLink}>
              <Unlink size={13} /> Remove
            </TextButton>
          )}
        </div>
      </Group>

      {sel.isImage && (
        <Group title="Image" icon={ImageIcon}>
          {sel.imageSrc && (
            <div className="overflow-hidden rounded-lg border border-border bg-[repeating-conic-gradient(#2a2a2a_0_25%,#202020_0_50%)] bg-[length:12px_12px]">
              <img src={sel.imageSrc} alt="" className="mx-auto max-h-32 w-auto object-contain" />
            </div>
          )}
          <TextButton onClick={a.replaceImage} disabled={uploading}>
            <ImagePlus size={13} /> {uploading ? "Uploading…" : "Replace image"}
          </TextButton>
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
              onKeyDown={(e) => e.key === "Enter" && a.setAlt(alt)}
              placeholder="Describe the image"
              className={FIELD}
              aria-label="Image alt text"
            />
          </Row>
        </Group>
      )}

      {!sel.isImage && !sel.isSvg && (
        <Group title="Background image" icon={ImagePlus} defaultOpen={sel.hasBackgroundImage}>
          <div className="flex flex-wrap gap-2">
            <TextButton onClick={a.replaceBackground} disabled={uploading}>
              <ImagePlus size={13} />{" "}
              {uploading ? "Uploading…" : sel.hasBackgroundImage ? "Replace" : "Set image"}
            </TextButton>
            {sel.hasBackgroundImage && (
              <TextButton onClick={a.removeBackground}>
                <Eraser size={13} /> Remove
              </TextButton>
            )}
          </div>
        </Group>
      )}
    </div>
  );
}

function LayersTab({
  sections,
  selectedEl,
  a,
}: {
  sections: PageSection[];
  selectedEl: HTMLElement | null;
  a: InspectorActions;
}) {
  if (!sections.length) {
    return (
      <p className="px-4 py-6 text-xs text-muted-foreground">No page sections detected yet.</p>
    );
  }
  return (
    <ol className="space-y-0.5 p-2" aria-label="Page sections">
      {sections.map((s, i) => {
        const Icon = KIND_ICON[s.kind];
        const isSel = selectedEl === s.el;
        const holdsSel = !isSel && !!selectedEl && s.el.contains(selectedEl);
        return (
          <li
            key={i}
            className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
              isSel
                ? "bg-foreground text-background"
                : holdsSel
                  ? "bg-accent"
                  : "hover:bg-accent/70"
            } ${s.hidden ? "opacity-50" : ""}`}
            style={{ paddingLeft: 8 + s.depth * 14 }}
          >
            <button
              type="button"
              onClick={() => a.section(s.el, "select")}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs"
              title={s.name}
            >
              <span
                className={`tabular-nums text-[10px] ${isSel ? "text-background/60" : "text-muted-foreground"}`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <Icon size={13} className="shrink-0" />
              <span className="truncate">{s.name}</span>
            </button>
            <div
              className={`flex items-center gap-0.5 ${isSel ? "" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}
            >
              {(
                [
                  ["up", ArrowUp, "Move up", i === 0],
                  ["down", ArrowDown, "Move down", i === sections.length - 1],
                  ["duplicate", Copy, "Duplicate", false],
                  ["toggle", s.hidden ? Eye : EyeOff, s.hidden ? "Show" : "Hide", false],
                  ["delete", Trash2, "Delete", false],
                ] as const
              ).map(([action, ActIcon, label, disabled]) => (
                <button
                  key={action}
                  type="button"
                  title={label}
                  aria-label={`${label} ${s.name}`}
                  disabled={disabled}
                  onClick={() => a.section(s.el, action)}
                  className={`grid h-6 w-6 place-items-center rounded-md transition-colors disabled:opacity-25 ${
                    isSel ? "hover:bg-background/15" : "hover:bg-background/60"
                  } ${action === "delete" ? "hover:text-red-400" : ""}`}
                >
                  <ActIcon size={12} />
                </button>
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ panel */

export function EditorInspector({
  sel,
  selKey,
  selectedEl,
  editingText,
  dirty,
  uploading,
  palette,
  sections,
  actions: a,
}: Props) {
  const [tab, setTab] = useState<"design" | "content" | "layers">("layers");
  const fromLayersRef = useRef(false);

  // Canvas selection jumps to Design; picking a row in Layers stays on Layers.
  useEffect(() => {
    if (!sel) return;
    if (fromLayersRef.current) {
      fromLayersRef.current = false;
      return;
    }
    setTab((t) => (t === "layers" ? "design" : t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);

  const actions: InspectorActions = {
    ...a,
    section: (el, action) => {
      if (action === "select") fromLayersRef.current = true;
      a.section(el, action);
    },
  };
  const KindIcon = sel ? KIND_ICON[sel.kind] : MousePointerClick;

  return (
    <TooltipProvider delayDuration={250}>
      <aside
        className="flex h-[78vh] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-border bg-card/60 shadow-[var(--glow)] backdrop-blur"
        aria-label="Element inspector"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-hairline px-4 pb-3 pt-4">
          {sel ? (
            <>
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-background/70">
                  <KindIcon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {editingText ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />{" "}
                        Editing text
                      </span>
                    ) : (
                      <>
                        {sel.kindLabel}
                        <span className="rounded bg-accent px-1 py-px font-mono text-[9px] normal-case tracking-normal">
                          {sel.tag}
                        </span>
                        {sel.hidden && <span className="text-amber-400">Hidden</span>}
                      </>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium" title={sel.label || sel.name}>
                    {sel.label || sel.name}
                  </p>
                </div>
                <IconAction label="Deselect (Esc)" onClick={a.deselect}>
                  <X size={14} />
                </IconAction>
              </div>
              <nav
                aria-label="Element path"
                className="mt-2.5 flex flex-wrap items-center gap-0.5 font-mono text-[10px]"
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
                        className={`rounded px-1 py-0.5 transition-colors ${up === 0 ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                      >
                        {tag}
                      </button>
                    </span>
                  );
                })}
              </nav>
              <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-background/50 p-0.5">
                <IconAction
                  label="Edit text (Enter)"
                  onClick={a.editText}
                  disabled={!sel.canEditText || editingText}
                >
                  <Pencil size={14} />
                </IconAction>
                <IconAction
                  label="Select parent"
                  onClick={() => a.selectAncestor(1)}
                  disabled={!sel.hasParent}
                >
                  <CornerLeftUp size={14} />
                </IconAction>
                <IconAction label="Duplicate (Ctrl+D)" onClick={a.duplicate}>
                  <Copy size={14} />
                </IconAction>
                <IconAction label="Move up" onClick={() => a.move("up")} disabled={!sel.canMoveUp}>
                  <ArrowUp size={14} />
                </IconAction>
                <IconAction
                  label="Move down"
                  onClick={() => a.move("down")}
                  disabled={!sel.canMoveDown}
                >
                  <ArrowDown size={14} />
                </IconAction>
                <IconAction
                  label={sel.hidden ? "Show element" : "Hide element"}
                  onClick={a.toggleHidden}
                  active={sel.hidden}
                >
                  {sel.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                </IconAction>
                <IconAction label="Delete (Del)" onClick={a.remove} danger>
                  <Trash2 size={14} />
                </IconAction>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-background/70">
                <MousePointerClick size={16} />
              </span>
              <div>
                <p className="text-sm font-medium">Nothing selected</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Click anything on the page, or pick a section below.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-4 mt-3 grid h-9 shrink-0 grid-cols-3 rounded-xl bg-background/60 p-1">
            <TabsTrigger
              value="design"
              disabled={!sel}
              className="gap-1.5 rounded-lg text-xs text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_0_0_1px_var(--border)]"
            >
              <Paintbrush size={13} /> Design
            </TabsTrigger>
            <TabsTrigger
              value="content"
              disabled={!sel}
              className="gap-1.5 rounded-lg text-xs text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_0_0_1px_var(--border)]"
            >
              <Type size={13} /> Content
            </TabsTrigger>
            <TabsTrigger
              value="layers"
              className="gap-1.5 rounded-lg text-xs text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_0_0_1px_var(--border)]"
            >
              <Layers size={13} /> Layers
            </TabsTrigger>
          </TabsList>
          <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {sel && (
              <TabsContent value="design" className="mt-0">
                <DesignTab key={selKey} sel={sel} palette={palette} a={actions} />
              </TabsContent>
            )}
            {sel && (
              <TabsContent value="content" className="mt-0">
                <ContentTab sel={sel} selKey={selKey} uploading={uploading} a={actions} />
              </TabsContent>
            )}
            <TabsContent value="layers" className="mt-0">
              <LayersTab sections={sections} selectedEl={selectedEl} a={actions} />
              {!sel && (
                <div className="mx-4 mb-4 mt-2 rounded-xl border border-dashed border-border p-3 text-[11px] leading-relaxed text-muted-foreground">
                  <p className="mb-1.5 font-medium text-foreground">Shortcuts</p>
                  <ul className="space-y-1">
                    <li>
                      <kbd className="font-mono">Enter</kbd> edit text ·{" "}
                      <kbd className="font-mono">Shift+Enter</kbd> new line
                    </li>
                    <li>
                      <kbd className="font-mono">Del</kbd> delete ·{" "}
                      <kbd className="font-mono">Ctrl+D</kbd> duplicate
                    </li>
                    <li>
                      <kbd className="font-mono">Ctrl+Z</kbd> undo ·{" "}
                      <kbd className="font-mono">Ctrl+Shift+Z</kbd> redo
                    </li>
                    <li>
                      <kbd className="font-mono">Esc</kbd> deselect
                    </li>
                  </ul>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="flex shrink-0 items-center gap-2 border-t border-hairline px-4 py-2.5 text-[11px]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${dirty ? "bg-amber-400" : "bg-emerald-400"}`}
          />
          <span className="text-muted-foreground">
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          {sel && (
            <button
              type="button"
              onClick={a.resetStyles}
              disabled={!sel.hasInlineEdits}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <RotateCcw size={12} /> Reset element
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
