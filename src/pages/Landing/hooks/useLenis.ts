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
      // Lower lerp = heavier, longer glide. Below about 0.06 the page starts
      // arriving noticeably after the wheel stops, which reads as lag rather
      // than weight; 0.07 is the heaviest setting that still feels connected.
      lerp: 0.07,
      // Slightly under 1 so a single wheel notch travels a shorter distance
      // and the easing has room to be visible. Above 1 the glide is over
      // before it registers.
      wheelMultiplier: 0.85,
      touchMultiplier: 1.6,
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
 *
 * `immediate` jumps with no animation. That is what an arriving deep link
 * wants: a shared `/#extension` is a request to *be* at that section, and
 * gliding someone through nine thousand pixels of page they didn't ask to see
 * is a worse answer than the plain jump a normal browser anchor would do. It
 * also can't be interrupted — a smooth scroll that starts while the tab is in
 * the background never advances, and the reader lands at the top instead.
 */
export function scrollToHash(lenis: Lenis | null, hash: string, { offset = -88, immediate = false } = {}) {
  const el = document.querySelector(hash);
  if (!el) return;

  if (lenis) {
    // Lenis does its own scrolling and doesn't read scroll-margin, so the nav
    // clearance is passed explicitly here. The CSS rule covers every other
    // path (native fragment jumps, find-in-page, keyboard navigation).
    lenis.scrollTo(el as HTMLElement, { offset, duration: 1.4, immediate });
    return;
  }
  el.scrollIntoView({ behavior: immediate ? "auto" : "smooth", block: "start" });
}
