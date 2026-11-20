/**
 * The default ("simple") editor panel: one column with two tabs.
 *  - Edit: what you clicked on the page — its text, size, color, link or image.
 *  - Theme: one-click site styles and the page font.
 * Everything else (layers, layout, motion, source) stays in the Advanced editor.
 */
import { useEffect, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowUpLeft,
  Bold,
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  Italic,
  Link2,
  Minus,
  MousePointerClick,
  Palette,
  PencilLine,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { ThemeModel } from "@/lib/api";
import { FONT_LIBRARY, type SelectionInfo } from "@/lib/editor-dom";
import { SiteStylePanel } from "@/components/dashboard/theme-models-panel";
import { ColorField, FIELD } from "./controls";

export type SimpleActions = {
  editText: () => void;
  setText: (text: string) => void;
  style: (props: Record<string, string>, key: string) => void;
  setFont: (family: string | null, scope: "element" | "page") => void;
  setLink: (href: string, newTab: boolean) => void;
  removeLink: () => void;
  replaceImage: () => void;
  replaceBackground: () => void;
  setAlt: (alt: string) => void;
  duplicate: () => void;
  toggleHidden: () => void;
  remove: () => void;
  selectParent: () => void;
  deselect: () => void;
  applyTheme: (id: string | null) => void;
};

type Tab = "edit" | "theme";

const SECTION = "space-y-2.5 border-b border-hairline px-4 py-4 last:border-b-0";
const LABEL = "text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
const BTN =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40";

export function SimplePanel({
  sel,
  selKey,
  editingText,
  palette,
  themeModels,
  themeId,
  themePending,
  themeError,
  disabled,
  actions: a,
}: {
  sel: SelectionInfo | null;
  selKey: number;
  editingText: boolean;
  palette: string[];
  themeModels: ThemeModel[];
  themeId: string | null;
  themePending: string | null | undefined;
  themeError: string;
  disabled: boolean;
  actions: SimpleActions;
}) {
  const [tab, setTab] = useState<Tab>("edit");
  // Clicking something on the page always brings its settings forward.
  useEffect(() => {
    if (sel) setTab("edit");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 gap-1 border-b border-hairline p-2" role="tablist">
        {(
          [
            ["edit", "Edit", PencilLine],
            ["theme", "Theme & fonts", Palette],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm transition-colors ${
              tab === id
                ? "bg-accent font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--border)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
        {tab === "edit" ? (
          <EditTab sel={sel} selKey={selKey} editingText={editingText} palette={palette} a={a} />
        ) : (
          <ThemeTab
            themeModels={themeModels}
            themeId={themeId}
            themePending={themePending}
            themeError={themeError}
            disabled={disabled}
            a={a}
          />
        )}
      </div>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="p-4">
      <div className="rounded-2xl border border-dashed border-border p-5">
        <MousePointerClick size={22} className="text-emerald-400" />
        <p className="mt-3 text-base font-semibold">Click any text on the page to edit it</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Then just type. It saves with one click.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>
            <b className="text-foreground">Text</b>: click it once and type your own words.
          </li>
          <li>
            <b className="text-foreground">Images</b>: click one, then “Replace image”.
          </li>
          <li>
            <b className="text-foreground">Buttons &amp; links</b>: click to change the label or
            where it goes.
          </li>
          <li>
            <b className="text-foreground">Colors &amp; fonts</b>: open “Theme &amp; fonts” to
            restyle the whole site.
          </li>
        </ul>
      </div>
    </div>
  );
}

function EditTab({
  sel,
  selKey,
  editingText,
  palette,
  a,
}: {
  sel: SelectionInfo | null;
  selKey: number;
  editingText: boolean;
  palette: string[];
  a: SimpleActions;
}) {
  if (!sel) return <EmptyHint />;
  const isText = sel.canEditText;
  const isLinkish = sel.kind === "link" || sel.kind === "button" || sel.href !== null;
  const showBackground =
    !sel.isImage &&
    !sel.isSvg &&
    (sel.kind === "section" || sel.kind === "container" || sel.kind === "button");

  return (
    <div>
      <div className="flex items-start gap-2 border-b border-hairline px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className={LABEL}>{sel.kindLabel}</p>
          <p className="truncate text-sm font-semibold">{sel.name}</p>
        </div>
        {sel.hasParent && (
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={a.selectParent}
            title="Select the block around this element"
          >
            <ArrowUpLeft size={13} /> Select block
          </button>
        )}
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={a.deselect}
          aria-label="Close"
        >
          <X size={15} />
        </button>
      </div>

      {editingText && (
        <div className="mx-4 mt-4 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm">
          <p className="font-medium">You're editing this text</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Type directly on the page. Click outside it or press Esc when you're done.
          </p>
          <button
            type="button"
            className="mt-2 inline-flex h-8 items-center rounded-lg bg-emerald-400 px-3 text-xs font-semibold text-black hover:bg-emerald-300"
            onClick={a.deselect}
          >
            Done
          </button>
        </div>
      )}

      {isText && (
        <TextSection
          key={`text-${selKey}`}
          sel={sel}
          editingText={editingText}
          palette={palette}
          a={a}
        />
      )}
      {isLinkish && <LinkSection key={`link-${selKey}`} sel={sel} a={a} />}
      {sel.isImage && <ImageSection key={`img-${selKey}`} sel={sel} a={a} />}
      {showBackground && (
        <div className={SECTION}>
          <p className={LABEL}>Background</p>
          <ColorField
            value={sel.backgroundColor}
            none={sel.backgroundTransparent}
            palette={palette}
            label="Background color"
            onChange={(hex) =>
              a.style(
                sel.hasBackgroundImage
                  ? { "background-color": hex }
                  : { "background-color": hex, "background-image": "none" },
                "background",
              )
            }
            onNone={() => a.style({ "background-color": "transparent" }, "background")}
          />
          {sel.hasBackgroundImage && (
            <button type="button" className={`${BTN} w-full`} onClick={a.replaceBackground}>
              <ImagePlus size={14} /> Replace background image
            </button>
          )}
        </div>
      )}

      <div className={SECTION}>
        <p className={LABEL}>Element</p>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className={BTN} onClick={a.duplicate}>
            <Copy size={14} /> Duplicate
          </button>
          <button type="button" className={BTN} onClick={a.toggleHidden}>
            {sel.hidden ? <Eye size={14} /> : <EyeOff size={14} />} {sel.hidden ? "Show" : "Hide"}
          </button>
          <button
            type="button"
            className={`${BTN} text-red-400 hover:bg-red-500/10`}
            onClick={a.remove}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function TextSection({
  sel,
  editingText,
  palette,
  a,
}: {
  sel: SelectionInfo;
  editingText: boolean;
  palette: string[];
  a: SimpleActions;
}) {
  const [draft, setDraft] = useState(sel.plainText ?? "");
  // Only text typed in this box is written back; edits made on the page refresh the box.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setDraft(sel.plainText ?? "");
  }, [sel.plainText, touched]);
  const size = Math.round(sel.fontSize);
  const setSize = (n: number) =>
    a.style({ "font-size": `${Math.min(200, Math.max(8, Math.round(n)))}px` }, "font-size");
  const known = FONT_LIBRARY.some((g) => g.families.includes(sel.fontFamily));
  const commitDraft = () => {
    if (!touched) return;
    setTouched(false);
    if (sel.plainText !== null && draft !== sel.plainText && draft.trim()) a.setText(draft);
  };

  return (
    <div className={SECTION}>
      <p className={LABEL}>Text</p>
      {sel.plainText !== null && !editingText ? (
        <textarea
          value={draft}
          rows={Math.min(6, Math.max(2, Math.ceil(draft.length / 34)))}
          onChange={(e) => {
            setTouched(true);
            setDraft(e.target.value);
          }}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitDraft();
            }
          }}
          aria-label="Text"
          className="w-full resize-y rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-foreground/40"
        />
      ) : (
        !editingText && (
          <button type="button" className={`${BTN} w-full`} onClick={a.editText}>
            <PencilLine size={14} /> Edit text on the page
          </button>
        )
      )}

      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 pt-1">
        <span className="text-xs text-muted-foreground">Size</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent"
            onClick={() => setSize(size - 2)}
            aria-label="Smaller text"
          >
            <Minus size={14} />
          </button>
          <span className="h-9 min-w-[64px] flex-1 rounded-lg border border-border text-center text-sm leading-9 tabular-nums">
            {size}px
          </span>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent"
            onClick={() => setSize(size + 2)}
            aria-label="Bigger text"
          >
            <Plus size={14} />
          </button>
        </div>

        <span className="text-xs text-muted-foreground">Color</span>
        <ColorField
          value={sel.color}
          palette={palette}
          label="Text color"
          onChange={(hex) => a.style({ color: hex }, "color")}
        />

        <span className="text-xs text-muted-foreground">Style</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-pressed={sel.bold}
            aria-label="Bold"
            className={`grid h-9 w-9 place-items-center rounded-lg border border-border ${sel.bold ? "bg-foreground text-background" : "hover:bg-accent"}`}
            onClick={() => a.style({ "font-weight": sel.bold ? "400" : "700" }, "bold")}
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            aria-pressed={sel.italic}
            aria-label="Italic"
            className={`grid h-9 w-9 place-items-center rounded-lg border border-border ${sel.italic ? "bg-foreground text-background" : "hover:bg-accent"}`}
            onClick={() => a.style({ "font-style": sel.italic ? "normal" : "italic" }, "italic")}
          >
            <Italic size={14} />
          </button>
          <span className="mx-1 w-px self-stretch bg-border" />
          {(
            [
              ["left", AlignLeft],
              ["center", AlignCenter],
              ["right", AlignRight],
            ] as const
          ).map(([v, Icon]) => (
            <button
              key={v}
              type="button"
              aria-pressed={sel.textAlign === v}
              aria-label={`Align ${v}`}
              className={`grid h-9 w-9 place-items-center rounded-lg border border-border ${sel.textAlign === v ? "bg-foreground text-background" : "hover:bg-accent"}`}
              onClick={() => a.style({ "text-align": v }, "align")}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>

        <span className="text-xs text-muted-foreground">Font</span>
        <select
          className={`${FIELD} h-9 cursor-pointer`}
          value={known ? sel.fontFamily : "__original__"}
          onChange={(e) =>
            a.setFont(e.target.value === "__original__" ? null : e.target.value, "element")
          }
          aria-label="Font"
        >
          <option value="__original__">Original font</option>
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
      </div>
    </div>
  );
}

function LinkSection({ sel, a }: { sel: SelectionInfo; a: SimpleActions }) {
  const [href, setHref] = useState(sel.href ?? "");
  const [newTab, setNewTab] = useState(sel.linkNewTab);
  return (
    <div className={SECTION}>
      <p className={LABEL}>Link</p>
      <input
        value={href}
        onChange={(e) => setHref(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && a.setLink(href, newTab)}
        placeholder="https://… or /page"
        aria-label="Link address"
        className={`${FIELD} h-9 text-sm`}
      />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={newTab} onChange={(e) => setNewTab(e.target.checked)} />
        Open in a new tab
      </label>
      <div className="flex gap-2">
        <button type="button" className={`${BTN} flex-1`} onClick={() => a.setLink(href, newTab)}>
          <Link2 size={14} /> Save link
        </button>
        {sel.href !== null && (
          <button type="button" className={BTN} onClick={a.removeLink}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function ImageSection({ sel, a }: { sel: SelectionInfo; a: SimpleActions }) {
  const [alt, setAlt] = useState(sel.alt);
  return (
    <div className={SECTION}>
      <p className={LABEL}>Image</p>
      {sel.imageSrc && (
        <img
          src={sel.imageSrc}
          alt=""
          className="max-h-40 w-full rounded-lg border border-border bg-[repeating-conic-gradient(#222_0_25%,#2a2a2a_0_50%)] bg-[length:12px_12px] object-contain"
        />
      )}
      <button
        type="button"
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 text-sm font-semibold text-black transition-colors hover:bg-emerald-300"
        onClick={a.replaceImage}
      >
        <ImagePlus size={16} /> Replace image
      </button>
      <input
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
        onBlur={() => a.setAlt(alt)}
        placeholder="Describe the image (for SEO & accessibility)"
        aria-label="Image description"
        className={`${FIELD} h-9`}
      />
    </div>
  );
}

function ThemeTab({
  themeModels,
  themeId,
  themePending,
  themeError,
  disabled,
  a,
}: {
  themeModels: ThemeModel[];
  themeId: string | null;
  themePending: string | null | undefined;
  themeError: string;
  disabled: boolean;
  a: SimpleActions;
}) {
  const [font, setFont] = useState("");
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl border border-border p-4">
        <p className="text-sm font-semibold">Page font</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          One font for every heading, paragraph and button on this page.
        </p>
        <div className="mt-3 flex gap-2">
          <select
            className={`${FIELD} h-9 cursor-pointer`}
            value={font}
            onChange={(e) => setFont(e.target.value)}
            aria-label="Page font"
            disabled={disabled}
          >
            <option value="">Choose a font…</option>
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
          <button
            type="button"
            className={BTN}
            disabled={!font || disabled}
            onClick={() => font && a.setFont(font, "page")}
          >
            Apply
          </button>
        </div>
      </div>
      <SiteStylePanel
        models={themeModels}
        activeId={themeId}
        pendingId={themePending}
        disabled={disabled}
        loadError={themeError}
        onApply={a.applyTheme}
      />
    </div>
  );
}
