import { format, parseISO, isValid } from "date-fns";

/** ISO date (yyyy-MM-dd) for "today" in the browser's local timezone. */
export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function nowTimeHHmm(): string {
  return format(new Date(), "HH:mm");
}

export function dayOfWeekFromIso(iso: string): number {
  return parseISO(iso).getDay();
}

export function formatDisplayDate(iso: string): string {
  const date = parseISO(iso);
  if (!isValid(date)) return iso;
  return format(date, "EEEE, d MMM yyyy");
}

export function formatShortDate(iso: string): string {
  const date = parseISO(iso);
  if (!isValid(date)) return iso;
  return format(date, "d MMM");
}

export function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function addDaysIso(iso: string, days: number): string {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return format(date, "yyyy-MM-dd");
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
