import type { CodingPlatform } from "@/types/coding";

/**
 * Each platform's own identity color, deliberately outside Handy's own accent
 * system (constants/accent.ts).
 *
 * The precedent is CodeForge's home-screen tile (mobile), which breaks from
 * the student's chosen palette on purpose: "it is its own thing", and a
 * percentage in the app's own color could be mistaken for one of Handy's own
 * numbers. The same reasoning applies here, five times over — a LeetCode tile
 * and a Codeforces tile carrying the same orange would be two unrelated
 * numbers wearing the same badge, and the whole point of a platform grid is
 * telling them apart at a glance.
 *
 * These are widely-recognized approximations of each brand's own color, not
 * pixel-exact trademarked values — close enough to read as "that's LeetCode's
 * orange" without claiming any affiliation.
 *
 * Applied as a solid accent (an edge, an icon, a badge) rather than as body
 * text or a full background: `color-mix(in srgb, var(--brand) N%, transparent)`
 * at the call site derives a tint that already adapts to light/dark, the same
 * way StreakHeatmap's activity cells do — no separate light/dark hex to keep
 * in sync by hand.
 */
export interface PlatformBrand {
  color: string;
  /** Two or three letters — there is no logo asset here, so the monogram carries the identity instead. */
  monogram: string;
}

export const PLATFORM_BRAND: Record<CodingPlatform, PlatformBrand> = {
  leetcode: { color: "#FFA116", monogram: "LC" },
  codeforces: { color: "#1F8ACB", monogram: "CF" },
  codechef: { color: "#8B5A2B", monogram: "CC" },
  gfg: { color: "#2F8D46", monogram: "G4G" },
  hackerrank: { color: "#2EC866", monogram: "HR" },
};
