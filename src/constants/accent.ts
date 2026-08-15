/**
 * Accent choices — mirrors mobile/lib/data/settings.dart's AccentChoice
 * enum. Deliberately a small, curated palette: a picker with thirty
 * swatches mostly offers thirty ways to make the app look worse.
 *
 * `primary` matches mobile's seed color exactly, hex for hex, so switching
 * accents looks like the same product on both. Mobile derives every other
 * shade from that one seed via Material 3's ColorScheme.fromSeed; the web
 * app has no such algorithm, so `dark` (hover/active shade) and the two
 * `light` tints (icon-background tone, one per theme) are chosen by hand —
 * one step darker on the same hue, and a pale/muted tint respectively.
 */
export type AccentId = "orange" | "indigo" | "teal" | "rose" | "violet";

export interface AccentChoice {
  id: AccentId;
  label: string;
  primary: string;
  dark: string;
  lightOnLight: string;
  lightOnDark: string;
}

export const ACCENT_CHOICES: AccentChoice[] = [
  { id: "orange", label: "Sunset", primary: "#f97316", dark: "#ea580c", lightOnLight: "#ffedd5", lightOnDark: "#2a1a0c" },
  { id: "indigo", label: "Indigo", primary: "#6366f1", dark: "#4f46e5", lightOnLight: "#e0e7ff", lightOnDark: "#1e1b4b" },
  { id: "teal", label: "Teal", primary: "#0d9488", dark: "#0f766e", lightOnLight: "#ccfbf1", lightOnDark: "#042f2e" },
  { id: "rose", label: "Rose", primary: "#e11d48", dark: "#be123c", lightOnLight: "#ffe4e6", lightOnDark: "#4c0519" },
  { id: "violet", label: "Violet", primary: "#8b5cf6", dark: "#7c3aed", lightOnLight: "#ede9fe", lightOnDark: "#2e1065" },
];

export const DEFAULT_ACCENT: AccentId = "orange";
