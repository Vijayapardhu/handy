export type LeaveRequestStatus = "pending" | "approved" | "rejected";

export interface LeaveRequestDoc {
  id: string;
  studentId: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  reason: string;
  status: LeaveRequestStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export type LeaveRecommendation = "safe" | "caution" | "not_recommended";

export interface SubjectLeaveImpact {
  subjectId: string;
  subjectName: string;
  icon: string;
  classesOnDate: number;
  beforePercentage: number | null;
  afterPercentage: number | null;
  impact: number | null; // percentage points, negative = drop
}

export interface LeaveImpactResult {
  date: string;
  totalClasses: number;
  subjects: SubjectLeaveImpact[];
  overallBefore: number;
  overallAfter: number;
  overallImpact: number;
  recommendation: LeaveRecommendation;
  affectedSubjectCount: number;
}
