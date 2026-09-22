import { useEffect, type ReactNode } from "react";

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    let disposed = false;
    let generation = 0;
    let cleanup: (() => void) | undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const setup = async () => {
      const current = ++generation;
      cleanup?.();
      cleanup = undefined;
      if (media.matches) return;
      const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
        import("lenis"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (disposed || current !== generation || media.matches) return;
      gsap.registerPlugin(ScrollTrigger);
      // Mobile browser chrome changes height while scrolling; keep trigger positions stable.
      ScrollTrigger.config({ ignoreMobileResize: true });
      const lenis = new Lenis({
        duration: 1.05,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        syncTouch: false,
        anchors: { offset: -100 },
      });
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      lenis.on("scroll", ScrollTrigger.update);
      ScrollTrigger.refresh();
      void document.fonts.ready.then(() => {
        if (!disposed && current === generation) ScrollTrigger.refresh();
      });
      cleanup = () => {
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
    };
    const change = () => {
      void setup();
    };
    media.addEventListener("change", change);
    void setup();
    return () => {
      disposed = true;
      generation++;
      cleanup?.();
      media.removeEventListener("change", change);
    };
  }, []);
  return <>{children}</>;
}
