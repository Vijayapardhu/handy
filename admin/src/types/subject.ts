/** Mirrors src/types/subject.ts in the root app. */
export interface SubjectDoc {
  id: string;
  code: string;
  name: string;
  shortName: string;
  facultyId: string;
  facultyName: string;
  semesterId: string;
  department: string;
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
