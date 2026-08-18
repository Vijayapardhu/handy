/**
 * Turning a required-classes count into a date, and a date into a word.
 * Mirrors mobile's daysToAttend/shortWhen (mobile/lib/logic/planning.dart).
 */
import { addDaysIso, dayOfWeekFromIso, formatShortDate, WEEKDAY_LABELS } from "@/lib/date";
import type { TimetableEntryDoc, TimetableEntryType } from "@/types/timetable";

export interface DaysToAttend {
  /** Days the student actually has to turn up on, not calendar days. */
  days: number;
  /** ISO date of the last of those days. */
  on: string;
}

/**
 * How long it actually takes to attend `classesNeeded` more, walked off the
 * timetable rather than divided by an average — 13 classes of a subject that
 * meets 3 times a week is a month, not "about 3 days" (13 / 5.2 classes-a-day
 * across every subject, which was the bug this replaces).
 *
 * Starts from tomorrow: today's classes have either happened or are
 * happening, and neither is something a student can now decide to attend.
 *
 * `type` narrows to a kind of period rather than a subject — how the CodeForge
 * card would find the next Technical Hour, which has no percentage of its own.
 *
 * Returns null when the timetable can't answer: no entries at all (portal-login
 * colleges publish none), the subject never meets, or it would take longer
 * than `horizonDays`. Null is honest — a guess dressed as a date is worse than
 * showing nothing.
 */
export function daysToAttend(
  classesNeeded: number,
  entries: TimetableEntryDoc[],
  fromIso: string,
  options: { subjectId?: string; type?: TimetableEntryType; horizonDays?: number } = {},
): DaysToAttend | null {
  if (classesNeeded <= 0) return null;
  const { subjectId, type, horizonDays = 180 } = options;

  const relevant = entries.filter(
    (e) => e.active && (!subjectId || e.subjectId === subjectId) && (!type || e.type === type),
  );
  if (relevant.length === 0) return null;

  let held = 0;
  let days = 0;

  for (let offset = 1; offset <= horizonDays; offset++) {
    const on = addDaysIso(fromIso, offset);
    const dow = dayOfWeekFromIso(on);
    const periods = relevant.filter((e) => e.dayOfWeek === dow).length;
    if (periods === 0) continue;

    days++;
    held += periods;
    if (held >= classesNeeded) return { days, on };
  }

  return null;
}

/**
 * "tomorrow" / "Thu" / "12 May" — whichever is shortest and still unambiguous.
 * Lives next to daysToAttend because it exists to render what that returns.
 * A weekday name only inside the coming week: past that, "Thursday" is a
 * question rather than an answer.
 */
export function shortWhen(dateIso: string, todayIso: string): string {
  const daysAhead = calendarDaysBetween(todayIso, dateIso);
  if (daysAhead === 1) return "tomorrow";
  if (daysAhead > 1 && daysAhead < 7) return WEEKDAY_LABELS[dayOfWeekFromIso(dateIso)];
  return formatShortDate(dateIso);
}

function calendarDaysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
