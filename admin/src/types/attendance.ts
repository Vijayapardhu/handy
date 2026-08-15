/**
 * Mirrors src/types/attendance.ts in the root app — read-only from the admin
 * side. There is deliberately no admin write path for any of these three
 * collections; see admin/api/_admin.js's header comment and firestore.rules.
 */
export type AttendanceStatus = "present" | "absent" | "leave" | "excused";
export type AttendanceSource = "manual" | "admin" | "import" | "collegePortal";

export interface AttendanceSummaryDoc {
  id: string;
  studentId: string;
  subjectId: string;
  attended: number;
  held: number;
  updatedAt: string;
  source?: AttendanceSource;
}

export type AttendanceCorrectionStatus = "pending" | "approved" | "rejected";

/** Read-only in the admin panel — approving one is out of scope, see the plan. */
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
