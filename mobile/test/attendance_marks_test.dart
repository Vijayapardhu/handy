import 'package:flutter_test/flutter_test.dart';
import 'package:handy/logic/attendance_marks.dart';
import 'package:handy/models/models.dart';

/// Mirrors the dedupe half of src/lib/calculations/attendanceMarks.test.ts.
///
/// Both suites assert the *same winning document* for the same pair of
/// duplicates. That is the whole reason they exist: the two platforms deciding
/// differently is the original double-counting bug in a new disguise.
void main() {
  AttendanceMark at(
    String date, {
    String subject = 'sub1',
    String start = '09:00',
    String id = 'x',
    MarkStatus status = MarkStatus.present,
    String? updatedAt,
  }) =>
      AttendanceMark(
        id: id,
        subjectId: subject,
        date: date,
        status: status,
        startTime: start,
        periods: 1,
        updatedAt: updatedAt,
      );

  // The same class, as each platform used to write it.
  AttendanceMark web(MarkStatus status, {String? updatedAt}) => at(
        '2026-01-01',
        id: 's1_sub1_2026-01-01_09:00',
        status: status,
        updatedAt: updatedAt,
      );
  AttendanceMark app(MarkStatus status, {String? updatedAt}) => at(
        '2026-01-01',
        id: 's1-sub1-2026-01-01-0900',
        status: status,
        updatedAt: updatedAt,
      );

  group('dedupeMarks — the two id schemes that used to double-count', () {
    test('collapses the same class written under both id schemes', () {
      // Held would otherwise be 2 for one class, in every percentage built on
      // these marks.
      expect(dedupeMarks([web(MarkStatus.present), app(MarkStatus.present)]), hasLength(1));
    });

    test('keeps genuinely different classes apart', () {
      final marks = [
        at('2026-01-01'),
        at('2026-01-01', start: '10:30', id: 'b'),
        at('2026-01-01', subject: 'sub2', id: 'c'),
        at('2026-01-02', id: 'd'),
      ];
      expect(dedupeMarks(marks), hasLength(4));
    });

    test('the most recently written wins a disagreement', () {
      final older = app(MarkStatus.present, updatedAt: '2026-01-01T09:00:00.000Z');
      final newer = web(MarkStatus.absent, updatedAt: '2026-01-02T09:00:00.000Z');
      expect(dedupeMarks([older, newer]).single.status, MarkStatus.absent);
      // Arrival order must not change the answer — Firestore guarantees none.
      expect(dedupeMarks([newer, older]).single.status, MarkStatus.absent);
    });

    test('a mark that says when it was written beats one that does not', () {
      final undated = app(MarkStatus.present);
      final dated = web(MarkStatus.absent, updatedAt: '2026-01-02T09:00:00.000Z');
      expect(dedupeMarks([undated, dated]).single.status, MarkStatus.absent);
    });

    test('falls back to the greater id, agreeing with the web', () {
      // The web suite asserts this exact winner. It must not be localeCompare
      // on either side: that collates "_" against "-" differently from code
      // units, and the two platforms would keep opposite documents.
      final marks = [app(MarkStatus.absent), web(MarkStatus.present)];
      expect(dedupeMarks(marks).single.id, 's1_sub1_2026-01-01_09:00');
      expect(dedupeMarks(marks.reversed.toList()).single.id, 's1_sub1_2026-01-01_09:00');
    });

    test('is a no-op with nothing duplicated', () {
      expect(dedupeMarks([]), isEmpty);
      expect(dedupeMarks([at('2026-01-01')]).single.id, 'x');
    });
  });

  group('mark ids', () {
    test('the canonical id matches attendanceMarkId in the web types', () {
      expect(
        AttendanceMark.idFor('s1', 'sub1', '2026-01-01', '09:00'),
        's1_sub1_2026-01-01_09:00',
      );
    });

    test('the legacy id is still reproducible, so writes can delete it', () {
      expect(
        AttendanceMark.legacyIdFor('s1', 'sub1', '2026-01-01', '09:00'),
        's1-sub1-2026-01-01-0900',
      );
    });
  });
}
