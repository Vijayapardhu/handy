export type TimetableVersionStatus = "draft" | "published" | "archived";

export interface TimetableVersionDoc {
  id: string;
  semesterId: string;
  department: string;
  section: string;
  versionNumber: number;
  effectiveFrom: string; // ISO date (yyyy-MM-dd)
  effectiveUntil: string | null; // ISO date, null = open-ended
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
  startTime: string; // "HH:mm" 24h
  endTime: string; // "HH:mm" 24h
  subjectId: string;
  facultyId: string;
  facultyName: string;
  room: string | null;
  /** Building the room sits in — from the portal timetable, null for admin-entered rows. */
  block?: string | null;
  /** Portal period number (1..7). Drives free-period detection in the day view. */
  periodNo?: number;
  type: TimetableEntryType;
  active: boolean;
}

export interface TimetableEntryChange {
  field: "startTime" | "endTime" | "room" | "facultyId" | "subjectId";
  label: string;
  previous: string;
  next: string;
}

export interface TimetableEntryDiff {
  kind: "added" | "removed" | "changed";
  subjectName: string;
  changes: TimetableEntryChange[];
}
