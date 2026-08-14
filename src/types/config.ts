/** College-wide configuration (SRS §65). Never hardcode these values in UI/logic. */
export interface CollegeConfigDoc {
  id: string;
  minimumAttendancePercentage: number;
  condonationPercentage: number | null;
  workingDaysPerWeek: number;
  classDurationMinutes: number;
  statusThresholds: AttendanceStatusThresholds;
}

/** Lower bounds (inclusive) for each status band, expressed as percentages. */
export interface AttendanceStatusThresholds {
  critical: number; // e.g. 0
  low: number; // e.g. 50
  average: number; // e.g. 60
  good: number; // e.g. 70
  excellent: number; // e.g. 90
}
