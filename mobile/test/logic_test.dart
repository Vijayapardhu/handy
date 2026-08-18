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
  _daysGroup();

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
  markTests();
  leaveTests();
  recordTests();
  leaveRecoveryTests();
  pinningTests();

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

/// Self-marked attendance: the student's own account, carried on top of the
/// college's, without either being able to corrupt the other.
void markTests() {
  AttendanceMark mark(String date, MarkStatus status, {int periods = 1}) => AttendanceMark(
        id: date + status.name,
        subjectId: 's1',
        date: date,
        status: status,
        startTime: '09:30',
        periods: periods,
      );

  group('projected attendance', () {
    test('is the portal figure untouched when nothing is marked', () {
      final p = projectAttendance(attended: 32, held: 47, marks: []);
      expect(p.attended, 32);
      expect(p.held, 47);
      expect(p.percent, 68.09);
      // Nothing added means nothing projected — the UI must not claim an
      // estimate it has not made.
      expect(p.isProjected, isFalse);
    });

    test('carries attendance forward since the last sync', () {
      final p = projectAttendance(
        attended: 32,
        held: 47,
        since: '2026-08-10',
        marks: [
          mark('2026-08-11', MarkStatus.present),
          mark('2026-08-12', MarkStatus.present),
          mark('2026-08-13', MarkStatus.absent),
        ],
      );
      expect(p.attended, 34);
      expect(p.held, 50);
      expect(p.addedFromMarks, 3);
      expect(p.isProjected, isTrue);
    });

    test('ignores marks the portal has already counted', () {
      // Marking a class then syncing must not count that class twice — which
      // would punish exactly the students who bother to mark.
      final p = projectAttendance(
        attended: 32,
        held: 47,
        since: '2026-08-15',
        marks: [
          mark('2026-08-11', MarkStatus.present),
          mark('2026-08-15', MarkStatus.present),
          mark('2026-08-16', MarkStatus.present),
        ],
      );
      expect(p.attended, 33);
      expect(p.held, 48);
    });

    test('a cancelled class moves neither number', () {
      final p = projectAttendance(
        attended: 32,
        held: 47,
        marks: [mark('2026-08-16', MarkStatus.cancelled)],
      );
      expect(p.attended, 32);
      expect(p.held, 47);
      expect(p.isProjected, isFalse);
    });

    test('a merged block counts once per period', () {
      // A three-period lab you sat through is three classes to the register.
      final p = projectAttendance(
        attended: 32,
        held: 47,
        marks: [mark('2026-08-16', MarkStatus.present, periods: 3)],
      );
      expect(p.attended, 35);
      expect(p.held, 50);
    });

    test('missing every marked class drags the projection down', () {
      final p = projectAttendance(
        attended: 40,
        held: 50,
        marks: [
          mark('2026-08-16', MarkStatus.absent),
          mark('2026-08-17', MarkStatus.absent, periods: 2),
        ],
      );
      expect(p.attended, 40);
      expect(p.held, 53);
      expect(p.percent, 75.47);
    });
  });
}

