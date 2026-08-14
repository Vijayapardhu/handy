/**
 * Shape produced by the Handy College Sync browser extension
 * (extension/src/parser.js) from Aditya University's Campus Connect
 * ShowStudentProfileNew response. Kept independent of AttendanceRecordDoc /
 * SubjectDoc — this is a read-only external snapshot, not an official
 * Firestore-backed record.
 */
export interface CollegePortalSubjectAttendance {
  slNo: number;
  code: string;
  name: string;
  facultyId: string;
  facultyName: string;
  held: number;
  attended: number;
  percent: number;
}

export interface CollegePortalAttendanceTotal {
  held: number;
  attended: number;
  percent: number;
}

/**
 * Timetable captured from studenttimetableoption.aspx/ShowTimeTables — a
 * different endpoint (and a different envelope: JSON rather than HTML) from
 * the profile capture, so it arrives separately and may be absent.
 */
export interface CollegePortalTimetableSubject {
  code: string;
  name: string;
  /** The portal's own abbreviation, e.g. "ADSAA". Null if it didn't supply one. */
  shortName: string | null;
  facultyId: string;
  facultyName: string;
  room: string | null;
}

export interface CollegePortalTimetableSlot {
  /** 0 = Sunday .. 6 = Saturday, matching JS Date#getDay() and DayOfWeek. */
  dayOfWeek: number;
  periodNo: number;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  /** Joins to CollegePortalSubjectAttendance.code, and thus to the imported subject docs. */
  subjectCode: string;
  type: "lecture" | "lab" | "technical" | "activity";
}

export interface CollegePortalTimetable {
  ttNo: number | null;
  /** e.g. "T6(CA3)" — the closest thing the portal exposes to a section. */
  name: string | null;
  subjects: CollegePortalTimetableSubject[];
  slots: CollegePortalTimetableSlot[];
  capturedAt: string;
  sourceUrl: string;
}

export interface CollegePortalSnapshot {
  rollNumber: string | null;
  studentName: string | null;
  admissionNo: string | null;
  course: string | null;
  branch: string | null;
  semesterLabel: string | null;
  photoUrl: string | null;
  gender: string | null;
  dob: string | null;
  mobileNo: string | null;
  email: string | null;
  attendance: {
    subjects: CollegePortalSubjectAttendance[];
    total: CollegePortalAttendanceTotal | null;
  };
  /**
   * Attached by the extension bridge when a timetable has also been captured
   * (the two come from different pages, so a student may have one without the
   * other). Absent means "no timetable seen yet", never "no classes".
   */
  timetable?: CollegePortalTimetable | null;
  capturedAt: string;
  sourceUrl: string;
}
