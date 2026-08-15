import 'package:flutter_test/flutter_test.dart';
import 'package:handy/logic/attendance.dart';
import 'package:handy/logic/deadlines.dart';
import 'package:handy/logic/planning.dart';
import 'package:handy/models/models.dart';
import 'package:handy/logic/timetable.dart';
import 'package:handy/models/timetable_entry.dart';

/// These mirror the web app's vitest suites case for case
/// (src/lib/calculations/*.test.ts). A student comparing the phone and the
/// website must never see two different answers, so both sides are pinned.
void main() {
  group('attendance', () {
    test('returns null rather than 0% when nothing has been held', () {
      expect(calculateAttendance(0, 0), isNull);
      expect(roundPercentage(calculateAttendance(0, 0)), isNull);
    });

    test('matches the portal figures we capture', () {
      // 32/47 is the real DMS row from the sample capture.
      expect(roundPercentage(calculateAttendance(32, 47)), 68.09);
      expect(roundPercentage(calculateAttendance(183, 260)), 70.38);
      expect(roundPercentage(calculateAttendance(51, 51)), 100);
    });

    test('counts classes needed to reach a target', () {
      // (32+n)/(47+n) >= 0.75  =>  0.25n >= 3.25  =>  n >= 13
      expect(classesNeededForTarget(32, 47, 75), 13);
      expect(classesNeededForTarget(40, 50, 75), 0); // already above
    });

    test('counts how many classes can still be skipped', () {
      expect(classesCanSkip(40, 50, 75), 3); // 40/53 = 75.4%, 40/54 = 74.1%
      expect(classesCanSkip(32, 47, 75), 0); // already below target
    });
  });

  group('deadlines', () {
    final today = DateTime.utc(2026, 8, 15);

    test('counts whole days remaining', () {
      final d = getDeadline(DateTime.utc(2026, 8, 17), today);
      expect(d.daysLeft, 2);
      expect(d.label, '2 days left');
    });

    test('names today and tomorrow instead of counting them', () {
      expect(getDeadline(today, today).urgency, Urgency.today);
      expect(getDeadline(DateTime.utc(2026, 8, 16), today).label, 'Due tomorrow');
    });

    test('reports overdue positively and singularises one day', () {
      expect(getDeadline(DateTime.utc(2026, 8, 14), today).label, '1 day overdue');
      expect(getDeadline(DateTime.utc(2026, 8, 12), today).label, '3 days overdue');
    });

    test('separates soon from later', () {
      expect(getDeadline(DateTime.utc(2026, 8, 18), today).urgency, Urgency.soon);
      expect(getDeadline(DateTime.utc(2026, 8, 19), today).urgency, Urgency.later);
    });

    test('crosses a month boundary', () {
      expect(getDeadline(DateTime.utc(2026, 9, 1), DateTime.utc(2026, 8, 30)).daysLeft, 2);
    });
  });

  planningTests();

  group('timetable', () {
    TimetableEntry entry(int day, int period, String start, String end) => TimetableEntry(
          id: 'd${day}p$period',
          timetableVersionId: 'v1',
          dayOfWeek: day,
          startTime: start,
          endTime: end,
          subjectId: 's1',
          facultyName: 'F',
          room: 'RB-221',
          block: 'Ramanujan Bhavan',
          periodNo: period,
          strength: 72,
          opted: 70,
          type: 'lecture',
          active: true,
        );

    // Monday has periods 1-3; Tuesday skips period 2.
    final week = [
      entry(1, 1, '09:30', '10:20'),
      entry(1, 2, '10:30', '11:20'),
      entry(1, 3, '11:20', '12:10'),
      entry(2, 1, '09:30', '10:20'),
      entry(2, 3, '11:20', '12:10'),
    ];

    test('finds the gap and recovers its time from another day', () {
      final free = freePeriods(week, 2);
      expect(free.length, 1);
      expect(free.first.periodNo, 2);
      expect(free.first.startTime, '10:30');
    });

    test('returns nothing for a fully booked day', () {
      expect(freePeriods(week, 1), isEmpty);
    });

    test('treats a day with no classes as entirely free', () {
      expect(freePeriods(week, 4).map((f) => f.periodNo), [1, 2, 3]);
    });

    test('merges consecutive periods of the same subject into one block', () {
      // Monday's three periods are all the same subject, back to back — that's
      // one three-hour session, not three classes.
      final blocks = classBlocksForDay(week, 1);
      expect(blocks.length, 1);
      expect(blocks.first.periods, 3);
      expect(blocks.first.startTime, '09:30');
      expect(blocks.first.endTime, '12:10');
      expect(blocks.first.isMerged, isTrue);
    });

    test('keeps a gap from merging two sessions of the same subject', () {
      final split = [
        entry(3, 1, '09:30', '10:20'),
        entry(3, 5, '13:50', '14:40'), // same subject, but after lunch
      ];
      expect(classBlocksForDay(split, 3).length, 2);
    });

    test('finds the class you are heading to, not one already finished', () {
      expect(nextEntry(week, 1, '10:25')?.periodNo, 2);
      expect(nextEntry(week, 1, '11:00')?.periodNo, 2); // still in it
      expect(nextEntry(week, 1, '23:00'), isNull);
    });
  });
}


