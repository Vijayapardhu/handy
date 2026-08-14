/**
 * A thing the student needs to remember — an assignment due Friday, a
 * presentation in tomorrow's class, a lab record to submit.
 *
 * Deliberately student-authored and student-owned: nothing in the college
 * portal exposes coursework, so this is the one collection in Handy whose
 * contents come from the student rather than from a capture.
 */
export type TaskKind = "assignment" | "presentation" | "exam" | "record" | "other";

export interface TaskDoc {
  id: string;
  studentId: string;
  title: string;
  /** Free-text detail — what to prepare, what to bring, where to submit. */
  notes: string;
  kind: TaskKind;
  /** ISO date (yyyy-MM-dd). The deadline the countdown is measured against. */
  dueDate: string;
  /** Optional "HH:mm" — a submission window, not just a day. */
  dueTime: string | null;
  /**
   * Links the task to a subject so it can surface on that subject's class in
   * the timetable ("presentation due in this class"). Null for anything not
   * tied to a subject.
   */
  subjectId: string | null;
  done: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  assignment: "Assignment",
  presentation: "Presentation",
  exam: "Exam",
  record: "Record / Lab",
  other: "Reminder",
};
