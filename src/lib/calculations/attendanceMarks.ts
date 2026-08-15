/**
 * Pure derivations over AttendanceMarkDoc[] — the mirror of dayStatus.ts, kept
 * as a separate module rather than a retrofit of that file's functions.
 * `AttendanceStatus` (present/absent/leave/excused) and `MarkStatus`
 * (present/absent/cancelled) are different enums with different meanings:
 * a "cancelled" mark is a third state that counts toward neither attended nor
 * held, so it has to be *skipped* in a streak the same way a day with no
 * classes at all is skipped — not treated as present, and not treated as
 * absent either. Folding that into dayStatus.ts's severity table would have
 * meant teaching it about a status it was never designed to hold.
 */
import type { AttendanceMarkDoc, MarkStatus } from "@/types/attendanceMark";

type CountableMark = AttendanceMarkDoc & { status: "present" | "absent" };

function isCountable(mark: AttendanceMarkDoc): mark is CountableMark {
  return mark.status !== "cancelled";
}

/** Worse-wins precedence when a day has more than one mark. Cancelled is deliberately not here — see below. */
const MARK_SEVERITY: Record<CountableMark["status"], number> = { absent: 1, present: 0 };

/**
 * Collapses one day's marks into a single representative status, ignoring
 * "cancelled" marks entirely — a day where the only mark is a cancelled class
 * has no opinion about attendance, the same as a day with no marks at all.
 * Returns null when there is nothing to say about the day.
 */
export function dominantMarkStatus(marks: AttendanceMarkDoc[]): MarkStatus | null {
  const countable = marks.filter(isCountable);
  if (countable.length === 0) return null;
  return countable.reduce((worst, m) => (MARK_SEVERITY[m.status] > MARK_SEVERITY[worst.status] ? m : worst)).status;
}

/**
 * Current streak of consecutive marked days, most-recent-first, with no
 * absence. A day with only cancelled marks (or no marks) does not break the
 * streak and does not extend it either — it is simply not evidence either way.
 *
 * @param marksByDateDesc Marks grouped by date, newest date first.
 */
export function calculateMarkStreak(marksByDateDesc: Array<{ date: string; marks: AttendanceMarkDoc[] }>): number {
  let streak = 0;
  for (const day of marksByDateDesc) {
    const status = dominantMarkStatus(day.marks);
    if (status === "absent") break;
    if (status === null) continue;
    streak += 1;
  }
  return streak;
}

/**
 * Attended/held contribution of a set of marks, for a percentage — mirrors
 * ATTENDED_STATUSES's role in attendance.ts, but for marks: cancelled adds
 * to neither side, present adds to both, absent adds only to held.
 */
export function markAttendedHeld(marks: AttendanceMarkDoc[]): { attended: number; held: number } {
  let attended = 0;
  let held = 0;
  for (const m of marks) {
    if (m.status === "cancelled") continue;
    held += 1;
    if (m.status === "present") attended += 1;
  }
  return { attended, held };
}
