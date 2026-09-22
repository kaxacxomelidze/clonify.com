import type { SVGProps } from "react";

export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" {...props}>
      <rect x="3" y="3" width="24" height="24" rx="6" stroke="currentColor" strokeWidth="2.6" />
      <rect x="13" y="13" width="24" height="24" rx="6" stroke="currentColor" strokeWidth="2.6" />
    </svg>
  );
}

export function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-lockup ${className}`}>
      <BrandMark />
      <span>
        Clonyfy<span className="brand-period">.</span>
      </span>
    </span>
  );
}

export function ArrowGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 12h16M13 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
