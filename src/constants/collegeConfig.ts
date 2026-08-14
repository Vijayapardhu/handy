import type { CollegeConfigDoc } from "@/types/config";

/**
 * Fallback used only until `colleges/{collegeId}` loads from Firestore, and in
 * tests. The live app always prefers the Firestore-backed config — see
 * `useCollegeConfig` — so this is the single place a default ever appears.
 */
export const DEFAULT_COLLEGE_CONFIG: CollegeConfigDoc = {
  id: "default",
  minimumAttendancePercentage: 75,
  condonationPercentage: null,
  workingDaysPerWeek: 6,
  classDurationMinutes: 50,
  statusThresholds: {
    critical: 0,
    low: 40,
    average: 60,
    good: 70,
    excellent: 90,
  },
};