/// The leave planner: what a day off actually costs, subject by subject.
void leaveTests() {
  TimetableEntry slot(int day, String subjectId, String start) => TimetableEntry(
        id: '$day-$subjectId-$start',
        timetableVersionId: 'v1',
        dayOfWeek: day,
        startTime: start,
        endTime: '10:20',
        subjectId: subjectId,
        facultyName: 'F',
        room: 'RB-221',
        block: 'Ramanujan Bhavan',
        periodNo: 1,
        strength: 72,
        opted: 70,
        type: 'lecture',
        active: true,
      );

  Subject subject(String id) => Subject(
        id: id,
        code: id.toUpperCase(),
        name: id,
        shortName: id,
        facultyName: 'F',
      );

  AttendanceSummary summary(String id, int attended, int held) =>
      AttendanceSummary(subjectId: id, attended: attended, held: held);

  group('leave cost', () {
    // Monday: two periods of maths, one of physics. Tuesday: one of physics.
    final entries = [
      slot(1, 'maths', '09:30'),
      slot(1, 'maths', '10:30'),
      slot(1, 'physics', '11:20'),
      slot(2, 'physics', '09:30'),
    ];
    final subjects = [subject('maths'), subject('physics')];

    test('counts periods missed, not classes', () {
      // Monday 17 Aug 2026.
      final costs = leaveCost(
        entries: entries,
        subjects: subjects,
        summaries: [summary('maths', 40, 50), summary('physics', 40, 50)],
        from: DateTime(2026, 8, 17),
        to: DateTime(2026, 8, 17),
      );

      expect(costs.firstWhere((c) => c.subject.id == 'maths').periods, 2);
      expect(costs.firstWhere((c) => c.subject.id == 'physics').periods, 1);
    });

    test('missing raises the denominator and leaves attended alone', () {
      final costs = leaveCost(
        entries: entries,
        subjects: subjects,
        summaries: [summary('maths', 40, 50), summary('physics', 40, 50)],
        from: DateTime(2026, 8, 17),
        to: DateTime(2026, 8, 17),
      );

      final maths = costs.firstWhere((c) => c.subject.id == 'maths');
      expect(maths.before, 80);
      // 40/52 — the classes are still held, you simply were not there.
      expect(maths.after, 76.92);
    });

    test('flags a subject that crosses below the target', () {
      final costs = leaveCost(
        entries: entries,
        subjects: subjects,
        // 38/50 is 76%; two more held drops it to 73.08%.
        summaries: [summary('maths', 38, 50), summary('physics', 45, 50)],
        from: DateTime(2026, 8, 17),
        to: DateTime(2026, 8, 17),
      );

      expect(costs.firstWhere((c) => c.subject.id == 'maths').dropsBelow(75), isTrue);
      expect(costs.firstWhere((c) => c.subject.id == 'physics').dropsBelow(75), isFalse);
    });

    test('skips Sunday, so a weekend costs only its taught days', () {
      // Sat 15th has nothing scheduled, Sun 16th is skipped, Mon 17th costs.
      final costs = leaveCost(
        entries: entries,
        subjects: subjects,
        summaries: [summary('maths', 40, 50), summary('physics', 40, 50)],
        from: DateTime(2026, 8, 15),
        to: DateTime(2026, 8, 17),
      );
      expect(costs.firstWhere((c) => c.subject.id == 'maths').periods, 2);
    });

    test('adds up across a range, and sorts the worst outcome first', () {
      // Mon + Tue: maths 2, physics 2.
      final costs = leaveCost(
        entries: entries,
        subjects: subjects,
        summaries: [summary('maths', 45, 50), summary('physics', 30, 50)],
        from: DateTime(2026, 8, 17),
        to: DateTime(2026, 8, 18),
      );

      expect(costs.firstWhere((c) => c.subject.id == 'physics').periods, 2);
      // Physics ends lowest, so it leads — the subject to warn about is the
      // one that ends up worst, not the one you miss most of.
      expect(costs.first.subject.id, 'physics');
    });

    test('returns nothing for a backwards range', () {
      expect(
        leaveCost(
          entries: entries,
          subjects: subjects,
          summaries: const [],
          from: DateTime(2026, 8, 18),
          to: DateTime(2026, 8, 17),
        ),
        isEmpty,
      );
    });
  });
}

