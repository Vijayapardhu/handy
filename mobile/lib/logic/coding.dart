/// The practice numbers, derived rather than stored.
///
/// A port of src/lib/calculations/coding.ts, rule for rule. Both sides are
/// pinned by tests (mobile/test/coding_test.dart, and the web's own suite)
/// because a student who sees a 6-day streak on the phone and a 5-day streak on
/// the website concludes one of the two is broken — and they would be right.
///
/// All pure and date-injected: a streak that reads the clock cannot be tested.
library;

import '../models/coding.dart';

/// One cell of the practice heatmap.
class ActivityDay {
  const ActivityDay({required this.date, required this.count, required this.level});

  /// yyyy-MM-dd.
  final String date;
  final int count;

  /// 0-4, the shade. Bucketed rather than scaled, so one heavy day cannot
  /// flatten the rest of the grid.
  final int level;
}

/// Merges every source of "practice happened that day" into one map.
///
/// LeetCode publishes a submission calendar; nobody else does. The solve log
/// fills the rest, so a student who practises on Codeforces and writes it down
/// still has a streak. Counts add across sources — this is activity, not a
/// total.
Map<String, int> buildActivityMap(
  List<PlatformStats> stats,
  List<CodingSolution> solutions,
) {
  final activity = <String, int>{};
  void add(String date, int count) {
    if (date.isEmpty) return;
    activity[date] = (activity[date] ?? 0) + count;
  }

  for (final platform in stats) {
    platform.calendar?.forEach(add);
  }
  for (final solution in solutions) {
    add(solution.solvedAt, 1);
  }
  return activity;
}

/// Four buckets. A day with anything at all is never level 0 — showing up counts.
int _levelFor(int count) {
  if (count <= 0) return 0;
  if (count == 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

DateTime _day(String iso) {
  final parts = iso.split('-');
  return DateTime.utc(
    int.tryParse(parts.elementAtOrNull(0) ?? '') ?? 1970,
    int.tryParse(parts.elementAtOrNull(1) ?? '') ?? 1,
    int.tryParse(parts.elementAtOrNull(2) ?? '') ?? 1,
  );
}

String _iso(DateTime day) =>
    '${day.year.toString().padLeft(4, '0')}-'
    '${day.month.toString().padLeft(2, '0')}-'
    '${day.day.toString().padLeft(2, '0')}';

/// The last [days] days, oldest first, including the empty ones.
///
/// The gaps are in the array on purpose: a heatmap with the empty days removed
/// says the opposite of the truth.
List<ActivityDay> buildHeatmap(
  Map<String, int> activity,
  String todayIso, {
  int days = 84,
}) {
  final end = _day(todayIso);
  return [
    for (var offset = days - 1; offset >= 0; offset -= 1)
      () {
        final date = _iso(end.subtract(Duration(days: offset)));
        final count = activity[date] ?? 0;
        return ActivityDay(date: date, count: count, level: _levelFor(count));
      }(),
  ];
}

/// Consecutive practice days ending today — or yesterday.
///
/// Yesterday counting is deliberate: at 9am a student has not broken a 30-day
/// streak, they just have not practised *yet*, and a tracker that resets at
/// midnight teaches people to stop trusting it.
int currentStreak(Map<String, int> activity, String todayIso) {
  final today = _day(todayIso);
  final startedToday = (activity[todayIso] ?? 0) > 0;
  if (!startedToday && (activity[_iso(today.subtract(const Duration(days: 1)))] ?? 0) == 0) {
    return 0;
  }

  var streak = 0;
  var cursor = startedToday ? today : today.subtract(const Duration(days: 1));
  while ((activity[_iso(cursor)] ?? 0) > 0) {
    streak += 1;
    cursor = cursor.subtract(const Duration(days: 1));
  }
  return streak;
}

/// The longest run of practice days anywhere in the record.
int longestStreak(Map<String, int> activity) {
  final days = activity.entries
      .where((entry) => entry.value > 0)
      .map((entry) => _day(entry.key))
      .toList()
    ..sort();

  var best = 0;
  var run = 0;
  DateTime? previous;
  for (final day in days) {
    run = previous != null && day.difference(previous).inDays == 1 ? run + 1 : 1;
    previous = day;
    if (run > best) best = run;
  }
  return best;
}

class WeeklyProgress {
  const WeeklyProgress({
    required this.solved,
    required this.target,
    required this.percent,
    required this.remaining,
    required this.daysLeft,
    required this.met,
  });

  final int solved;
  final int target;

  /// 0-100, clamped. 0 when no target is set.
  final int percent;
  final int remaining;

  /// Whole days left in the week, today included.
  final int daysLeft;
  final bool met;
}

/// Progress against the weekly practice goal.
///
/// The week starts Monday — a college week, not a calendar one, and the same
/// assumption the timetable makes.
WeeklyProgress weeklyProgress(
  List<CodingSolution> solutions,
  int target,
  String todayIso,
) {
  final today = _day(todayIso);
  // DateTime.weekday is Monday=1..Sunday=7; Sunday belongs to the week that is
  // ending, which is why it is six days in rather than zero.
  final sinceMonday = today.weekday - 1;
  final monday = today.subtract(Duration(days: sinceMonday));

  final solved = solutions.where((solution) {
    if (solution.solvedAt.isEmpty) return false;
    final day = _day(solution.solvedAt);
    return !day.isBefore(monday) && !day.isAfter(today);
  }).length;

  final percent = target > 0 ? (solved / target * 100).round().clamp(0, 100) : 0;
  return WeeklyProgress(
    solved: solved,
    target: target,
    percent: percent,
    remaining: target - solved > 0 ? target - solved : 0,
    daysLeft: 7 - sinceMonday,
    met: target > 0 && solved >= target,
  );
}

/// Every platform's difficulty split, summed. Only LeetCode reports one today.
DifficultySplit? totalByDifficulty(List<PlatformStats> stats) {
  final withSplit = stats.where((entry) => entry.byDifficulty != null).toList();
  if (withSplit.isEmpty) return null;

  var easy = 0;
  var medium = 0;
  var hard = 0;
  for (final entry in withSplit) {
    easy += entry.byDifficulty!.easy;
    medium += entry.byDifficulty!.medium;
    hard += entry.byDifficulty!.hard;
  }
  return DifficultySplit(easy: easy, medium: medium, hard: hard);
}

class ComplexityCoverage {
  const ComplexityCoverage({
    required this.analysed,
    required this.total,
    required this.percent,
  });

  final int analysed;
  final int total;
  final int percent;
}

/// How much of the solve log has a complexity recorded.
///
/// The nudge that makes the log worth keeping: a solved problem whose cost
/// nobody worked out will be re-solved the same slow way.
ComplexityCoverage complexityCoverage(List<CodingSolution> solutions) {
  final total = solutions.length;
  final analysed = solutions.where((solution) => solution.complexity != null).length;
  return ComplexityCoverage(
    analysed: analysed,
    total: total,
    percent: total == 0 ? 0 : (analysed / total * 100).round(),
  );
}
