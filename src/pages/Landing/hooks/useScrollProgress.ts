import { useEffect, useRef } from "react";

type Range = "cover" | "enter" | "pin";

/**
 * Writes a 0→1 `--progress` custom property onto an element as it travels
 * through the viewport, for effects that need to track the scrollbar rather
 * than just fire once (the hero's phone tilt, the steps rail, the widget rail).
 *
 * Why a custom property and not React state: this updates every frame while
 * the element is on screen. Re-rendering a component 60 times a second to move
 * a `transform` is wasteful — writing one property that CSS already consumes
 * keeps the whole effect on the compositor, and lets the *stylesheet* decide
 * what the number means.
 *
 * The rAF loop is gated by an IntersectionObserver, so nothing runs for a
 * section that is nowhere near the viewport.
 *
 * - `cover` — 0 as the element's top reaches the viewport bottom, 1 as its
 *   bottom leaves the viewport top. The whole pass-through.
 * - `enter` — 0 as the top reaches the viewport bottom, 1 once the element's
 *   top hits the viewport top. Better for pinned-feeling intros.
 * - `pin` — 0 while the element's top is still at or below the viewport top,
 *   1 once its bottom has risen to the viewport bottom. This is the range a
 *   tall section with a `position: sticky` child needs: it measures exactly
 *   the scroll distance during which the sticky child is held in place.
 */
export function useScrollProgress<T extends HTMLElement>(range: Range = "cover") {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // A fixed mid-range value leaves scroll-linked pieces in a sensible
      // resting pose instead of stuck at their 0 extreme (fully tilted, rail
      // fully to one side).
      el.style.setProperty("--progress", "0.5");
      return;
    }

    let frame = 0;
    let visible = false;
    let last = -1;

    function measure() {
      const node = ref.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight;

      let raw: number;
      if (range === "pin") {
        // Starts counting only once the element's top passes the viewport top,
        // and finishes when its bottom arrives at the viewport bottom — the
        // exact window during which a sticky child stays pinned.
        const span = rect.height - vh;
        raw = span <= 0 ? 0 : -rect.top / span;
      } else {
        // `cover` and `enter` both start at the same place — the element's top
        // reaching the viewport bottom — so only the distance differs.
        const span = range === "cover" ? rect.height + vh : vh;
        raw = span === 0 ? 0 : (vh - rect.top) / span;
      }
      const progress = Math.min(1, Math.max(0, raw));

      // Skip the write when nothing moved enough to be seen — a style write
      // invalidates, even when the value is effectively identical.
      if (Math.abs(progress - last) > 0.0005) {
        node.style.setProperty("--progress", progress.toFixed(4));
        last = progress;
      }
      frame = requestAnimationFrame(measure);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !visible) {
          visible = true;
          frame = requestAnimationFrame(measure);
        } else if (!entry.isIntersecting && visible) {
          visible = false;
          cancelAnimationFrame(frame);
        }
      },
      { threshold: 0 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [range]);

  return ref;
}
