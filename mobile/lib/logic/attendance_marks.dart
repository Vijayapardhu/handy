/// Derivations over the student's own attendance marks.
///
/// Mirrors src/lib/calculations/attendanceMarks.ts, which is the point of it
/// being a separate file: the two implementations must agree, or the same week
/// reads differently on a phone and on a laptop and nothing on either screen
/// says which is wrong.
library;

import '../models/models.dart';

/// One mark per class, when the same class has been written twice.
///
/// The two apps used to write the same mark at two different document ids, so
/// a class marked on a phone and again on a laptop existed twice and every
/// percentage counted it twice. New writes converge on one id (see
/// AttendanceMark.idFor) and clean the other up as they go, but documents
/// already in the collection do not fix themselves — so every read collapses
/// them.
///
/// Which duplicate wins has to be decided the same way on both platforms, or
/// the phone and the website disagree about the same week, which is the bug
/// again wearing a different hat. So: the most recently written wins, and where
/// neither says when it was written, the greater id does. Arbitrary, but
/// arbitrary *and identical* on both sides, which is the only property that
/// matters.
List<AttendanceMark> dedupeMarks(List<AttendanceMark> marks) {
  final best = <String, AttendanceMark>{};
  for (final mark in marks) {
    final key = '${mark.subjectId}|${mark.date}|${mark.startTime}';
    final held = best[key];
    if (held == null || _wins(mark, held)) best[key] = mark;
  }
  return best.values.toList();
}

/// Deliberately `compareTo`, which orders by code unit.
///
/// The web half of this has to reach the same verdict, and its obvious
/// spelling — `localeCompare` — does not: locale collation does not order "_"
/// against "-" the way code units do, so the two platforms picked opposite
/// documents for the same pair. That is the original duplicate bug back again,
/// one layer down and much harder to see. The web uses `>` on strings for the
/// same reason.
bool _wins(AttendanceMark candidate, AttendanceMark holder) {
  final byTime = (candidate.updatedAt ?? '').compareTo(holder.updatedAt ?? '');
  if (byTime != 0) return byTime > 0;
  return candidate.id.compareTo(holder.id) > 0;
}
