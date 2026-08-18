import 'package:flutter_test/flutter_test.dart';
import 'package:handy/logic/planning.dart';
import 'package:handy/models/timetable_entry.dart';

/// Turning "attend 13 more" into a date, off the real timetable.
///
/// The function this replaced divided the classes needed by the average number
/// of classes a day across every subject. That is a different quantity, and the
/// difference is not small: the last test here is the case it got wrong by a
/// factor of ten while sounding certain.
void main() {
  TimetableEntry at(int weekday, String subject, {int period = 1, String type = 'lecture'}) =>
      TimetableEntry(
        id: '$subject-$weekday-$period',
        timetableVersionId: 'v1',
        dayOfWeek: weekday,
        startTime: '09:30',
        endTime: '10:20',
        subjectId: subject,
        facultyName: 'F',
        room: 'RB-221',
        block: 'Ramanujan Bhavan',
        periodNo: period,
        strength: 72,
        opted: 70,
        type: type,
        active: true,
      );

  // A Sunday, so "tomorrow" is Monday and the arithmetic is easy to follow.
  final sunday = DateTime(2026, 3, 1);

  group('daysToAttend', () {
    test('a subject meeting once a week takes a week per class', () {
      // Tuesdays only. Three more classes is three Tuesdays: 3, 10, 17 March.
      final plan = daysToAttend(
        classes: 3,
        entries: [at(2, 'adsaa')],
        from: sunday,
        subjectId: 'adsaa',
      );
      expect(plan?.days, 3);
      expect(plan?.on, DateTime(2026, 3, 17));
    });

    test('two periods on one day count as two classes', () {
      // A double period on Monday: two classes in one day of turning up.
      final plan = daysToAttend(
        classes: 2,
        entries: [at(1, 'lab', period: 1), at(1, 'lab', period: 2)],
        from: sunday,
        subjectId: 'lab',
      );
      expect(plan?.days, 1);
      expect(plan?.on, DateTime(2026, 3, 2));
    });

    test('a part-filled day still counts as a whole day of turning up', () {
      // Needing 1 of a Monday double still means going in on the Monday.
      final plan = daysToAttend(
        classes: 1,
        entries: [at(1, 'lab', period: 1), at(1, 'lab', period: 2)],
        from: sunday,
        subjectId: 'lab',
      );
      expect(plan?.days, 1);
    });

    test('other subjects on the timetable do not count toward this one', () {
      // Four classes a week overall, but only one of them is ADSAA.
      final week = [
        at(1, 'other'),
        at(2, 'adsaa'),
        at(3, 'other'),
        at(4, 'other'),
      ];
      expect(daysToAttend(classes: 2, entries: week, from: sunday, subjectId: 'adsaa')?.days, 2);
      // Without a subject it is every class, so two arrive on Mon and Tue.
      expect(daysToAttend(classes: 2, entries: week, from: sunday)?.days, 2);
    });

    test('starts from tomorrow — today is already decided', () {
      // From a Monday, a Monday-only subject waits a full week.
      final monday = DateTime(2026, 3, 2);
      final plan = daysToAttend(
        classes: 1,
        entries: [at(1, 'adsaa')],
        from: monday,
        subjectId: 'adsaa',
      );
      expect(plan?.on, DateTime(2026, 3, 9));
    });

    test('inactive entries are not classes anyone can attend', () {
      final dropped = TimetableEntry(
        id: 'x',
        timetableVersionId: 'v1',
        dayOfWeek: 2,
        startTime: '09:30',
        endTime: '10:20',
        subjectId: 'adsaa',
        facultyName: 'F',
        room: 'R',
        block: 'B',
        periodNo: 1,
        strength: 0,
        opted: 0,
        type: 'lecture',
        active: false,
      );
      expect(
        daysToAttend(classes: 1, entries: [dropped], from: sunday, subjectId: 'adsaa'),
        isNull,
      );
    });

    test('says nothing rather than guessing when it cannot answer', () {
      // No timetable at all — the portal-login colleges publish none.
      expect(daysToAttend(classes: 5, entries: [], from: sunday), isNull);
      // A subject that never meets.
      expect(
        daysToAttend(classes: 5, entries: [at(1, 'other')], from: sunday, subjectId: 'adsaa'),
        isNull,
      );
      // Nothing to attend.
      expect(daysToAttend(classes: 0, entries: [at(1, 'adsaa')], from: sunday), isNull);
      // Further out than the horizon: once a week cannot deliver 40 in 180 days.
      expect(
        daysToAttend(
          classes: 40,
          entries: [at(1, 'adsaa')],
          from: sunday,
          subjectId: 'adsaa',
          horizonDays: 60,
        ),
        isNull,
      );
    });

    test('narrows to a kind of period, for the next Technical Hour', () {
      // CodeForge has no target and no subject of its own, but the period it
      // happens in is on the timetable like anything else.
      final week = [
        at(1, 'maths'),
        at(4, 'skills', type: 'technical'),
        at(5, 'maths'),
      ];
      final plan = daysToAttend(
        classes: 1,
        entries: week,
        from: sunday,
        type: 'technical',
      );
      // Thursday, not Monday — the lecture on Monday is not a Technical Hour.
      expect(plan?.on, DateTime(2026, 3, 5));

      // And a timetable with no Technical Hour says nothing rather than
      // pointing at the next lecture.
      expect(
        daysToAttend(classes: 1, entries: [at(1, 'maths')], from: sunday, type: 'technical'),
        isNull,
      );
    });

    test('the case the old average got wrong by a month', () {
      // The real shape of the bug. ADSAA meets three times a week; the week
      // holds sixteen classes across five days, so the old code divided 13 by
      // 3.2 and answered "about 4 days". Thirteen ADSAA classes is five weeks.
      final week = [
        for (final day in [1, 2, 3, 4, 5])
          for (var period = 1; period <= 3; period++)
            at(day, day <= 3 && period == 1 ? 'adsaa' : 'other', period: period),
        at(6, 'other'),
      ];

      final plan = daysToAttend(
        classes: 13,
        entries: week,
        from: sunday,
        subjectId: 'adsaa',
      );
      // Three a week: 13 needs five weeks, landing on the fifth Monday.
      expect(plan?.days, 13);
      expect(plan?.on, DateTime(2026, 3, 30));
      // And it is emphatically not "about 4 days".
      expect(plan!.on.difference(sunday).inDays, greaterThan(28));
    });
  });

  group('shortWhen', () {
    // Four screens render one of these dates now — the home card, the subjects
    // list, the subject page and the planner. They have to word it identically
    // or the same date reads as two different answers.
    final now = DateTime(2026, 3, 1); // Sunday

    test('names tomorrow rather than dating it', () {
      expect(shortWhen(DateTime(2026, 3, 2), now: now), 'tomorrow');
    });

    test('uses a weekday inside the coming week', () {
      expect(shortWhen(DateTime(2026, 3, 5), now: now), 'Thu');
      expect(shortWhen(DateTime(2026, 3, 7), now: now), 'Sat');
    });

    test('falls back to a date once a weekday would be ambiguous', () {
      // Seven days out, "Sunday" could mean either one.
      expect(shortWhen(DateTime(2026, 3, 8), now: now), '8 Mar');
      expect(shortWhen(DateTime(2026, 5, 12), now: now), '12 May');
    });

    test('does not call today tomorrow', () {
      expect(shortWhen(now, now: now), '1 Mar');
    });
  });
}
