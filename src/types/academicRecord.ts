/**
 * Semester grades and CGPA — scraped alongside attendance during an
 * AEC/ACET/AGBS portal sign-in (see api/_campusPortal.js's parseMarksHtml and
 * api/verify.js), never for AUS: its portal exposes no equivalent page.
 */
export interface GradeSubject {
  sNo: string;
  courseName: string;
  grade: string;
  result: "P" | "F";
}

export interface SemesterGrades {
  semester: string;
  /** "0.00" when the portal printed no SGPA row for this semester. */
  sgpa: string;
  subjects: GradeSubject[];
}

export interface AcademicRecordDoc {
  id: string;
  studentId: string;
  campus: string;
  /** "N/A" when the portal has nothing to report yet. */
  cgpa: string;
  grades: SemesterGrades[];
  capturedAt: string;
  updatedAt: string;
}