/// The completed pile, read as a record.
void recordTests() {
  Task done(String id, String due, String? completed) => Task(
        id: id,
        title: id,
        notes: '',
        kind: TaskKind.assignment,
        dueDate: DateTime.parse(due),
        dueTime: null,
        subjectId: null,
        done: true,
        completedAt: completed,
      );

  group('deadline record', () {
    final today = DateTime(2026, 8, 15);

    test('counts finishing on the due day as on time', () {
      final r = deadlineRecord([done('a', '2026-08-10', '2026-08-10T09:00:00')], today);
      expect(r.completed, 1);
      expect(r.onTime, 1);
      expect(r.onTimeRate, 100);
    });

    test('counts a day late as late', () {
      final r = deadlineRecord([done('a', '2026-08-10', '2026-08-11T09:00:00')], today);
      expect(r.onTime, 0);
      expect(r.onTimeRate, 0);
      expect(r.streak, 0);
    });

    test('breaks the streak on the first late one, most recent first', () {
      final r = deadlineRecord([
        done('newest', '2026-08-14', '2026-08-14T09:00:00'),
        done('newer', '2026-08-13', '2026-08-13T09:00:00'),
        done('late', '2026-08-12', '2026-08-13T09:00:00'),
        done('oldest', '2026-08-11', '2026-08-11T09:00:00'),
      ], today);

      // Two recent punctual ones, then a late one stops it — a streak that
      // survived a missed deadline would not be measuring anything.
      expect(r.streak, 2);
      expect(r.completed, 4);
      expect(r.onTime, 3);
    });

    test('counts only this calendar month as this month', () {
      final r = deadlineRecord([
        done('aug', '2026-08-02', '2026-08-02T09:00:00'),
        done('jul', '2026-07-30', '2026-07-30T09:00:00'),
      ], today);
      expect(r.thisMonth, 1);
      expect(r.completed, 2);
    });

    test('does not judge tasks with no completion date', () {
      // Written before completedAt was read back. Counting them as on time
      // would invent a record; counting them as late would invent a worse one.
      final r = deadlineRecord([
        done('unknown', '2026-08-10', null),
        done('known', '2026-08-11', '2026-08-11T09:00:00'),
      ], today);
      expect(r.completed, 1);
      expect(r.onTime, 1);
    });

    test('is empty when nothing is done', () {
      final r = deadlineRecord(const [], today);
      expect(r.completed, 0);
      expect(r.onTimeRate, isNull);
      expect(r.streak, 0);
    });
  });
}

/// Recovery, and what a leave does to the overall figure.
void leaveRecoveryTests() {
  TimetableEntry slot(int day, String subjectId, String start) => TimetableEntry(
        id: '$day-$subjectId-$start',
        timetableVersionId: 'v1',
        dayOfWeek: day,
        startTime: start,
        endTime: '10:20',
        subjectId: subjectId,
        facultyName: 'F',
        room: 'RB-221',
        block: 'RB',
        periodNo: 1,
        strength: 72,
        opted: 70,
        type: 'lecture',
        active: true,
      );

  Subject subject(String id) =>
      Subject(id: id, code: id, name: id, shortName: id, facultyName: 'F');

  AttendanceSummary summary(String id, int attended, int held) =>
      AttendanceSummary(subjectId: id, attended: attended, held: held);

  group('leave recovery', () {
    final entries = [
      slot(1, 'maths', '09:30'),
      slot(1, 'maths', '10:30'),
      slot(1, 'physics', '11:20'),
    ];
    final subjects = [subject('maths'), subject('physics')];

    List<LeaveCost> costsFor(List<AttendanceSummary> summaries) => leaveCost(
          entries: entries,
          subjects: subjects,
          summaries: summaries,
          from: DateTime(2026, 8, 17),
          to: DateTime(2026, 8, 17),
        );

    test('asks for nothing back when the leave stays above target', () {
      // 45/50 is 90%; two more held is 45/52, still 86.5%.
      final costs = costsFor([summary('maths', 45, 50), summary('physics', 45, 50)]);
      expect(costs.firstWhere((c) => c.subject.id == 'maths').recovery, 0);
    });

    test('counts the classes needed to climb back out', () {
      // 38/50 = 76%. Missing two makes it 38/52 = 73.08%.
      // (38+n)/(52+n) >= 0.75  =>  0.25n >= 1  =>  n >= 4
      final costs = costsFor([summary('maths', 38, 50), summary('physics', 45, 50)]);
      final maths = costs.firstWhere((c) => c.subject.id == 'maths');
      expect(maths.after, 73.08);
      expect(maths.recovery, 4);
    });

    test('counts recovery from after the leave, not from today', () {
      // Already below before the leave, so recovery must be larger than the
      // figure a student would get from today's position.
      final costs = costsFor([summary('maths', 30, 50), summary('physics', 45, 50)]);
      final maths = costs.firstWhere((c) => c.subject.id == 'maths');
      expect(maths.recovery, greaterThan(classesNeededForTarget(30, 50, 75)));
    });

    test('totals the overall figure and its recovery', () {
      final summaries = [summary('maths', 38, 50), summary('physics', 40, 50)];
      final overall = overallLeaveCost(
        summaries: summaries,
        costs: costsFor(summaries),
      );

      expect(overall.attended, 78);
      expect(overall.heldBefore, 100);
      // Two maths periods and one physics.
      expect(overall.periods, 3);
      expect(overall.heldAfter, 103);
      expect(overall.before, 78);
      expect(overall.after, 75.73);
      // Still above target, so nothing to claw back.
      expect(overall.recovery, 0);
    });

    test('overall recovery kicks in once the leave pushes it below', () {
      final summaries = [summary('maths', 37, 50), summary('physics', 37, 50)];
      final overall = overallLeaveCost(
        summaries: summaries,
        costs: costsFor(summaries),
      );
      expect(overall.after! < 75, isTrue);
      expect(overall.recovery, greaterThan(0));
    });
  });
}

