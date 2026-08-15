/**
 * What the student says about their own attendance, day by day — mirrors
 * mobile's `AttendanceMark` (mobile/lib/models/models.dart:280-319).
 *
 * Deliberately a *separate* collection from `attendance` (AttendanceRecordDoc),
 * which stays server-written. Which of the two a student has depends on their
 * college: Aditya University's portal exposes per-subject running totals only,
 * so `attendance` is permanently empty for them and this collection is the only
 * per-day account that exists. AEC and ACET report a day at a time, so those
 * students get real records in `attendance` — and where both cover the same
 * class, the college's record wins (see portalAttendanceService.mergeAttendance).
 *
 * The distinction is what each one *is*, not where it came from: a mark is the
 * student's own note about their day, fully owned by them (see firestore.rules'
 * `attendanceMarks/{markId}` block — full CRUD, no admin write path, no
 * approval step), while `attendance` is the college's record and is
 * `allow write: if false` for every client, because a record the student can
 * rewrite is not a record.
 *
 * "cancelled" is a real third state, not a boolean present/absent — a
 * cancelled class counts toward neither attended nor held, so it must never
 * be treated as an absence in any percentage or streak calculation. See
 * src/lib/calculations/attendanceMarks.ts.
 */
export type MarkStatus = "present" | "absent" | "cancelled";

export interface AttendanceMarkDoc {
  id: string;
  studentId: string;
  subjectId: string;
  /** ISO date, yyyy-MM-dd. */
  date: string;
  status: MarkStatus;
  /** "HH:mm" — identifies which class on the day this mark is for, alongside subjectId+date. */
  startTime: string;
  /** How many consecutive periods this class block covers, for a multi-period lab/lecture. */
  periods: number;
}

/**
 * Deterministic doc id — marking the same class twice edits the existing
 * mark instead of creating a duplicate, and re-marking the same status twice
 * is what a caller uses to detect "clear this mark" (tap-to-toggle-off).
 * Mirrors `AttendanceMark.idFor` in the Flutter app exactly, so a future
 * cross-platform read never has to reconcile two id schemes.
 */
export function attendanceMarkId(studentId: string, subjectId: string, date: string, startTime: string): string {
  return `${studentId}_${subjectId}_${date}_${startTime}`;
}
