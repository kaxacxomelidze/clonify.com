import { useEffect, useRef } from "react";
import type { gsap as Gsap } from "gsap";

/** Scope, pause and dispose decorative scenes. Static markup remains readable without JS. */
export function useScene(
  animate: (gsap: typeof Gsap, element: HTMLDivElement) => ReturnType<typeof Gsap.timeline>,
  enabled = true,
) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    let disposed = false;
    let context: ReturnType<typeof Gsap.context> | undefined;
    let timeline: ReturnType<typeof Gsap.timeline> | undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const sync = () => {
      if (!timeline) return;
      if (media.matches) {
        context?.revert();
        timeline = undefined;
      } else if (visible && !document.hidden) timeline.play();
      else timeline.pause();
    };
    const setup = async () => {
      if (media.matches) return;
      const { gsap } = await import("gsap");
      if (disposed || media.matches) return;
      context = gsap.context(() => {
        timeline = animate(gsap, element);
      }, element);
      sync();
    };
    const onPreference = () => {
      if (media.matches) sync();
      else if (!timeline) void setup();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = !!entry?.isIntersecting;
        sync();
      },
      { rootMargin: "80px" },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    media.addEventListener("change", onPreference);
    void setup();
    return () => {
      disposed = true;
      observer?.disconnect();
      context?.revert();
      document.removeEventListener("visibilitychange", sync);
      media.removeEventListener("change", onPreference);
    };
  }, [animate, enabled]);
  return ref;
}
