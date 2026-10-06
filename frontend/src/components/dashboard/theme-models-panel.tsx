import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, Palette, RotateCcw } from "lucide-react";
import type { ThemeModel } from "@/lib/api";

const ALL = "All";

function Swatches({ model }: { model: ThemeModel }) {
  const { bg, surface, accent, accent2, text } = model.colors;
  return (
    <span
      className="relative block h-12 w-full overflow-hidden rounded-lg border border-black/10"
      style={{ background: bg }}
      aria-hidden
    >
      <span
        className="absolute inset-x-2 top-2 h-3 rounded"
        style={{ background: surface, boxShadow: `inset 0 0 0 1px ${model.colors.border}` }}
      />
      <span className="absolute bottom-2 left-2 h-1.5 w-8 rounded-full" style={{ background: text }} />
      <span className="absolute bottom-2 right-7 h-3 w-4 rounded" style={{ background: accent2 }} />
      <span className="absolute bottom-2 right-2 h-3 w-4 rounded" style={{ background: accent }} />
    </span>
  );
}

export function SiteStylePanel({
  models,
  activeId,
  pendingId,
  disabled,
  loadError,
  onApply,
}: {
  models: ThemeModel[];
  activeId: string | null;
  /** id being applied (null = resetting to original), undefined when idle */
  pendingId: string | null | undefined;
  disabled: boolean;
  loadError: string;
  onApply: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(true);
  const [group, setGroup] = useState(ALL);

  const groups = useMemo(() => {
    const seen: string[] = [];
    for (const m of models) if (!seen.includes(m.group)) seen.push(m.group);
    return [ALL, ...seen];
  }, [models]);

  const visible = group === ALL ? models : models.filter((m) => m.group === group);
  const active = models.find((m) => m.id === activeId) || null;
  const busy = pendingId !== undefined;

  return (
    <section className="rounded-2xl border border-border p-4" aria-label="Site style models">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <Palette size={16} />
          Site style
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <span className="text-xs text-muted-foreground">
          {active ? `${active.name} (${active.group})` : "Original"} · one click restyles every page
          of this clone (editor, ZIP, Figma, GitHub).
        </span>
        <button
          type="button"
          className={`ml-auto inline-flex items-center gap-1.5 rounded-xl border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40 ${activeId === null ? "bg-primary text-primary-foreground hover:bg-primary" : ""}`}
          onClick={() => onApply(null)}
          disabled={disabled || busy || activeId === null}
          title="Restore the original site style"
        >
          {pendingId === null ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          Original
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          {loadError ? (
            <p className="text-xs text-red-500">{loadError}</p>
          ) : !models.length ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Loading style models…
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Style groups">
                {groups.map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="tab"
                    aria-selected={group === g}
                    className={`rounded-full border border-border px-3 py-1 text-xs transition-colors ${group === g ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                    onClick={() => setGroup(g)}
                  >
                    {g}
                    {g !== ALL && (
                      <span className="ml-1 opacity-60">
                        {models.filter((m) => m.group === g).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
                {visible.map((m) => {
                  const isActive = m.id === activeId;
                  const isPending = pendingId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`group relative flex flex-col gap-1.5 rounded-xl border p-1.5 text-left transition-colors disabled:pointer-events-none disabled:opacity-50 ${isActive ? "border-primary ring-2 ring-primary/40" : "border-border hover:bg-accent"}`}
                      onClick={() => onApply(m.id)}
                      disabled={disabled || busy || isActive}
                      aria-pressed={isActive}
                      title={`${m.name}: ${m.fonts.heading} / ${m.fonts.body}`}
                    >
                      <Swatches model={m} />
                      <span className="flex items-center justify-between gap-1 px-0.5 text-xs">
                        <span className="truncate font-medium">{m.name}</span>
                        {isPending ? (
                          <Loader2 size={12} className="shrink-0 animate-spin" />
                        ) : isActive ? (
                          <Check size={12} className="shrink-0 text-primary" />
                        ) : null}
                      </span>
                      {group === ALL && (
                        <span className="-mt-1 px-0.5 text-[10px] text-muted-foreground">{m.group}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
