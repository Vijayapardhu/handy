/** A faculty directory entry, so Subjects/Timetables forms pick a name rather than retyping it inconsistently. */
export interface FacultyDoc {
  id: string;
  name: string;
  department: string;
  email: string | null;
  active: boolean;
}
