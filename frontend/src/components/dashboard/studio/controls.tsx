/** Shared inspector controls for the Studio editor. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Type = LucideIcon;

export const FIELD =
  "h-8 w-full rounded-lg border border-border bg-background/60 px-2.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-foreground/40 focus:bg-background";

export function IconAction({
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

/** Toolbar action with a visible label (no hovering needed to know what it does). */
export function ToolButton({
  icon: Icon,
  label,
  hint,
  onClick,
  disabled,
  active,
  danger,
}: {
  icon: Type;
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      aria-label={hint}
      aria-pressed={active}
      className={`flex h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-30 ${
        active
          ? "bg-foreground text-background"
          : danger
            ? "text-red-400 hover:bg-red-500/10"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

export function Group({
  title,
  icon: Icon,
  children,
  aside,
  defaultOpen = true,
}: {
  title: string;
  icon: Type;
  children: ReactNode;
  aside?: ReactNode;
  defaultOpen?: boolean;
}) {
  // Remember open/closed per section across selections and reloads.
  const storageKey = `clonyfy.inspector.group.${title}`;
  const [open, setOpen] = useState(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved === null ? defaultOpen : saved === "1";
    } catch {
      return defaultOpen;
    }
  });
  const toggle = () =>
    setOpen((v) => {
      try {
        window.localStorage.setItem(storageKey, v ? "0" : "1");
      } catch {
        /* storage unavailable — still toggles */
      }
      return !v;
    });
  return (
    <section className="border-b border-hairline last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={toggle}
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

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function NumberField({
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

export function SliderField({
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

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: Type }>;
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
export function normalizeHex(v: string) {
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

export function ColorField({
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

export function TextButton({
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
