/// Turning a deadline into a time to actually do it.
///
/// Handy already knows the two halves nobody else has together: when a student
/// is free, and when their work is due. This is the join. Everything here is
/// pure so it can be tested without a device.
library;

import '../models/models.dart';
import '../models/timetable_entry.dart';
import 'attendance.dart';
import 'timetable.dart';

/// A free period on a specific date, rather than on an abstract weekday.
class PlannableSlot {
  const PlannableSlot({
    required this.date,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
    required this.periodNo,
  });

  final DateTime date;
  final int dayOfWeek;
  final String startTime;
  final String endTime;
  final int periodNo;
}

/// Every free period between tomorrow and the due date, soonest first.
///
/// Starts from tomorrow rather than today: a slot that has already passed is
/// not a plan, and one starting in ten minutes is not one either. Sundays are
/// skipped because the college does not teach on them, so the timetable has
/// nothing to say about which parts of one are free.
///
/// Capped, because a deadline three weeks out has forty free periods before it
/// and a list of forty is not a decision anyone makes.
List<PlannableSlot> plannableSlots(
  List<TimetableEntry> entries,
  DateTime dueDate,
  DateTime today, {
  int limit = 12,
}) {
  final start = DateTime(today.year, today.month, today.day);
  final due = DateTime(dueDate.year, dueDate.month, dueDate.day);
  final slots = <PlannableSlot>[];

  for (var offset = 1; offset <= 21; offset++) {
    final date = start.add(Duration(days: offset));
    if (date.isAfter(due)) break;
    if (date.weekday == DateTime.sunday) continue;

    final day = date.weekday % 7;
    for (final free in freePeriods(entries, day)) {
      slots.add(PlannableSlot(
        date: date,
        dayOfWeek: day,
        startTime: free.startTime,
        endTime: free.endTime,
        periodNo: free.periodNo,
      ));
      if (slots.length >= limit) return slots;
    }
  }

  return slots;
}

/// How much is due on each of the next [days] days, starting today.
///
/// The point is the shape rather than the total: four things due on Thursday
/// is a problem you can see coming on Monday, and only if something draws it.
List<int> workloadByDay(List<Task> tasks, DateTime today, {int days = 7}) {
  final start = DateTime(today.year, today.month, today.day);
  final counts = List<int>.filled(days, 0);

  for (final task in tasks.where((t) => !t.done)) {
    final due = DateTime(task.dueDate.year, task.dueDate.month, task.dueDate.day);
    final offset = due.difference(start).inDays;
    // Anything overdue lands on today, because that is when it has to be dealt
    // with — a bar in the past would be a fact nobody can act on.
    if (offset < 0) {
      counts[0]++;
    } else if (offset < days) {
      counts[offset]++;
    }
  }

  return counts;
}

/// What a day off would cost, per subject.
///
/// The question a student actually asks before missing a day is not "how many
/// classes are on Tuesday" but "can I afford Tuesday" — and the honest answer
/// depends on where each subject already stands. A day with one lecture in a
/// subject sitting at 76% is cheap; the same day is not cheap if that subject
/// is at 75.4%.
class LeaveCost {
  const LeaveCost({
    required this.subject,
    required this.periods,
    required this.before,
    required this.after,
  });

  final Subject subject;

  /// Periods missed across the whole range, not classes — a three-period lab
  /// costs three.
  final int periods;
  final double? before;
  final double? after;

  /// Crossing the line is the outcome that matters; a percentage falling by a
  /// point is not news unless it lands on the wrong side of the target.
  bool dropsBelow(double target) =>
      before != null && after != null && before! >= target && after! < target;
}

/// The cost of being absent every day from [from] to [to] inclusive.
///
/// Sundays are skipped and days with no classes contribute nothing, so a range
/// spanning a weekend costs only what the taught days in it cost.
List<LeaveCost> leaveCost({
  required List<TimetableEntry> entries,
  required List<Subject> subjects,
  required List<AttendanceSummary> summaries,
  required DateTime from,
  required DateTime to,
}) {
  final start = DateTime(from.year, from.month, from.day);
  final end = DateTime(to.year, to.month, to.day);
  if (end.isBefore(start)) return const [];

  final missed = <String, int>{};
  for (var date = start;
      !date.isAfter(end);
      date = date.add(const Duration(days: 1))) {
    if (date.weekday == DateTime.sunday) continue;
    for (final entry in entriesForDay(entries, date.weekday % 7)) {
      missed.update(entry.subjectId, (n) => n + 1, ifAbsent: () => 1);
    }
  }

  final summaryBySubject = {for (final s in summaries) s.subjectId: s};
  final costs = <LeaveCost>[];

  for (final entry in missed.entries) {
    final subject = subjects.where((s) => s.id == entry.key).firstOrNull;
    if (subject == null) continue;

    final summary = summaryBySubject[entry.key];
    final attended = summary?.attended ?? 0;
    final held = summary?.held ?? 0;

    costs.add(LeaveCost(
      subject: subject,
      periods: entry.value,
      before: roundPercentage(calculateAttendance(attended, held)),
      // Missing raises the denominator only: the classes are still held.
      after: roundPercentage(calculateAttendance(attended, held + entry.value)),
    ));
  }

  // Worst outcome first — the subject a student needs warning about is the one
  // that ends up lowest, not the one they miss most of.
  costs.sort((a, b) => (a.after ?? 999).compareTo(b.after ?? 999));
  return costs;
}

/// The next exam, if one is close enough to be worth a countdown.
///
/// Exams are the one deadline where the countdown itself is the useful thing,
/// so they get promoted out of the list rather than sitting in it.
Task? nextExam(List<Task> tasks, DateTime today, {int withinDays = 30}) {
  final start = DateTime(today.year, today.month, today.day);
  final exams = tasks
      .where((t) => !t.done && t.kind == TaskKind.exam)
      .where((t) {
        final due = DateTime(t.dueDate.year, t.dueDate.month, t.dueDate.day);
        final days = due.difference(start).inDays;
        return days >= 0 && days <= withinDays;
      })
      .toList()
    ..sort((a, b) => a.dueDate.compareTo(b.dueDate));

  return exams.firstOrNull;
}
