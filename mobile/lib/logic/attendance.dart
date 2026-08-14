/// Attendance maths.
///
/// Ported from src/lib/calculations/attendance.ts in the web app. The two
/// implementations must agree — a student comparing the phone and the website
/// should never see different percentages — so the Dart tests mirror the
/// TypeScript ones case for case.
library;

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
