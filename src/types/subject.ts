export interface SubjectDoc {
  id: string;
  code: string;
  name: string;
  shortName: string;
  facultyId: string;
  facultyName: string;
  semesterId: string;
  department: string;
  /** Overrides college-wide target when set; otherwise the college config target applies. */
  targetAttendance: number | null;
  icon: SubjectIcon;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SubjectIcon =
  | "rocket"
  | "pie-chart"
  | "code"
  | "database"
  | "bar-chart"
  | "cpp"
  | "clock"
  | "briefcase"
  | "book";

/** Attended/held counts for one subject, aggregated from attendance records. */
export interface SubjectAttendanceSummary {
  subjectId: string;
  subjectName: string;
  shortName: string;
  icon: SubjectIcon;
  attended: number;
  held: number;
  targetAttendance: number;
}

export type AttendanceStatusLevel = "critical" | "low" | "average" | "good" | "excellent" | "na";
