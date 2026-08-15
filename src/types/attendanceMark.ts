/**
 * What the student says about their own attendance, day by day — mirrors
 * mobile's `AttendanceMark` (mobile/lib/models/models.dart:280-319).
 *
 * Deliberately a *separate* collection from `attendance` (AttendanceRecordDoc),
 * which stays admin-only and, for every real synced student, permanently
 * empty — the college portal exposes only per-subject running totals, never
 * a per-day record. This collection is what actually fills that gap: the
 * student's own account of a class, fully owned by them (see firestore.rules'
 * `attendanceMarks/{markId}` block — full CRUD, no admin write path, no
 * approval step, because a mark is a note about your own day, not a claim
 * against the college's record).
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
