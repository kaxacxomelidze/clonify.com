import { Check } from "lucide-react";

export const ONBOARDING_STEPS = ["Paste a website", "Rebuild it", "Customize it", "Export it"];

/**
 * "In a few steps, you will have this:" — the guided onboarding's progress, as in the
 * reference: finished steps fade out above, the current step is large and bold, the next
 * ones wait below. Vertical at the side on large screens.
 */
export function StepRail({ current }: { current: number }) {
  return (
    <nav aria-label="Onboarding steps" className="select-none">
      <p className="text-sm text-muted-foreground">In a few steps, you will have this:</p>
      <ol className="mt-6 space-y-3">
        {ONBOARDING_STEPS.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-3 font-display tracking-tight transition-all duration-500 ${
                active
                  ? "text-[2rem] font-semibold leading-tight text-foreground"
                  : done
                    ? "text-xl text-muted-foreground/45"
                    : "text-xl text-muted-foreground/60"
              }`}
            >
              <span className="grid w-4 shrink-0 place-items-center" aria-hidden>
                {active ? (
                  <span className="h-2 w-2 rounded-full bg-foreground" />
                ) : done ? (
                  <Check size={14} className="text-muted-foreground/60" />
                ) : null}
              </span>
              <span>
                {label}
                {done && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The same steps in one compact row, for phones and the full-screen editor. */
export function StepDots({ current }: { current: number }) {
  return (
    <ol aria-label="Onboarding steps" className="flex min-w-0 items-center gap-1.5 text-xs">
      {ONBOARDING_STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className="flex min-w-0 items-center gap-1.5"
          >
            {i > 0 && <span className="h-px w-3 shrink-0 bg-border sm:w-5" aria-hidden />}
            <span
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${
                active
                  ? "border-foreground bg-foreground text-background"
                  : done
                    ? "border-border bg-accent text-muted-foreground"
                    : "border-border text-muted-foreground"
              }`}
            >
              {done ? <Check size={11} /> : i + 1}
            </span>
            <span
              className={`truncate ${active ? "font-semibold text-foreground" : "hidden text-muted-foreground md:inline"}`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
