/**
 * Mirrors src/types/student.ts in the root app — same collection, same shape.
 * Duplicated rather than shared because admin/ is a genuinely separate Vite
 * app/deployment (see the plan's rationale). Keep the two in sync by hand.
 */
export interface StudentDoc {
  id: string;
  uid: string;
  rollNumber: string;
  name: string;
  email: string;
  department: string;
  course: string;
  year: number;
  section: string;
  semesterId: string;
  collegeId: string;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  profileComplete: boolean;
  fcmTokens?: string[];
  admissionNo?: string | null;
  semesterLabel?: string | null;
  gender?: string | null;
  dob?: string | null;
  mobileNo?: string | null;
}

/** Fields the admin panel is allowed to edit — deliberately excludes every attendance figure. */
export const STUDENT_EDITABLE_FIELDS = [
  "name",
  "department",
  "course",
  "year",
  "section",
  "semesterId",
  "collegeId",
  "admissionNo",
  "semesterLabel",
  "gender",
  "dob",
  "mobileNo",
] as const satisfies readonly (keyof StudentDoc)[];

export type StudentEditableField = (typeof STUDENT_EDITABLE_FIELDS)[number];
