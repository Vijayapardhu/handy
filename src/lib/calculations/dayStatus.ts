/**
 * Centralized "one record per day" derivations (companion to attendance.ts).
 * A day can have several attendance records (multiple subjects); these
 * functions collapse a day down to a single representative status, and turn
 * a sequence of days into a streak count. Pure functions — no I/O, no Date.now().
 */
import type { AttendanceRecordDoc, AttendanceStatus } from "@/types/attendance";

/** Coloring/derivation precedence when a day has multiple records (worst status wins). */
export const STATUS_SEVERITY: Record<AttendanceStatus, number> = { absent: 3, leave: 2, excused: 1, present: 0 };

/** Collapses one day's attendance records into a single worst-case status. */
export function dominantStatus(records: AttendanceRecordDoc[]): AttendanceStatus | null {
  if (records.length === 0) return null;
  return records.reduce((worst, r) =>
    STATUS_SEVERITY[r.status] > STATUS_SEVERITY[worst.status] ? r : worst,
  ).status;
}

/**
 * Current streak of consecutive school days, most-recent-first, whose
 * dominant status is not "absent" (SRS-aligned with the attended-statuses
 * rule in attendanceService: present/excused count, leave is neutral,
 * absent breaks the streak). Stops at the first gap or absent day.
 *
 * @param recordsByDateDesc Attendance records grouped by date, one entry per
 *   distinct day that had classes, sorted newest date first. Days with no
 *   classes held (e.g. Sundays, holidays) are simply absent from this list
 *   and do not break the streak.
 */
export function calculateStreak(recordsByDateDesc: Array<{ date: string; records: AttendanceRecordDoc[] }>): number {
  let streak = 0;
  for (const day of recordsByDateDesc) {
    const status = dominantStatus(day.records);
    if (status === "absent") break;
    if (status === null) continue;
    streak += 1;
  }
  return streak;
}
