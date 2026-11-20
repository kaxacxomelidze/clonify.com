import { Check, X } from "lucide-react";
import type { PlanFeature } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * A plan's feature rows: ✓ for what is included, a red ❌ for what is not
 * ("clearly show what is included and what is NOT included").
 */
export function PlanFeatureList({
  features,
  className,
  notIncludedLabel = "Not included:",
}: {
  features: PlanFeature[];
  className?: string;
  /** Screen-reader prefix for excluded rows (localised by the caller). */
  notIncludedLabel?: string;
}) {
  return (
    <ul className={cn("space-y-2.5", className)}>
      {features.map((f) => (
        <li
          key={f.label}
          className={cn(
            "flex items-start gap-2.5 text-sm",
            f.included ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {f.included ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
          ) : (
            <X
              className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
              strokeWidth={3}
              aria-hidden="true"
            />
          )}
          <span>
            {!f.included && <span className="sr-only">{notIncludedLabel} </span>}
            {f.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
