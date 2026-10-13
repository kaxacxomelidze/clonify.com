import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ArrowRight,
  Bell,
  Bookmark,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Cloud,
  Code,
  Compass,
  CreditCard,
  Download,
  EyeOff,
  Globe,
  Heart,
  Home,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  Lightbulb,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Play,
  Plus,
  Rocket,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  User,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { elementKind, friendlyName, isSelectable, type PageSection } from "@/lib/editor-dom";
import { ATTR_LOCK, ATTR_NAME, STUDIO_STYLE_ID } from "@/lib/studio/engine";
import {
  ELEMENTS,
  GRAPHICS,
  SECTIONS,
  generateGraphic,
  type GraphicKind,
} from "@/lib/studio/blocks";
import {
  listAssets,
  listLibrary,
  removeAsset,
  removeLibraryItem,
  type LibraryItem,
} from "@/lib/studio/library";
import { FIELD, TextButton } from "./controls";

export const BLOCK_MIME = "application/x-clonyfy-block";

export type DropZone = "before" | "after" | "inside";

export type LeftActions = {
  select: (el: HTMLElement) => void;
  moveLayer: (el: HTMLElement, target: HTMLElement, zone: DropZone) => void;
  insertBlock: (html: string, asSection: boolean) => void;
  insertLibrary: (item: LibraryItem) => void;
  uploadAsset: () => void;
  useAsset: (src: string, mode: "image" | "background") => void;
  insertSvg: (svg: string) => void;
};

type Tab = "layers" | "add" | "library" | "assets";

const ICONS: Array<[string, LucideIcon]> = [
  ["Arrow", ArrowRight],
  ["Bell", Bell],
  ["Bookmark", Bookmark],
  ["Calendar", Calendar],
  ["Check", Check],
  ["Clock", Clock],
  ["Cloud", Cloud],
  ["Code", Code],
  ["Compass", Compass],
  ["Card", CreditCard],
  ["Download", Download],
  ["Globe", Globe],
  ["Heart", Heart],
  ["Home", Home],
  ["Idea", Lightbulb],
  ["Lock", Lock],
  ["Mail", Mail],
  ["Pin", MapPin],
  ["Chat", MessageCircle],
  ["Phone", Phone],
  ["Play", Play],
  ["Rocket", Rocket],
  ["Search", Search],
  ["Settings", Settings],
  ["Shield", Shield],
  ["Cart", ShoppingCart],
  ["Sparkles", Sparkles],
  ["Star", Star],
  ["Growth", TrendingUp],
  ["User", User],
  ["Team", Users],
  ["Zap", Zap],
];

/* ----------------------------------------------------------------- layers */

function layerChildren(el: Element): HTMLElement[] {
  return Array.from(el.children).filter(
    (c) =>
      isSelectable(c) &&
      c.id !== STUDIO_STYLE_ID &&
      !c.matches("script,style,link,meta,noscript,template"),
  ) as HTMLElement[];
}

function layerLabel(el: HTMLElement) {
  const custom = el.getAttribute(ATTR_NAME);
  if (custom) return custom;
  const kind = elementKind(el);
  if (["heading", "text", "link", "button"].includes(kind)) {
    const t = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 32);
    const label = { heading: "Heading", text: "Text", link: "Link", button: "Button" }[
      kind as "heading"
    ];
    return t ? `${label} · ${t}` : label;
  }
  if (kind === "image")
    return `Image${el.getAttribute("alt") ? ` · ${el.getAttribute("alt")!.slice(0, 24)}` : ""}`;
  return friendlyName(el);
}

