import { useEffect, type MutableRefObject, type RefObject } from "react";
import type Lenis from "lenis";

/**
 * Settles a pinned carousel on a whole widget instead of wherever the scroll
 * happened to stop.
 *
 * Without this the section can come to rest mid-transition, showing two
 * half-faded widgets and neither of them readable — the reader has to nudge
 * the wheel to fix a position they did not choose.
 *
 * Implemented in JS rather than with CSS `scroll-snap-type`, because Lenis
 * drives the document scroll itself and the two fight: the browser snaps, then
 * Lenis animates back toward its own target, and the page oscillates.
 *
 * Behaviour is deliberately "proximity, not mandatory":
 *
 * - It only acts once scrolling has actually stopped, so a reader passing
 *   straight through the section is never grabbed mid-flick.
 * - It only acts inside the pinned range, so it cannot interfere with the
 *   sections either side.
 * - It does nothing when already within a hair of a slot, which stops it
 *   re-triggering off the scroll events its own animation emits.
 */
export function useCarouselSnap(
  sectionRef: RefObject<HTMLElement>,
  lenisRef: MutableRefObject<Lenis | null>,
  steps: number,
) {
  useEffect(() => {
    if (steps < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const SETTLE_MS = 140;
    const DURATION_S = 0.55;

    let idleTimer = 0;
    let guardTimer = 0;
    let snapping = false;

    function settle() {
      const el = sectionRef.current;
      if (!el || snapping) return;

      const rect = el.getBoundingClientRect();
      const travel = el.offsetHeight - window.innerHeight;
      // No travel means the section isn't taller than the viewport, so it is
      // not pinned and there is nothing to snap to.
      if (travel <= 0) return;

      const progress = -rect.top / travel;
      // Outside the pin — the reader is above or below the carousel.
      if (progress <= 0.01 || progress >= 0.99) return;

      const slot = Math.round(progress * (steps - 1)) / (steps - 1);
      const sectionTop = window.scrollY + rect.top;
      const target = Math.round(sectionTop + slot * travel);
      const delta = target - window.scrollY;
      // Close enough already. This is also what stops the animation's own
      // scroll events from starting a fresh snap.
      if (Math.abs(delta) < 3) return;

      snapping = true;
      const lenis = lenisRef.current;
      if (lenis) lenis.scrollTo(target, { duration: DURATION_S });
      else window.scrollTo({ top: target, behavior: "smooth" });

      window.clearTimeout(guardTimer);
      guardTimer = window.setTimeout(() => {
        snapping = false;
      }, DURATION_S * 1000 + 120);
    }

    function onScroll() {
      if (snapping) return;
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(settle, SETTLE_MS);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(idleTimer);
      window.clearTimeout(guardTimer);
    };
  }, [sectionRef, lenisRef, steps]);
}
