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
      // Write nothing at all, rather than pinning a value here. Each effect's
      // CSS already declares its own resting pose — `var(--progress, 0.5)` for
      // the ones that look right half-way, an explicit `--progress: 1` on the
      // phone cluster, whose parts are stacked and invisible at 0. An inline
      // value would beat every one of those.
      return;
    }

    let frame = 0;
    let visible = false;
    let last = -1;
    let smoothed = 0;
    // True for exactly one frame after the section (re)enters view, so that
    // frame snaps straight to the real position instead of easing in from
    // wherever it last was — otherwise scrolling back into a section that was
    // left mid-fan would visibly animate from the frozen old value.
    let primed = false;

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
      const target = Math.min(1, Math.max(0, raw));

      // A light exponential smoothing on top of the raw scroll-derived value.
      // Without it, a quick reversal (a flick up right after a flick down) can
      // land a single frame where the underlying scroll position hasn't
      // caught up with the new direction yet, which reads as the fan popping
      // or flickering instead of gliding. This damps that single-frame noise
      // without adding any perceptible lag during normal scrolling.
      if (!primed) {
        smoothed = target;
        primed = true;
      } else {
        smoothed += (target - smoothed) * 0.35;
      }

      // Skip the write when nothing moved enough to be seen — a style write
      // invalidates, even when the value is effectively identical.
      if (Math.abs(smoothed - last) > 0.0005) {
        node.style.setProperty("--progress", smoothed.toFixed(4));
        last = smoothed;
      }
      frame = requestAnimationFrame(measure);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !visible) {
          visible = true;
          primed = false;
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
