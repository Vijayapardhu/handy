/**
 * Student-submitted "this looks wrong" reports for the published timetable
 * (SRS §20's "Report a Change" affordance). Distinct from an actual timetable
 * revision — students can never publish a new version themselves (SRS §36);
 * this only ever queues something for an administrator to review.
 */
export type TimetableChangeReportStatus = "pending" | "reviewed" | "dismissed";

export interface TimetableChangeReportDoc {
  id: string;
  studentId: string;
  timetableVersionId: string | null;
  subjectId: string | null;
  description: string;
  status: TimetableChangeReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}