/// Phase 2 of the Deadlines module: joining what is due to when you are free.
void planningTests() {
  TimetableEntry slot(int day, int period, String start, String end) => TimetableEntry(
        id: 'd${day}p$period',
        timetableVersionId: 'v1',
        dayOfWeek: day,
        startTime: start,
        endTime: end,
        subjectId: 's1',
        facultyName: 'F',
        room: 'RB-221',
        block: 'Ramanujan Bhavan',
        periodNo: period,
        strength: 72,
        opted: 70,
        type: 'lecture',
        active: true,
      );

  Task task(String id, DateTime due, {bool done = false, TaskKind kind = TaskKind.assignment}) =>
      Task(
        id: id,
        title: id,
        notes: '',
        kind: kind,
        dueDate: due,
        dueTime: null,
        subjectId: null,
        done: done,
      );

  group('planning', () {
    // Monday is full; Tuesday is missing period 2.
    final week = [
      slot(1, 1, '09:30', '10:20'),
      slot(1, 2, '10:30', '11:20'),
      slot(1, 3, '11:20', '12:10'),
      slot(2, 1, '09:30', '10:20'),
      slot(2, 3, '11:20', '12:10'),
    ];

    test('offers the gap before the deadline, and never today', () {
      // Saturday 15 Aug 2026, due the following Wednesday.
      final slots = plannableSlots(week, DateTime(2026, 8, 19), DateTime(2026, 8, 15));
      expect(slots, isNotEmpty);
      expect(slots.every((s) => s.date.isAfter(DateTime(2026, 8, 15))), isTrue);
      expect(slots.every((s) => !s.date.isAfter(DateTime(2026, 8, 19))), isTrue);
      // Sunday the 16th is never offered.
      expect(slots.any((s) => s.date.weekday == DateTime.sunday), isFalse);
    });

    test('finds Tuesday period 2, which is the only real gap', () {
      final slots = plannableSlots(week, DateTime(2026, 8, 18), DateTime(2026, 8, 15));
      final tuesday = slots.where((s) => s.dayOfWeek == 2).toList();
      expect(tuesday.map((s) => s.periodNo), contains(2));
      expect(tuesday.map((s) => s.startTime), contains('10:30'));
    });

    test('offers nothing when the deadline is tomorrow and tomorrow is full', () {
      // Sunday 16th is skipped and Monday 17th has no gaps.
      expect(plannableSlots(week, DateTime(2026, 8, 17), DateTime(2026, 8, 16)), isEmpty);
    });

    test('counts the week ahead, folding overdue onto today', () {
      final today = DateTime(2026, 8, 15);
      final counts = workloadByDay([
        task('late', DateTime(2026, 8, 10)),
        task('today', DateTime(2026, 8, 15)),
        task('thu', DateTime(2026, 8, 20)),
        task('also-thu', DateTime(2026, 8, 20)),
        task('far', DateTime(2026, 9, 30)),
        task('done', DateTime(2026, 8, 20), done: true),
      ], today);

      expect(counts.length, 7);
      expect(counts[0], 2); // overdue + due today
      expect(counts[5], 2); // the 20th
      expect(counts.reduce((a, b) => a + b), 4); // 'far' and 'done' excluded
    });

    test('promotes the nearest exam, ignoring distant ones and other kinds', () {
      final today = DateTime(2026, 8, 15);
      expect(
        nextExam([
          task('assignment', DateTime(2026, 8, 18)),
          task('far-exam', DateTime(2026, 12, 1), kind: TaskKind.exam),
          task('near-exam', DateTime(2026, 8, 25), kind: TaskKind.exam),
        ], today)?.id,
        'near-exam',
      );
      expect(nextExam([task('a', DateTime(2026, 8, 18))], today), isNull);
    });
  });
}
