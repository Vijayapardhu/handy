import type { TaskDoc, TaskRepeat } from "@/types/task";

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

export interface UrgencyCounts {
  overdue: number;
  today: number;
  /** Includes today and tomorrow — "this week" as a student means it, not a strict 2-7 day band. */
  week: number;
}

/** How many open tasks fall into each urgency band. Feeds the Deadlines filter chips. */
export function countByUrgency(tasks: TaskDoc[], todayIso: string): UrgencyCounts {
  const open = sortByUrgency(tasks, todayIso);
  let overdue = 0;
  let today = 0;
  let week = 0;
  for (const task of open) {
    const days = getDeadline(task.dueDate, todayIso).daysLeft;
    if (days < 0) overdue += 1;
    if (days === 0) today += 1;
    if (days >= 0 && days <= 7) week += 1;
  }
  return { overdue, today, week };
}

/**
 * The one sentence the Tasks hero leads with — the answer to "what actually
 * needs me right now", picked in the order a student would triage it
 * themselves: what's already late outranks what's merely due, which outranks
 * what's simply next.
 */
export function focusMessage(tasks: TaskDoc[], todayIso: string): string {
  const open = sortByUrgency(tasks, todayIso);
  if (open.length === 0) return "Nothing on your plate — good time to get ahead.";

  const counts = countByUrgency(tasks, todayIso);
  if (counts.overdue > 0) {
    return counts.overdue === 1 ? "1 thing overdue — clear that first." : `${counts.overdue} things overdue — clear those first.`;
  }
  if (counts.today > 0) {
    return counts.today === 1 ? "1 thing due today." : `${counts.today} things due today.`;
  }

  const next = open[0];
  const deadline = getDeadline(next.dueDate, todayIso);
  if (deadline.daysLeft <= SOON_DAYS) {
    return `${next.title} — ${deadline.label.toLowerCase()}.`;
  }
  return open.length === 1 ? "1 thing on your list, nothing urgent yet." : `${open.length} things on your list, nothing urgent yet.`;
}

/**
 * The next due date after completing a repeating task. Mirrors
 * Repository.nextOccurrence in mobile/lib/data/repository.dart — months are
 * added by calendar rather than by 30 days, so "every month on the 5th"
 * stays on the 5th.
 */
export function nextOccurrence(fromIso: string, repeat: TaskRepeat): string {
  const [y, m, d] = fromIso.split("-").map(Number);
  switch (repeat) {
    case "daily":
      return addUtcDays(y, m, d, 1);
    case "weekly":
      return addUtcDays(y, m, d, 7);
    case "fortnightly":
      return addUtcDays(y, m, d, 14);
    case "monthly": {
      const date = new Date(Date.UTC(y, m - 1, d));
      date.setUTCMonth(date.getUTCMonth() + 1);
      return date.toISOString().slice(0, 10);
    }
    case "none":
      return fromIso;
  }
}

function addUtcDays(y: number, m: number, d: number, days: number): string {
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
