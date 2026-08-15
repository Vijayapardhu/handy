/** Mirrors src/types/timetable.ts in the root app. */
export type TimetableVersionStatus = "draft" | "published" | "archived";

export interface TimetableVersionDoc {
  id: string;
  semesterId: string;
  department: string;
  section: string;
  versionNumber: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
  status: TimetableVersionStatus;
  publishedAt: string | null;
  publishedBy: string | null;
  createdAt: string;
}

export type TimetableEntryType = "lecture" | "lab" | "technical" | "break" | "activity";

/** 0 = Sunday .. 6 = Saturday, matches JS Date#getDay(). */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TimetableEntryDoc {
  id: string;
  timetableVersionId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  subjectId: string;
  facultyId: string;
  facultyName: string;
  room: string | null;
  block?: string | null;
  periodNo?: number;
  strength?: number | null;
  opted?: number | null;
  type: TimetableEntryType;
  active: boolean;
}
