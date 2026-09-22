import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const SIGNUP = "/register";

/**
 * Magnetic CTA with an even hover fill and a soft shadow.
 */
export function Cta({
  children,
  href = SIGNUP,
  variant = "solid",
  size = "lg",
  className,
}: {
  children: ReactNode;
  href?: string;
  variant?: "solid" | "ghost";
  size?: "lg" | "md" | "sm";
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.18;
    const y = (e.clientY - r.top - r.height / 2) * 0.28;
    el.style.transform = `translate(${x}px, ${y}px)`;
  };

  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "translate(0px, 0px)";
  };

  return (
    <a
      ref={ref}
      href={href}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full font-medium",
        "transition-[transform,box-shadow,background-color,color] duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
        size === "lg" && "px-8 py-4 text-[0.95rem]",
        size === "md" && "px-6 py-3 text-sm",
        size === "sm" && "px-4 py-2 text-xs",
        variant === "solid"
          ? "bg-primary text-primary-foreground shadow-[0_18px_50px_-20px_var(--foreground)] hover:bg-primary/90 hover:shadow-[0_26px_70px_-18px_var(--foreground)]"
          : "border border-border bg-transparent text-foreground hover:bg-accent",
        className,
      )}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </a>
  );
}

export { SIGNUP };
