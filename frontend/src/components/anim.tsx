import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

async function loadGsap() {
  const { gsap } = await import("gsap");
  const { ScrollTrigger } = await import("gsap/ScrollTrigger");
  gsap.registerPlugin(ScrollTrigger);
  return { gsap, ScrollTrigger };
}

export function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
  blur = false,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  blur?: boolean;
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void loadGsap().then(({ gsap }) => {
      if (disposed || !ref.current) return;
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ref.current,
          { opacity: 0, y, ...(blur ? { filter: "blur(5px)" } : {}) },
          {
            opacity: 1,
            y: 0,
            ...(blur ? { filter: "blur(0px)" } : {}),
            duration: 0.9,
            delay,
            ease: "power3.out",
            scrollTrigger: { trigger: ref.current, start: "top 94%", once: true },
          },
        );
      });
      cleanup = () => media.revert();
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [delay, y, blur]);
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

export function SplitHeading({
  text,
  className,
  as: Tag = "h1",
  delay = 0,
  stagger = 0.06,
  scrollTriggered = false,
  direction = "left",
}: {
  text: string;
  className?: string;
  as?: ElementType;
  delay?: number;
  stagger?: number;
  scrollTriggered?: boolean;
  direction?: "left" | "right";
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void loadGsap().then(({ gsap }) => {
      if (disposed || !ref.current) return;
      const el = ref.current;
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          el.querySelectorAll("[data-word]"),
          { x: direction === "left" ? -26 : 26, yPercent: 35, opacity: 0 },
          {
            x: 0,
            yPercent: 0,
            opacity: 1,
            duration: 0.85,
            delay,
            stagger,
            ease: "expo.out",
            ...(scrollTriggered
              ? { scrollTrigger: { trigger: el, start: "top 93%", once: true } }
              : {}),
          },
        );
      });
      cleanup = () => media.revert();
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [text, delay, stagger, scrollTriggered, direction]);
  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {text.split(" ").map((word, i) => (
        <span key={i} className="word-mask" aria-hidden="true">
          <span data-word>{word}</span>
          {i < text.split(" ").length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}

/** Each new viewport entry starts a fresh count, including when scrolling upward. */
export function CountUp({
  to,
  duration = 1700,
  className,
  format = (n: number) => n.toLocaleString("en-US"),
}: {
  to: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let visible = false;
    const animate = () => {
      cancelAnimationFrame(frame);
      if (media.matches) {
        setValue(to);
        return;
      }
      setValue(0);
      if (!visible) return;
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        setValue(Math.round(to * (1 - Math.pow(1 - progress, 4))));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = !!entry?.isIntersecting && entry.intersectionRatio >= 0.4;
        animate();
      },
      { threshold: [0, 0.4] },
    );
    observer.observe(el);
    media.addEventListener("change", animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      media.removeEventListener("change", animate);
    };
  }, [to, duration]);
  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      <span className="sr-only">{format(to)}</span>
      <span aria-hidden="true">{format(value)}</span>
    </span>
  );
}

export function Parallax({
  children,
  className,
  strength = 40,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void loadGsap().then(({ gsap }) => {
      if (disposed || !ref.current) return;
      const media = gsap.matchMedia();
      media.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ref.current,
          { y: strength },
          {
            y: -strength,
            ease: "none",
            scrollTrigger: {
              trigger: ref.current,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.8,
            },
          },
        );
      });
      cleanup = () => media.revert();
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [strength]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
