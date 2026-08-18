/**
 * Pure derivations over AttendanceMarkDoc[] — the mirror of dayStatus.ts, kept
 * as a separate module rather than a retrofit of that file's functions.
 * `AttendanceStatus` (present/absent/leave/excused) and `MarkStatus`
 * (present/absent/cancelled) are different enums with different meanings:
 * a "cancelled" mark is a third state that counts toward neither attended nor
 * held, so it has to be *skipped* in a day's status the same way a day with no
 * classes at all is skipped — not treated as present, and not treated as
 * absent either. Folding that into dayStatus.ts's severity table would have
 * meant teaching it about a status it was never designed to hold.
 */
import { calculateAttendance, roundPercentage } from "./attendance";
import type { AttendanceMarkDoc, MarkStatus } from "@/types/attendanceMark";

type CountableMark = AttendanceMarkDoc & { status: "present" | "absent" };

function isCountable(mark: AttendanceMarkDoc): mark is CountableMark {
  return mark.status !== "cancelled";
}

/**
 * One mark per class, when the same class has been written twice.
 *
 * The web and the Flutter app used to write the same mark at two different
 * document ids (see attendanceMarkId), so a class marked in both places existed
 * twice and every percentage counted it twice. New writes converge on one id and
 * delete the other as they go, but documents already in the collection do not
 * fix themselves — so every read collapses them.
 *
 * Which duplicate wins has to be decided the same way on both platforms, or the
 * website and the phone disagree about the same week, which is the original bug
 * wearing a different hat. So: most recently written wins, and where neither
 * says when it was written, the greater id does. Arbitrary, but arbitrary *and
 * identical* on both sides, which is the only property that matters. Mirrors
 * dedupeMarks in mobile/lib/logic/attendance_marks.dart.
 */
export function dedupeMarks(marks: AttendanceMarkDoc[]): AttendanceMarkDoc[] {
  const best = new Map<string, AttendanceMarkDoc>();
  for (const mark of marks) {
    const key = `${mark.subjectId}|${mark.date}|${mark.startTime}`;
    const held = best.get(key);
    if (!held || wins(mark, held)) best.set(key, mark);
  }
  return [...best.values()];
}

/**
 * Deliberately `<`/`>` and not `localeCompare`.
 *
 * `localeCompare` collates by locale, so it does not order "_" against "-" the
 * way code units do — it ranked the Android id above the web one, while Dart's
 * `String.compareTo` (code units) ranks the web one above. Two platforms, two
 * different winners for the same pair of documents: the original bug back
 * again, one layer down and much harder to see. The relational operators
 * compare UTF-16 code units, which is exactly what Dart does.
 */
function wins(candidate: AttendanceMarkDoc, holder: AttendanceMarkDoc): boolean {
  const candidateTime = candidate.updatedAt ?? "";
  const holderTime = holder.updatedAt ?? "";
  if (candidateTime !== holderTime) return candidateTime > holderTime;
  return candidate.id > holder.id;
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

export interface DailyAttendancePoint {
  /** ISO date (yyyy-MM-dd). */
  date: string;
  attended: number;
  held: number;
  /** null when nothing was held that day — a gap, not a 0% score. */
  percentage: number | null;
}

/**
 * One point per date in `dates`, from the student's own marked attendance —
 * the day-by-day tracker behind the Home page's "Needs Attention" tip.
 *
 * `dates` is supplied by the caller (typically a contiguous ISO range from
 * lib/date's addDaysIso) rather than computed here, so this stays a pure
 * function over data it's handed — no dependency on "today".
 */
export function buildDailyAttendanceTrend(
  marks: AttendanceMarkDoc[],
  dates: string[],
): DailyAttendancePoint[] {
  const byDate = new Map<string, AttendanceMarkDoc[]>();
  for (const mark of marks) {
    const existing = byDate.get(mark.date);
    if (existing) existing.push(mark);
    else byDate.set(mark.date, [mark]);
  }

  return dates.map((date) => {
    const { attended, held } = markAttendedHeld(byDate.get(date) ?? []);
    return {
      date,
      attended,
      held,
      percentage: held === 0 ? null : roundPercentage(calculateAttendance(attended, held)),
    };
  });
}
