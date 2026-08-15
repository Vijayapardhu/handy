/** Mirrors src/types/config.ts in the root app — college-wide attendance thresholds. */
export interface CollegeConfigDoc {
  id: string;
  minimumAttendancePercentage: number;
  condonationPercentage: number | null;
  workingDaysPerWeek: number;
  classDurationMinutes: number;
  statusThresholds: AttendanceStatusThresholds;
}

export interface AttendanceStatusThresholds {
  critical: number;
  low: number;
  average: number;
  good: number;
  excellent: number;
}