function LayerRow({
  el,
  depth,
  selected,
  expanded,
  toggle,
  actions,
  dragRef,
  version,
}: {
  el: HTMLElement;
  depth: number;
  selected: HTMLElement | null;
  expanded: WeakSet<Element>;
  toggle: (el: Element) => void;
  actions: LeftActions;
  dragRef: React.MutableRefObject<HTMLElement | null>;
  version: number;
}) {
  const [zone, setZone] = useState<DropZone | null>(null);
  const kids = layerChildren(el);
  const open = expanded.has(el);
  const isSel = selected === el;
  const hidden = el.ownerDocument.defaultView?.getComputedStyle(el).display === "none";
  const locked = el.hasAttribute(ATTR_LOCK);
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isSel) rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [isSel]);

  const onDragOver = (e: DragEvent) => {
    const src = dragRef.current;
    if (!src || src === el || src.contains(el)) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    setZone(
      y < 0.28
        ? "before"
        : y > 0.72
          ? "after"
          : kids.length || !["heading", "text", "link", "button", "image"].includes(elementKind(el))
            ? "inside"
            : "after",
    );
  };
  return (
    <>
      <div
        ref={rowRef}
        draggable={!locked}
        onDragStart={(e) => {
          dragRef.current = el;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", "layer");
        }}
        onDragEnd={() => {
          dragRef.current = null;
          setZone(null);
        }}
        onDragOver={onDragOver}
        onDragLeave={() => setZone(null)}
        onDrop={(e) => {
          e.preventDefault();
          const src = dragRef.current;
          if (src && zone && src !== el && !src.contains(el)) actions.moveLayer(src, el, zone);
          setZone(null);
          dragRef.current = null;
        }}
        onClick={() => actions.select(el)}
        className={`group relative flex h-7 cursor-pointer items-center gap-1 rounded-md pr-2 text-[12px] transition-colors ${
          isSel
            ? "bg-emerald-400/15 text-foreground ring-1 ring-emerald-400/50"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        } ${zone === "inside" ? "bg-emerald-400/10 ring-1 ring-emerald-400" : ""} ${hidden ? "opacity-45" : ""}`}
        style={{ paddingLeft: 6 + depth * 12 }}
        data-version={version}
      >
        {zone === "before" && (
          <span className="pointer-events-none absolute inset-x-1 top-0 h-0.5 rounded bg-emerald-400" />
        )}
        {zone === "after" && (
          <span className="pointer-events-none absolute inset-x-1 bottom-0 h-0.5 rounded bg-emerald-400" />
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggle(el);
          }}
          className={`grid h-4 w-4 shrink-0 place-items-center rounded ${kids.length ? "hover:bg-accent" : "invisible"}`}
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
        <span className="shrink-0 text-[10px] opacity-60">
          {["heading", "text", "link", "button"].includes(elementKind(el))
            ? "T"
            : elementKind(el) === "image"
              ? "▣"
              : "◇"}
        </span>
        <span className="truncate">{layerLabel(el)}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {locked && <Lock size={10} className="text-amber-400" />}
          {hidden && <EyeOff size={10} />}
        </span>
      </div>
      {open &&
        kids
          .slice(0, 200)
          .map((c, i) => (
            <LayerRow
              key={i}
              el={c}
              depth={depth + 1}
              selected={selected}
              expanded={expanded}
              toggle={toggle}
              actions={actions}
              dragRef={dragRef}
              version={version}
            />
          ))}
    </>
  );
}

