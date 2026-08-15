import { useEffect, useRef } from "react";
import Lenis from "lenis";

/**
 * Weighted, eased scrolling for the landing page — and only the landing page.
 *
 * Lenis takes over the document scroller globally, so the instance is created
 * on mount and destroyed on unmount. Without that teardown, signing in would
 * leave the app's own scrolling regions running through Lenis, which fights
 * the phone-shell layout and the sheets.
 *
 * Two cases opt out entirely rather than degrading:
 *
 * - `prefers-reduced-motion` — smoothed scrolling is exactly the vestibular
 *   trigger that setting exists for.
 * - Touch devices — Android and iOS already apply their own momentum, and
 *   Lenis interpolating on top of it feels like the page is lagging behind
 *   your finger. `syncTouch` exists for this and still doesn't feel right, so
 *   native scrolling wins on touch.
 *
 * Returns a ref to the instance (null when opted out) so anchor links can use
 * `lenis.scrollTo` and share the same easing.
 */
export function useLenis() {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (reduceMotion || isTouch) return;

    const lenis = new Lenis({
      // Lower lerp = heavier, longer glide. 0.085 is the point where it reads
      // as deliberate rather than sluggish at 60fps.
      lerp: 0.085,
      wheelMultiplier: 0.9,
      // Anchors are handled explicitly (see scrollToHash) so the offset for
      // the sticky nav can be applied.
      anchors: false,
    });
    lenisRef.current = lenis;

    let frame = 0;
    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return lenisRef;
}

/**
 * Scrolls to a `#hash` target, clearing the sticky nav.
 *
 * Falls back to the platform's own smooth scroll when Lenis opted out, so the
 * in-page links keep working on a phone and under reduced motion (where the
 * browser honours the setting for `behavior: "smooth"` on its own).
 */
export function scrollToHash(lenis: Lenis | null, hash: string, offset = -84) {
  const el = document.querySelector(hash);
  if (!el) return;

  if (lenis) {
    lenis.scrollTo(el as HTMLElement, { offset, duration: 1.4 });
    return;
  }
  const top = el.getBoundingClientRect().top + window.scrollY + offset;
  window.scrollTo({ top, behavior: "smooth" });
}
