/**
 * A thing the student needs to remember — an assignment due Friday, a
 * presentation in tomorrow's class, a lab record to submit.
 *
 * Deliberately student-authored and student-owned: nothing in the college
 * portal exposes coursework, so this is the one collection in Handy whose
 * contents come from the student rather than from a capture.
 */
export type TaskKind = "assignment" | "presentation" | "exam" | "record" | "other";

/** How often a deadline comes back. Mirrors mobile/lib/models/models.dart's TaskRepeat. */
export type TaskRepeat = "none" | "daily" | "weekly" | "fortnightly" | "monthly";

export const TASK_REPEAT_LABELS: Record<TaskRepeat, string> = {
  none: "Does not repeat",
  daily: "Every day",
  weekly: "Every week",
  fortnightly: "Every two weeks",
  monthly: "Every month",
};

/** One step inside a deadline — "lab record" is never one action. */
export interface Subtask {
  title: string;
  done: boolean;
}

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
  /** Additive, both defaulted to empty/none — documents written before these existed simply have neither. */
  subtasks: Subtask[];
  repeat: TaskRepeat;
  /**
   * The timetable slot this is pinned to, as a weekday (0=Sunday, matching
   * JS Date#getDay()) and a start time ("HH:mm"). Stored as day-and-time
   * rather than a timetable entry id, since entry ids are rebuilt on every
   * sync and a pinned deadline would quietly come unpinned the next time the
   * college republished the timetable.
   */
  attachDay: number | null;
  attachTime: string | null;
  /**
   * What that slot is, in words — "Free period" or a subject's short name.
   * Stored rather than looked up, so a pin outlives the timetable it was made
   * against instead of silently renaming itself.
   */
  attachLabel: string | null;
  /**
   * Days before the due date for this deadline's first nudge. Null means
   * "use whatever the student set as their default" — web has no local
   * reminder mechanism yet, so this is stored for future use rather than
   * acted on.
   */
  leadDays: number | null;
}

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  assignment: "Assignment",
  presentation: "Presentation",
  exam: "Exam",
  record: "Record / Lab",
  other: "Reminder",
};
