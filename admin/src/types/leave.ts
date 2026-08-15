/** Mirrors src/types/leave.ts in the root app. */
export type LeaveRequestStatus = "pending" | "approved" | "rejected";

export interface LeaveRequestDoc {
  id: string;
  studentId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveRequestStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}
