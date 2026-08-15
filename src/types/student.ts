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
  /**
   * FCM registration tokens, one per device the student enabled push on
   * (see services/notifications/pushService.ts). Appended with arrayUnion,
   * never replaced — a phone and a laptop should both ring. Tokens that
   * Firebase reports as unregistered are pruned server-side by api/notify.js.
   */
  fcmTokens?: string[];
  admissionNo?: string | null;
  semesterLabel?: string | null;
  gender?: string | null;
  dob?: string | null;
  mobileNo?: string | null;
  /**
   * Whether the server may push a notification to this student when a sync
   * lands. Lives on the student doc rather than only on the device because
   * the *server* decides whether to send, and it can't read a phone's local
   * preferences. Missing (undefined) reads as enabled — see ProfilePage.
   */
  notifyNewData?: boolean;
}
