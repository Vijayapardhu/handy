import type { TaskDoc } from "@/types/task";

/**
 * How a deadline reads to a student. The urgency band drives colour and
 * ordering, so it's derived once here rather than re-decided by each screen.
 */
export type DeadlineUrgency = "overdue" | "today" | "tomorrow" | "soon" | "later" | "done";

export interface Deadline {
  /** Whole days from today. Negative when the due date has passed. */
  daysLeft: number;
  urgency: DeadlineUrgency;
  /** Short human phrase: "2 days left", "Due today", "3 days overdue". */
  label: string;
}

/** "soon" covers the window where a student can still act but shouldn't wait. */
const SOON_DAYS = 3;

function toUtcDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * @param dueDate ISO date (yyyy-MM-dd)
 * @param todayIso ISO date for "now" — passed in rather than read from the
 *        clock so this stays pure and testable.
 */
export function getDeadline(dueDate: string, todayIso: string, done = false): Deadline {
  // Compared as whole UTC days: a deadline is a date, and using timestamps
  // would make "1 day left" flip at an arbitrary hour.
  const daysLeft = Math.round((toUtcDay(dueDate) - toUtcDay(todayIso)) / 86_400_000);

  if (done) return { daysLeft, urgency: "done", label: "Done" };
  if (daysLeft < 0) {
    const overdue = Math.abs(daysLeft);
    return {
      daysLeft,
      urgency: "overdue",
      label: overdue === 1 ? "1 day overdue" : `${overdue} days overdue`,
    };
  }
  if (daysLeft === 0) return { daysLeft, urgency: "today", label: "Due today" };
  if (daysLeft === 1) return { daysLeft, urgency: "tomorrow", label: "Due tomorrow" };
  if (daysLeft <= SOON_DAYS) return { daysLeft, urgency: "soon", label: `${daysLeft} days left` };
  return { daysLeft, urgency: "later", label: `${daysLeft} days left` };
}

/**
 * Open tasks, most urgent first; completed ones dropped. Overdue sorts above
 * due-today because it needs action more, not less.
 */
export function sortByUrgency(tasks: TaskDoc[], todayIso: string): TaskDoc[] {
  return tasks
    .filter((t) => !t.done)
    .slice()
    .sort((a, b) => {
      const byDate = a.dueDate.localeCompare(b.dueDate);
      if (byDate !== 0) return byDate;
      // Same day: an explicit time beats an all-day task, earliest first.
      return (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99");
    })
    .map((t) => t)
    .filter((t) => getDeadline(t.dueDate, todayIso, t.done).urgency !== "done");
}

/** Tasks worth interrupting the home screen for: overdue, today, tomorrow, or within SOON_DAYS. */
export function getDueSoon(tasks: TaskDoc[], todayIso: string): TaskDoc[] {
  return sortByUrgency(tasks, todayIso).filter(
    (t) => getDeadline(t.dueDate, todayIso, t.done).daysLeft <= SOON_DAYS,
  );
}
