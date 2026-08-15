import { useEffect, type RefObject } from "react";

/**
 * Marks elements as revealed the first time they enter the viewport.
 *
 * One observer for the whole page rather than one per element — a landing page
 * has dozens of animated blocks, and an IntersectionObserver each is a real
 * cost on a mid-range phone. Elements opt in with `data-reveal` anywhere in the
 * tree, and the CSS in landing.module.css does the rest; nothing here touches
 * style directly.
 *
 * Reveal is one-way on purpose. Re-hiding on scroll-up makes a page feel
 * twitchy when you scroll back to re-read something.
 */
export function useReveal(rootRef: RefObject<HTMLElement>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const targets = root.querySelectorAll<HTMLElement>("[data-reveal]");

    // Reduced motion still needs the elements *visible* — they start at
    // opacity 0, so skipping the observer entirely would leave a blank page.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach((el) => {
        el.dataset.revealed = "true";
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.revealed = "true";
          observer.unobserve(entry.target);
        }
      },
      // Fire a little before the element's top edge arrives, so the animation
      // is already underway by the time it's properly in view.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [rootRef]);
}
