import 'dart:convert';

import 'package:home_widget/home_widget.dart';

import '../logic/attendance.dart';
import '../logic/coding.dart';
import '../logic/timetable.dart';
import '../models/coding.dart';
import '../models/hub_attendance.dart';
import '../models/models.dart';
import '../models/timetable_entry.dart';

/// The one place that writes what the home-screen widgets render.
///
/// There used to be two: AppState.pushToWidget for the running app and
/// refreshWidgetData for the background isolate, deliberately kept apart
/// because the first belongs to a ChangeNotifier full of streams that has no
/// business starting in a headless isolate. That reasoning was about *state*,
/// and the copy that came with it was about *keys* — so the background path
/// quietly stopped writing step counts, and a widget refreshed by a push
/// showed the progress a foreground refresh had left behind. Publishing is a
/// pure function of the data it is handed and belongs to neither caller, so it
/// lives here and both call it.
const widgetProviders = <String>[
  'HandyWidgetProvider',
  'AttendanceWidgetProvider',
  'TodayWidgetProvider',
  'DuesWidgetProvider',
  'OverviewWidgetProvider',
  'CodeForgeWidgetProvider',
  'PracticeWidgetProvider',
];

/// Deadlines shown across the widgets. Dues shows three, Overview four.
const _dueSlots = 4;

/// Publishes the figures, the week's timetable and the open deadlines.
///
/// Two kinds of value go over: settled facts (an attendance percentage is the
/// same at midnight as it was at noon) and raw material for the things that
/// change because time passed. The second kind used to be written as finished
/// English — "in 25 min", "2 days left" — which is correct for exactly as long
/// as it takes the phone to go back in a pocket. Those are now sent as a
/// schedule and a due date, and phrased on the launcher side at draw time.
///
/// The whole *week* goes over rather than today's classes, for the same
/// reason. A widget holding one day's list has nothing to show the moment that
/// day ends, and the app is not there at midnight to hand it the next one — so
/// a student who did not open Handy on Wednesday spent Thursday looking at
/// Wednesday's timetable. Given the week, the provider picks the day itself.
Future<void> publishWidgetData({
  required List<TimetableEntry> entries,
  required Map<String, Subject> subjectsById,
  required List<AttendanceSummary> summaries,
  required List<Task> tasks,
}) async {
  Future<void> put(String key, String value) =>
      HomeWidget.saveWidgetData<String>(key, value);

  // Attendance.
  final attended = summaries.fold<int>(0, (sum, s) => sum + s.attended);
  final held = summaries.fold<int>(0, (sum, s) => sum + s.held);
  final percent = roundPercentage(calculateAttendance(attended, held));
  await put('attendance', percent == null ? '—' : '${percent.toStringAsFixed(2)}%');
  await put('attendanceMeta', '$attended / $held classes');
  // The Overview widget's "classes held" table compares three numbers, so it
  // wants them as numbers rather than as the sentence above.
  await HomeWidget.saveWidgetData<int>('attendedCount', attended);
  await HomeWidget.saveWidgetData<int>('heldCount', held);

  // The week's timetable, indexed 0=Sunday to match DateTime.weekday % 7 and
  // Calendar.DAY_OF_WEEK - 1 on the other side.
  final week = [
    for (var day = 0; day < 7; day++)
      [
        for (final block in classBlocksForDay(entries, day))
          {
            's': block.startTime,
            'e': block.endTime,
            'n': subjectsById[block.first.subjectId]?.name ?? 'Class',
            // The short name too: a widget naming what comes *after* the
            // current class has room for "ADSAA" and not for the full title.
            'a': subjectsById[block.first.subjectId]?.shortName ?? '',
            'v': [block.first.room, block.first.block]
                .whereType<String>()
                .where((p) => p.isNotEmpty)
                .join(' · '),
            'f': block.first.facultyName,
            // The period kind, so the launcher-side daily refresh can fire
            // only on days that actually hold a CodeForge (technical) session.
            't': block.first.type,
          },
      ],
  ];
  await put('week', jsonEncode(week));

  // Deadlines. The due date travels as a whole day count rather than a
  // timestamp, because that is what the countdown is measured in — phrasing it
  // from a timestamp would flip "1 day left" at an arbitrary hour of the
  // evening. See getDeadline, which this mirrors on the Kotlin side.
  final open = tasks.where((t) => !t.done).toList()
    ..sort((a, b) => a.dueDate.compareTo(b.dueDate));
  await put('tasks', open.isEmpty ? 'Nothing due' : '${open.length} open');
  final dues = [
    for (final task in open.take(_dueSlots))
      {
        't': task.title,
        'd': _epochDay(task.dueDate),
        // Step progress, so the widget shows how far in something is rather
        // than only that it exists. Empty when a deadline has no steps —
        // "0 of 0" would read as no progress rather than as nothing to track.
        's': task.subtasks.isEmpty
            ? ''
            : '${task.subtasksDone}/${task.subtasks.length}',
      },
  ];
  await put('dues', jsonEncode(dues));

  await refreshWidgets();
}

