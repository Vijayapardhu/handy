/// Attendance maths.
///
/// Ported from src/lib/calculations/attendance.ts in the web app. The two
/// implementations must agree — a student comparing the phone and the website
/// should never see different percentages — so the Dart tests mirror the
/// TypeScript ones case for case.
library;

import '../models/models.dart';

/// Percentage attended, or null when no class has been held yet (0/0 is not 0%,
/// it's "no data", and rendering it as 0% makes a fresh subject look failed).
double? calculateAttendance(int attended, int held) {
  if (held <= 0) return null;
  return (attended / held) * 100;
}

double? roundPercentage(double? value) {
  if (value == null) return null;
  return (value * 100).round() / 100;
}

/// Classes still to attend, with no further absences, to reach [target].
///
/// Solves (attended + n) / (held + n) >= target/100 for n.
int classesNeededForTarget(int attended, int held, double target) {
  if (target >= 100) return -1; // unreachable: you'd need every remaining class forever
  final current = calculateAttendance(attended, held);
  if (current != null && current >= target) return 0;
  final numerator = target * held - 100 * attended;
  final denominator = 100 - target;
  return (numerator / denominator).ceil().clamp(0, 1 << 30);
}

/// How many classes can still be missed while staying at or above [target].
///
/// This is the number a student actually wants: not "what's my percentage" but
/// "how many can I skip".
int classesCanSkip(int attended, int held, double target) {
  if (target <= 0) return 1 << 30;
  var skips = 0;
  while (true) {
    final percent = calculateAttendance(attended, held + skips + 1);
    if (percent == null || percent < target) return skips;
    skips += 1;
    if (skips > 500) return skips; // guard against a pathological target
  }
}

/// The portal's figures brought forward by what the student has marked since.
///
/// The portal republishes irregularly — sometimes a fortnight apart — and in
/// between, a student's real position drifts from the one Handy can show. This
/// closes that gap without touching the imported numbers: marks are added on
/// top, and the result is presented as an estimate, because that is what it is.
///
/// [since] is the date the summaries were last imported. Marks before it are
/// ignored: the portal has already counted those days, and adding them again
/// would double-count exactly the classes a diligent student marked.
class ProjectedAttendance {
  const ProjectedAttendance({
    required this.attended,
    required this.held,
    required this.percent,
    required this.addedFromMarks,
  });

  final int attended;
  final int held;
  final double? percent;

  /// How many marked classes the projection is carrying. Zero means this is
  /// the portal's figure untouched, and the UI should say so rather than
  /// claiming an estimate it hasn't made.
  final int addedFromMarks;

  bool get isProjected => addedFromMarks > 0;
}

ProjectedAttendance projectAttendance({
  required int attended,
  required int held,
  required List<AttendanceMark> marks,
  String? since,
}) {
  var extraAttended = 0;
  var extraHeld = 0;

  for (final mark in marks) {
    // A cancelled class was never held, so it moves neither number. Skipping
    // it is the point of having the state at all.
    if (mark.status == MarkStatus.cancelled) continue;
    if (since != null && mark.date.compareTo(since) <= 0) continue;

    extraHeld += mark.periods;
    if (mark.status == MarkStatus.present) extraAttended += mark.periods;
  }

  final total = held + extraHeld;
  return ProjectedAttendance(
    attended: attended + extraAttended,
    held: total,
    percent: roundPercentage(calculateAttendance(attended + extraAttended, total)),
    addedFromMarks: extraHeld,
  );
}
