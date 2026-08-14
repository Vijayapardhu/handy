export type AttendanceStatus = "present" | "absent" | "leave" | "excused";
export type AttendanceSource = "manual" | "admin" | "import" | "collegePortal";

export interface AttendanceRecordDoc {
  id: string;
  studentId: string;
  subjectId: string;
  timetableEntryId: string | null;
  date: string; // ISO date yyyy-MM-dd
  status: AttendanceStatus;
  source: AttendanceSource;
  recordedAt: string;
  updatedAt: string;
}

/**
 * Maintained aggregate of attended/held per (student, subject) — SRS §62:
 * "do not retrieve all attendance records every time the home page loads."
 * Kept in sync transactionally whenever an attendance record is written (see
 * services/attendance/attendanceService.ts). Doc id is `${studentId}_${subjectId}`.
 */
export interface AttendanceSummaryDoc {
  id: string;
  studentId: string;
  subjectId: string;
  attended: number;
  held: number;
  updatedAt: string;
  /** Only set on summaries written by a student's own college-portal import (see firestore.rules). */
  source?: AttendanceSource;
}

export type AttendanceCorrectionStatus = "pending" | "approved" | "rejected";

export interface AttendanceCorrectionDoc {
  id: string;
  studentId: string;
  subjectId: string;
  date: string;
  expectedStatus: AttendanceStatus;
  reason: string;
  attachmentUrl: string | null;
  status: AttendanceCorrectionStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}