/// Redraws every widget, since a student may have any combination placed.
Future<void> refreshWidgets() async {
  for (final provider in widgetProviders) {
    await HomeWidget.updateWidget(androidName: provider);
  }
}

/// Whole days since the epoch, in calendar terms — the same figure the Kotlin
/// side derives from the local date.
int _epochDay(DateTime date) =>
    DateTime.utc(date.year, date.month, date.day).millisecondsSinceEpoch ~/
        Duration.millisecondsPerDay;

/// Publishes what the CodeForge tile shows.
///
/// Separate from publishWidgetData because it has a different life: the rest of
/// the widget data comes out of Firestore with everything else, while this
/// arrives from Maya on its own schedule and can fail on its own. Folding it in
/// would mean a slow second college system holding up the tiles that were ready.
///
/// [next] is when the Technical Hour next falls, already worded — the widget has
/// no timetable of its own to work it out from, and this is the only place that
/// does have one.
Future<void> publishCodeForge({
  required HubAttendanceResult? result,
  String? next,
}) async {
  Future<void> put(String key, String value) =>
      HomeWidget.saveWidgetData<String>(key, value);

  final linked = result?.linked ?? false;
  final snapshot = result?.snapshot;

  await put('forgeLinked', linked ? '1' : '0');
  await put(
    'forgePercent',
    snapshot?.codeForgePercentage == null
        ? ''
        // Two decimals, matching the app card and the website. The tile is the
        // one place that rounded to a whole number, so 56.25% read as 56% —
        // wrong by a quarter point against every other surface.
        : '${snapshot!.codeForgePercentage!.toStringAsFixed(2)}%',
  );
  await put(
    'forgeSessions',
    snapshot == null
        ? ''
        : '${snapshot.codeForgeAttended} / ${snapshot.codeForgeTotal} sessions',
  );

  // The CodeForge course furthest behind — the ability courses do not belong
  // on a tile that says CodeForge. Worst first among the ones that have run.
  final worst = snapshot?.codeForgeCourses
      .where((c) => c.percentage != null)
      .fold<HubCourse?>(null, (worst, c) =>
          worst == null || c.percentage! < worst.percentage! ? c : worst);
  await put(
    'forgeCourse',
    worst == null || worst.percentage == null
        ? ''
        : '${worst.title} · ${worst.percentage!.toStringAsFixed(0)}%',
  );
  await put('forgeNext', next == null ? '' : 'Next session $next');

  await HomeWidget.updateWidget(androidName: 'CodeForgeWidgetProvider');
}

/// Publishes what the Practice tile shows.
///
/// Separate from publishWidgetData for the same reason publishCodeForge is:
/// these figures come from five outside websites through /api/coding, on their
/// own schedule and with their own ways of failing. Folding them in would mean
/// a slow platform holding up tiles that were ready.
///
/// Called from wherever the practice profile is loaded, which today is the
/// Practice tab. So the tile shows what was true the last time the student
/// opened it: a widget has no network of its own, and a number that is a day
/// old is better than a spinner that never resolves.
Future<void> publishPractice({
  required CodingProfile? profile,
  required List<CodingSolution> solutions,
  required String todayIso,
}) async {
  Future<void> put(String key, String value) =>
      HomeWidget.saveWidgetData<String>(key, value);

  final linked = profile != null && profile.isLinked;
  await put('practiceLinked', linked ? '1' : '0');

  if (!linked) {
    // Blanked rather than left behind: a student who unlinked every platform
    // should not keep seeing the total they had when they did.
    for (final key in [
      'practiceSolved',
      'practiceStreak',
      'practiceGoal',
      'practicePlatforms',
    ]) {
      await put(key, '');
    }
    await HomeWidget.updateWidget(androidName: 'PracticeWidgetProvider');
    return;
  }

  await put('practiceSolved', '${profile.totalSolved}');

  // The same activity map the Practice tab builds its heatmap from, so the
  // tile and the screen can never disagree about whether today counted.
  final activity = buildActivityMap(profile.stats, solutions);
  final streak = currentStreak(activity, todayIso);
  await put('practiceStreak', streak == 0 ? '' : '$streak-day streak');

  final progress = weeklyProgress(solutions, profile.weeklyTarget, todayIso);
  await put(
    'practiceGoal',
    // No goal set is an empty line rather than "0 of 0": a target nobody chose
    // is a question, not a figure, and the tile drops the row entirely.
    progress.target == 0 ? '' : '${progress.solved} of ${progress.target} this week',
  );

  // Where the total comes from, biggest first. One number across five sites
  // invites "solved on what?", and this is the answer in one line. Platforms
  // that failed to load are left out rather than shown as zero.
  final counts = profile.stats
      .where((entry) => entry.error == null && (entry.solved ?? 0) > 0)
      .toList()
    ..sort((a, b) => (b.solved ?? 0).compareTo(a.solved ?? 0));
  await put(
    'practicePlatforms',
    counts.take(3).map((entry) => '${entry.platform.label} ${entry.solved}').join(' · '),
  );

  await HomeWidget.updateWidget(androidName: 'PracticeWidgetProvider');
}