/// Pinning a deadline to a class rather than to a gap.
void pinningTests() {
  TimetableEntry slot(int day, String subjectId, String start, String end, int period) =>
      TimetableEntry(
        id: '$day-$subjectId-$start',
        timetableVersionId: 'v1',
        dayOfWeek: day,
        startTime: start,
        endTime: end,
        subjectId: subjectId,
        facultyName: 'F',
        room: 'RB-221',
        block: 'RB',
        periodNo: period,
        strength: 72,
        opted: 70,
        type: 'lecture',
        active: true,
      );

  group('pinning to a class', () {
    // Monday: maths then physics. Tuesday: maths only, leaving gaps.
    final week = [
      slot(1, 'maths', '09:30', '10:20', 1),
      slot(1, 'physics', '10:30', '11:20', 2),
      slot(2, 'maths', '09:30', '10:20', 1),
    ];
    final names = {'maths': 'MA', 'physics': 'PH'};
    final today = DateTime(2026, 8, 15); // Saturday

    test('offers classes instead of gaps when asked', () {
      final slots = plannableSlots(
        week, DateTime(2026, 8, 18), today,
        freePeriodsOnly: false, shortNames: names,
      );
      expect(slots, isNotEmpty);
      expect(slots.every((s) => s.isClass), isTrue);
      expect(slots.map((s) => s.label), contains('MA'));
    });

    test('narrows to the deadline own subject', () {
      final slots = plannableSlots(
        week, DateTime(2026, 8, 18), today,
        freePeriodsOnly: false, subjectId: 'physics', shortNames: names,
      );
      // Only Monday's physics falls in range, and no maths at all.
      expect(slots.map((s) => s.label).toSet(), {'PH'});
    });

    test('labels a free period as one', () {
      final slots = plannableSlots(week, DateTime(2026, 8, 18), today);
      expect(slots, isNotEmpty);
      expect(slots.every((s) => s.label == 'Free period'), isTrue);
      expect(slots.every((s) => !s.isClass), isTrue);
    });

    test('merges a multi-period class into one offer', () {
      // A three-period lab should be offered once, not three times.
      final lab = [
        slot(1, 'lab', '09:30', '10:20', 1),
        slot(1, 'lab', '10:30', '11:20', 2),
        slot(1, 'lab', '11:20', '12:10', 3),
      ];
      final slots = plannableSlots(
        lab, DateTime(2026, 8, 18), today,
        freePeriodsOnly: false, shortNames: {'lab': 'LAB'},
      );
      expect(slots.where((s) => s.dayOfWeek == 1).length, 1);
      expect(slots.first.startTime, '09:30');
      expect(slots.first.endTime, '12:10');
    });

    test('still never offers today or a Sunday', () {
      final slots = plannableSlots(
        week, DateTime(2026, 8, 20), today,
        freePeriodsOnly: false, shortNames: names,
      );
      expect(slots.every((s) => s.date.isAfter(today)), isTrue);
      expect(slots.any((s) => s.date.weekday == DateTime.sunday), isFalse);
    });
  });
}

void _daysGroup() {
}
