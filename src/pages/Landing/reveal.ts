import type { CSSProperties } from "react";

/**
 * Stagger helper for `data-reveal` elements.
 *
 * The delay is a custom property rather than a `transition-delay` written
 * directly, so the *stylesheet* still owns the timing function and duration —
 * a component only says "this one comes a beat later".
 *
 * Keep staggers short. Past about 400ms of total stagger a group stops reading
 * as one thing arriving and starts reading as a queue.
 */
export function delay(seconds: number): CSSProperties {
  return { "--reveal-delay": `${seconds}s` } as CSSProperties;
}
