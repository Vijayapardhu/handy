import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ACCENT_CHOICES, DEFAULT_ACCENT, type AccentId } from "@/constants/accent";

const STORAGE_KEY = "handy-accent";

interface AccentContextValue {
  accent: AccentId;
  setAccent: (accent: AccentId) => void;
}

const AccentContext = createContext<AccentContextValue | null>(null);

function readStoredAccent(): AccentId {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return ACCENT_CHOICES.some((c) => c.id === stored) ? (stored as AccentId) : DEFAULT_ACCENT;
}

/**
 * Applies the chosen accent to <html data-accent="..."> — the selector
 * tokens.css's per-accent overrides hang off, the same mechanism
 * ThemeProvider uses for data-theme. Device-only (localStorage), matching
 * mobile's SharedPreferences-only accent — there's no student-facing reason
 * for it to sync across devices, and no Firestore field for it.
 */
export function AccentProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<AccentId>(readStoredAccent);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    window.localStorage.setItem(STORAGE_KEY, accent);
  }, [accent]);

  function setAccent(next: AccentId) {
    setAccentState(next);
  }

  return <AccentContext.Provider value={{ accent, setAccent }}>{children}</AccentContext.Provider>;
}

export function useAccent(): AccentContextValue {
  const ctx = useContext(AccentContext);
  if (!ctx) throw new Error("useAccent must be used within AccentProvider");
  return ctx;
}