function LayersTab({
  doc,
  sections,
  selected,
  version,
  actions,
}: {
  doc: Document | null;
  sections: PageSection[];
  selected: HTMLElement | null;
  version: number;
  actions: LeftActions;
}) {
  const expandedRef = useRef(new WeakSet<Element>());
  const [, force] = useState(0);
  const [query, setQuery] = useState("");
  const dragRef = useRef<HTMLElement | null>(null);

  // Reveal the selection: expand every ancestor.
  useEffect(() => {
    if (!selected) return;
    for (let p = selected.parentElement; p && p.tagName !== "HTML"; p = p.parentElement)
      expandedRef.current.add(p);
    force((n) => n + 1);
  }, [selected]);

  const toggle = (el: Element) => {
    if (expandedRef.current.has(el)) expandedRef.current.delete(el);
    else expandedRef.current.add(el);
    force((n) => n + 1);
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !doc?.body) return null;
    const out: HTMLElement[] = [];
    for (const el of Array.from(doc.body.querySelectorAll<HTMLElement>("*"))) {
      if (!isSelectable(el) || el.id === STUDIO_STYLE_ID) continue;
      if (layerLabel(el).toLowerCase().includes(q) || el.tagName.toLowerCase() === q) out.push(el);
      if (out.length >= 150) break;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, doc, version]);

  if (!doc?.body) return <p className="p-4 text-xs text-muted-foreground">Loading layers…</p>;
  if (doc.body) expandedRef.current.add(doc.body);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 p-3">
        <select
          className={`${FIELD} cursor-pointer`}
          value=""
          onChange={(e) => {
            const s = sections[Number(e.target.value)];
            if (s) actions.select(s.el);
          }}
          aria-label="Jump to section"
        >
          <option value="">Jump to section…</option>
          {sections.map((s, i) => (
            <option key={i} value={i}>
              {String(i + 1).padStart(2, "0")} · {s.name}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search
            size={12}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a layer…"
            className={`${FIELD} pl-7`}
            aria-label="Find a layer"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        {matches ? (
          matches.length ? (
            matches.map((el, i) => (
              <button
                key={i}
                type="button"
                onClick={() => actions.select(el)}
                className={`flex h-7 w-full items-center gap-2 truncate rounded-md px-2 text-left text-[12px] ${selected === el ? "bg-emerald-400/15 text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}
              >
                <span className="font-mono text-[10px] opacity-60">{el.tagName.toLowerCase()}</span>
                <span className="truncate">{layerLabel(el)}</span>
              </button>
            ))
          ) : (
            <p className="p-2 text-xs text-muted-foreground">No layers match “{query}”.</p>
          )
        ) : (
          <>
            <p className="px-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Page
            </p>
            {layerChildren(doc.body).map((el, i) => (
              <LayerRow
                key={i}
                el={el}
                depth={0}
                selected={selected}
                expanded={expandedRef.current}
                toggle={toggle}
                actions={actions}
                dragRef={dragRef}
                version={version}
              />
            ))}
          </>
        )}
      </div>
      <p className="border-t border-hairline px-3 py-2 text-[10px] text-muted-foreground">
        Drag layers to reorder · drop on the middle of a row to nest
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- add */

function AddTab({ actions }: { actions: LeftActions }) {
  const drag = (html: string, section: boolean) => (e: DragEvent) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData(BLOCK_MIME, JSON.stringify({ html, section }));
    // Readable during dragover (data is not): lets the canvas snap to whole sections.
    if (section) e.dataTransfer.setData("text/x-clonyfy-section", "1");
    e.dataTransfer.setData("text/plain", "block");
  };
  return (
    <div className="space-y-4 overflow-y-auto p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Drag onto canvas or click to insert
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {ELEMENTS.map((b) => (
          <button
            key={b.id}
            type="button"
            draggable
            onDragStart={drag(b.html, false)}
            onClick={() => actions.insertBlock(b.html, false)}
            className="flex h-16 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-background/40 text-[11px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <span className="text-base leading-none">{b.icon}</span>
            {b.name}
          </button>
        ))}
      </div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Ready-made sections
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {SECTIONS.map((b) => (
          <button
            key={b.id}
            type="button"
            draggable
            onDragStart={drag(b.html, true)}
            onClick={() => actions.insertBlock(b.html, true)}
            className="flex h-12 items-center gap-2 rounded-lg border border-border bg-background/40 px-3 text-left text-[12px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent text-xs">
              {b.icon}
            </span>
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- library */

function LibraryTab({ actions, version }: { actions: LeftActions; version: number }) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  useEffect(() => setItems(listLibrary()), [version]);
  return (
    <div className="space-y-3 overflow-y-auto p-3">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Select any section or component and choose{" "}
        <span className="text-foreground">Save to library</span> in the inspector. Insert copies
        anywhere — designs and animations come with them.
      </p>
      {!items.length && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-[11px] text-muted-foreground">
          <Bookmark size={18} className="mx-auto mb-2" />
          Your reusable pieces live here.
        </div>
      )}
      {items.map((item) => (
        <div
          key={item.id}
          className="group flex items-center gap-2 rounded-lg border border-border bg-background/40 p-2"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent">
            <Layers size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium">{item.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {item.kind} · {new Date(item.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button
            type="button"
            onClick={() => actions.insertLibrary(item)}
            className="rounded-md px-2 py-1 text-[11px] hover:bg-accent"
            title="Insert copy"
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            onClick={() => {
              removeLibraryItem(item.id);
              setItems(listLibrary());
            }}
            className="rounded-md px-2 py-1 text-[11px] text-red-400 opacity-0 hover:bg-red-500/10 group-hover:opacity-100"
            title="Remove from library"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- assets */

function AssetsTab({
  actions,
  outDir,
  version,
  uploading,
}: {
  actions: LeftActions;
  outDir: string;
  version: number;
  uploading: boolean;
}) {
  const [assets, setAssets] = useState(() => listAssets(outDir));
  const [iconColor, setIconColor] = useState("#111111");
  const [kind, setKind] = useState<GraphicKind>("orbital");
  const [primary, setPrimary] = useState("#0f2a22");
  const [accent, setAccent] = useState("#8fe3b0");
  const [seed, setSeed] = useState(7);
  useEffect(() => setAssets(listAssets(outDir)), [outDir, version]);
  const graphic = useMemo(
    () => generateGraphic(kind, primary, accent, seed),
    [kind, primary, accent, seed],
  );
  const iconSvg = (Icon: LucideIcon) =>
    renderToStaticMarkup(<Icon size={32} color={iconColor} strokeWidth={1.8} />).replace(
      "<svg",
      '<svg style="display:inline-block;vertical-align:middle"',
    );

  return (
    <div className="space-y-5 overflow-y-auto p-3">
      <section className="space-y-2">
        <TextButton onClick={actions.uploadAsset} disabled={uploading}>
          <ImagePlus size={13} /> {uploading ? "Uploading…" : "Upload images"}
        </TextButton>
        <p className="text-[10px] text-muted-foreground">
          Click an image to replace the selected image, or insert it. Right side: use as background.
        </p>
        {assets.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {assets.map((a) => (
              <div
                key={a.src}
                className="group relative overflow-hidden rounded-lg border border-border"
              >
                <button
                  type="button"
                  onClick={() => actions.useAsset(a.src, "image")}
                  title={`Use ${a.name}`}
                  className="block aspect-square w-full bg-[repeating-conic-gradient(#2a2a2a_0_25%,#202020_0_50%)] bg-[length:10px_10px]"
                >
                  <img src={a.src} alt={a.name} className="h-full w-full object-cover" />
                </button>
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => actions.useAsset(a.src, "background")}
                    className="px-1 text-[9px] text-white"
                    title="Use as background"
                  >
                    BG
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      removeAsset(outDir, a.src);
                      setAssets(listAssets(outDir));
                    }}
                    className="px-1 text-[9px] text-red-300"
                    title="Remove from list"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Uploaded assets · {assets.length}
        </p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold">Icon collection</p>
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            Color
            <input
              type="color"
              value={iconColor}
              onChange={(e) => setIconColor(e.target.value)}
              className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
              aria-label="Icon color"
            />
          </label>
        </div>
        <div className="grid grid-cols-8 gap-1">
          {ICONS.map(([name, Icon]) => (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => actions.insertSvg(iconSvg(Icon))}
              className="grid aspect-square place-items-center rounded-md border border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-[12px] font-semibold">Graphics studio</p>
        <p className="text-[10px] text-muted-foreground">
          Generate editable SVG artwork from colors and a seed.
        </p>
        <select
          className={`${FIELD} cursor-pointer`}
          value={kind}
          onChange={(e) => setKind(e.target.value as GraphicKind)}
          aria-label="Composition"
        >
          {GRAPHICS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <div
          className="overflow-hidden rounded-lg border border-border"
          style={{ aspectRatio: "3 / 2" }}
          dangerouslySetInnerHTML={{
            __html: graphic.replace("<svg", '<svg width="100%" height="100%"'),
          }}
        />
        <div className="grid grid-cols-3 gap-1.5 text-[10px] text-muted-foreground">
          <label className="flex items-center gap-1">
            Primary
            <input
              type="color"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
          <label className="flex items-center gap-1">
            Accent
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="rounded-md border border-border hover:bg-accent"
          >
            ↻ Seed {seed}
          </button>
        </div>
        <div className="flex gap-1.5">
          <TextButton
            onClick={() =>
              actions.insertSvg(
                graphic.replace(
                  "<svg",
                  '<svg style="display:block;width:100%;max-width:960px;height:auto;border-radius:16px"',
                ),
              )
            }
          >
            <Plus size={13} /> Insert
          </TextButton>
          <TextButton
            onClick={() =>
              actions.useAsset(
                "data:image/svg+xml;utf8," + encodeURIComponent(graphic),
                "background",
              )
            }
          >
            <ImageIcon size={13} /> Use as background
          </TextButton>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ panel */

export function StudioLeftPanel({
  doc,
  sections,
  selected,
  version,
  outDir,
  uploading,
  actions,
}: {
  doc: Document | null;
  sections: PageSection[];
  selected: HTMLElement | null;
  version: number;
  outDir: string;
  uploading: boolean;
  actions: LeftActions;
}) {
  const [tab, setTab] = useState<Tab>("layers");
  return (
    <aside className="flex h-full min-h-0 flex-col bg-card/40" aria-label="Workspace">
      <div className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-3">
        <p className="text-sm font-semibold">Workspace</p>
        <span className="text-[10px] text-muted-foreground">{sections.length} sections</span>
      </div>
      <div className="grid shrink-0 grid-cols-4 gap-1 border-b border-hairline p-2">
        {(
          [
            ["layers", "Layers", Layers],
            ["add", "Add", Plus],
            ["library", "Library", Bookmark],
            ["assets", "Assets", ImageIcon],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex h-8 items-center justify-center gap-1 rounded-lg text-[11px] transition-colors ${
              tab === id
                ? "bg-accent text-foreground shadow-[inset_0_0_0_1px_var(--border)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "layers" && (
          <LayersTab
            doc={doc}
            sections={sections}
            selected={selected}
            version={version}
            actions={actions}
          />
        )}
        {tab === "add" && (
          <div className="h-full overflow-y-auto">
            <AddTab actions={actions} />
          </div>
        )}
        {tab === "library" && (
          <div className="h-full overflow-y-auto">
            <LibraryTab actions={actions} version={version} />
          </div>
        )}
        {tab === "assets" && (
          <div className="h-full overflow-y-auto">
            <AssetsTab actions={actions} outDir={outDir} version={version} uploading={uploading} />
          </div>
        )}
      </div>
    </aside>
  );
}
