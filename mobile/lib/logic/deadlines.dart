/// Deadline countdowns — ported from src/lib/calculations/deadlines.ts.
library;

enum Urgency { overdue, today, tomorrow, soon, later, done }

class Deadline {
  const Deadline({required this.daysLeft, required this.urgency, required this.label});

  /// Whole days from today. Negative once the due date has passed.
  final int daysLeft;
  final Urgency urgency;

  /// Short human phrase: "2 days left", "Due today", "3 days overdue".
  final String label;
}

/// The window where a student can still act but shouldn't wait.
const int soonDays = 3;

/// Compared as whole days: a deadline is a date, so using timestamps would make
/// "1 day left" flip at an arbitrary hour of the evening.
Deadline getDeadline(DateTime dueDate, DateTime today, {bool done = false}) {
  final due = DateTime.utc(dueDate.year, dueDate.month, dueDate.day);
  final now = DateTime.utc(today.year, today.month, today.day);
  final daysLeft = due.difference(now).inDays;

  if (done) return Deadline(daysLeft: daysLeft, urgency: Urgency.done, label: 'Done');
  if (daysLeft < 0) {
    final overdue = daysLeft.abs();
    return Deadline(
      daysLeft: daysLeft,
      urgency: Urgency.overdue,
      label: overdue == 1 ? '1 day overdue' : '$overdue days overdue',
    );
  }
  if (daysLeft == 0) {
    return Deadline(daysLeft: 0, urgency: Urgency.today, label: 'Due today');
  }
  if (daysLeft == 1) {
    return Deadline(daysLeft: 1, urgency: Urgency.tomorrow, label: 'Due tomorrow');
  }
  return Deadline(
    daysLeft: daysLeft,
    urgency: daysLeft <= soonDays ? Urgency.soon : Urgency.later,
    label: '$daysLeft days left',
  );
}
