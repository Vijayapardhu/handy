/** A real, admin-managed semester — what subjects/timetables should reference instead of a free-text id. */
export interface SemesterDoc {
  id: string;
  label: string;
  startDate: string;
  endDate: string | null;
  active: boolean;
}
