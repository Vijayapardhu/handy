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
  /**
   * False from self-registration until the student has connected the
   * college portal (via the "Handy College Sync" browser extension) at
   * least once — gates access to the rest of the app (see
   * RequireCompleteProfile). Admin-seeded demo accounts are created with
   * this already true (scripts/seed-students.mjs), since they already have
   * full data and never go through onboarding.
   */
  profileComplete: boolean;
  admissionNo?: string | null;
  semesterLabel?: string | null;
  gender?: string | null;
  dob?: string | null;
  mobileNo?: string | null;
}
