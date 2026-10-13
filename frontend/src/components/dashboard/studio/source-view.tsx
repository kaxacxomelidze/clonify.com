import { useEffect, useMemo, useState } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import { TextButton } from "./controls";

/** HTML source of the selection (or the whole page), editable in place. */
export function SourceView({
  getSource,
  canSelection,
  version,
  onApply,
}: {
  getSource: (scope: "selection" | "page") => string;
  canSelection: boolean;
  version: number;
  onApply: (scope: "selection" | "page", html: string) => void;
}) {
  const [scope, setScope] = useState<"selection" | "page">(canSelection ? "selection" : "page");
  const original = useMemo(() => getSource(scope), [getSource, scope, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [draft, setDraft] = useState(original);
  const [copied, setCopied] = useState(false);
  useEffect(() => setDraft(original), [original]);
  useEffect(() => {
    if (!canSelection && scope === "selection") setScope("page");
  }, [canSelection, scope]);
  const lines = draft.split("\n").length;
  const changed = draft !== original;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0d1117] text-[#e6edf3]">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex rounded-lg border border-white/10 p-0.5 text-[11px]">
          {(["selection", "page"] as const).map((s) => (
            <button
              key={s}
              type="button"
              disabled={s === "selection" && !canSelection}
              onClick={() => setScope(s)}
              className={`rounded-md px-2.5 py-1 disabled:opacity-30 ${scope === s ? "bg-white/15" : "text-white/60 hover:text-white"}`}
            >
              {s === "selection" ? "Selected element" : "Whole page"}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-white/45">
          {lines.toLocaleString()} lines · {(draft.length / 1024).toFixed(1)} KB
        </span>
        <div className="ml-auto flex gap-1.5">
          <TextButton
            onClick={() => {
              void navigator.clipboard?.writeText(draft).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              });
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />} Copy
          </TextButton>
          <TextButton onClick={() => setDraft(original)} disabled={!changed}>
            <RotateCcw size={13} /> Revert
          </TextButton>
          <button
            type="button"
            disabled={!changed}
            onClick={() => onApply(scope, draft)}
            className="h-8 rounded-lg bg-emerald-400 px-3 text-xs font-semibold text-black disabled:opacity-30"
          >
            Apply changes
          </button>
        </div>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-[12px] leading-[1.55] text-[#e6edf3] outline-none"
        aria-label="HTML source"
      />
    </div>
  );
}
