/// Turning a deadline into a time to actually do it.
///
/// Handy already knows the two halves nobody else has together: when a student
/// is free, and when their work is due. This is the join. Everything here is
/// pure so it can be tested without a device.
library;

import '../models/models.dart';
import '../models/timetable_entry.dart';
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
