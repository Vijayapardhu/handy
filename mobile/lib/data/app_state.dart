import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:home_widget/home_widget.dart';

import '../logic/attendance.dart';
import '../logic/deadlines.dart';
import '../logic/timetable.dart';
import '../main.dart';
import '../models/models.dart';
import '../models/timetable_entry.dart';

/// Everything the three tabs read, loaded once.
///
/// Deliberately a plain ChangeNotifier rather than a state-management package:
/// there is one screen's worth of state here, and a dependency would earn its
/// place only once there's more.
class AppState extends ChangeNotifier {
  Student? student;
  List<Subject> subjects = [];
  List<AttendanceSummary> summaries = [];
  List<TimetableEntry> entries = [];
  List<Task> tasks = [];

  bool loading = true;
  String? error;

  StreamSubscription<Student?>? _studentSub;
  StreamSubscription<List<Task>>? _tasksSub;

  Map<String, Subject> get subjectsById => {for (final s in subjects) s.id: s};

  /// Overall attendance across every subject — the number on the Today screen.
  double? get overallPercent {
    final attended = summaries.fold<int>(0, (sum, s) => sum + s.attended);
    final held = summaries.fold<int>(0, (sum, s) => sum + s.held);
    return roundPercentage(calculateAttendance(attended, held));
  }

  List<TimetableEntry> get todaysClasses =>
      entriesForDay(entries, DateTime.now().weekday % 7);

  TimetableEntry? get nextClass {
    final now = DateTime.now();
    final hhmm = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    return nextEntry(entries, now.weekday % 7, hhmm);
  }

  Future<void> load() async {
    try {
      _studentSub = repository.watchStudent().listen((s) async {
        student = s;
        if (s != null && s.semesterId.isNotEmpty) {
          // Subjects, summaries and the timetable all hang off the student's
          // semester, so they can't be fetched until it arrives.
          final results = await Future.wait([
            repository.subjects(s.semesterId),
            repository.summaries(),
            repository.timetableEntries(s.semesterId),
          ]);
          subjects = results[0] as List<Subject>;
          summaries = results[1] as List<AttendanceSummary>;
          entries = results[2] as List<TimetableEntry>;
          await _afterDataChanged();
        }
        loading = false;
        notifyListeners();
      });

      _tasksSub = repository.watchTasks().listen((t) async {
        tasks = t;
        await _afterDataChanged();
        notifyListeners();
      });
    } catch (e) {
      error = e.toString();
      loading = false;
      notifyListeners();
    }
  }

  /// Reminders and the home-screen widget both derive from the same data, so
  /// they're refreshed together whenever any of it changes.
  Future<void> _afterDataChanged() async {
    if (entries.isEmpty && tasks.isEmpty) return;
    await reminders.reschedule(
      entries: entries,
      tasks: tasks,
      subjectsById: subjectsById,
    );
    await pushToWidget();
  }

  /// Publishes everything the home-screen widgets render.
  ///
  /// Each widget runs in the launcher's process with no Firebase access of its
  /// own, so it can only draw what has been saved here. That's why this writes
  /// finished strings rather than raw values — a widget has no business
  /// knowing how a percentage rounds or how a countdown is phrased.
  Future<void> pushToWidget() async {
    final now = DateTime.now();
    final nowHm = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    final today = classBlocksForDay(entries, now.weekday % 7);
    final next = today.where((b) => b.endTime.compareTo(nowHm) >= 0).firstOrNull;
    final percent = overallPercent;

    Future<void> put(String key, String value) => HomeWidget.saveWidgetData<String>(key, value);

    // Appearance and content preferences, so the launcher-side providers can
    // honour them without reading the app's theme.
    await put('widgetStyle', settings.widgetStyle.name);
    await put('widgetShowFaculty', settings.widgetShowFaculty ? '1' : '0');
    await put('widgetRows', '${settings.widgetRows}');
    await put('widgetFont', settings.widgetFont.key);
    await put('widgetTextColour', settings.widgetTextColour);
    await put('overviewBlocks', settings.widgetBlocks.map((b) => b.name).join(','));

    // Attendance
    final attended = summaries.fold<int>(0, (s, x) => s + x.attended);
    final held = summaries.fold<int>(0, (s, x) => s + x.held);
    await put('attendance', percent == null ? '—' : '${percent.toStringAsFixed(2)}%');
    await put('attendanceMeta', '$attended / $held classes');
    // The Overview widget's "classes held" table compares three numbers, so it
    // wants them as numbers rather than as the sentence above.
    await HomeWidget.saveWidgetData<int>('attendedCount', attended);
    await HomeWidget.saveWidgetData<int>('heldCount', held);

    // Next class — subject, time, venue, faculty and a ready-made countdown.
    final subject = next == null ? null : subjectsById[next.first.subjectId];
    await put('nextClass', next == null ? 'No more classes today' : (subject?.name ?? 'Class'));
    await put('nextClassTime', next == null ? '' : '${next.startTime} – ${next.endTime}');
    await put(
      'nextClassVenue',
      next == null
          ? ''
          : [next.first.room, next.first.block]
              .whereType<String>()
              .where((p) => p.isNotEmpty)
              .join(' · '),
    );
    await put('nextClassFaculty', next?.first.facultyName ?? '');
    await put(
      'nextClassCountdown',
      next == null ? '' : _countdown(next.startTime, next.endTime, now),
    );

    // Today's timetable — four rows is what fits a 4x2 widget.
    await put('todayCount', today.isEmpty ? 'No classes today' : '${today.length} classes today');
    for (var i = 0; i < 4; i++) {
      final block = i < today.length ? today[i] : null;
      await put('day${i}Time', block?.startTime ?? '');
      await put(
        'day${i}Subject',
        block == null ? '' : (subjectsById[block.first.subjectId]?.name ?? 'Class'),
      );
      await put('day${i}Venue', block?.first.room ?? '');
    }

    // The whole day, unformatted, so the widgets can do their own clock work.
    //
    // Everything above is a finished string, which is right for anything that
    // only changes when the data does. It is wrong for anything that changes
    // because time passed: a countdown written here is correct at the moment
    // it is written and stale by the time anyone reads it, and a student who
    // has not opened Handy since yesterday would see yesterday's "next class"
    // indefinitely. Given the raw schedule, the launcher-side providers pick
    // the next class and phrase the countdown themselves every time they
    // redraw — which happens on a timer, on resize, and on boot, with the app
    // closed throughout. See Schedule.kt.
    await HomeWidget.saveWidgetData<int>('schedCount', today.length);
    for (var i = 0; i < 8; i++) {
      final block = i < today.length ? today[i] : null;
      await put('sched${i}Start', block?.startTime ?? '');
      await put('sched${i}End', block?.endTime ?? '');
      await put(
        'sched${i}Subject',
        block == null ? '' : (subjectsById[block.first.subjectId]?.name ?? 'Class'),
      );
      await put(
        'sched${i}Venue',
        block == null
            ? ''
            : [block.first.room, block.first.block]
                .whereType<String>()
                .where((p) => p.isNotEmpty)
                .join(' · '),
      );
      await put('sched${i}Faculty', block?.first.facultyName ?? '');
    }

    // Dues
    final open = tasks.where((t) => !t.done).toList()
      ..sort((a, b) => a.dueDate.compareTo(b.dueDate));
    await put('tasks', open.isEmpty ? 'Nothing due' : '${open.length} open');
    for (var i = 0; i < 3; i++) {
      final task = i < open.length ? open[i] : null;
      await put('due${i}Title', task?.title ?? '');
      await put(
        'due${i}When',
        task == null ? '' : getDeadline(task.dueDate, now, done: task.done).label,
      );
    }

    // Refresh every provider: a student may have any combination placed.
    for (final provider in const [
      'HandyWidgetProvider',
      'AttendanceWidgetProvider',
      'TodayWidgetProvider',
      'DuesWidgetProvider',
      'OverviewWidgetProvider',
    ]) {
      await HomeWidget.updateWidget(androidName: provider);
    }
  }

  /// "in 25 min" / "now · ends 11:20". The widget can't recompute this on its
  /// own, so it receives the finished phrase.
  static String _countdown(String start, String end, DateTime now) {
    DateTime at(String hhmm) {
      final parts = hhmm.split(':');
      return DateTime(now.year, now.month, now.day, int.parse(parts[0]), int.parse(parts[1]));
    }

    final startsAt = at(start);
    if (now.isAfter(startsAt)) return 'now · ends $end';

    final minutes = startsAt.difference(now).inMinutes;
    if (minutes < 60) return 'in $minutes min';
    final hours = minutes ~/ 60;
    final rest = minutes % 60;
    return rest == 0 ? 'in $hours h' : 'in $hours h $rest min';
  }

  @override
  void dispose() {
    _studentSub?.cancel();
    _tasksSub?.cancel();
    super.dispose();
  }
}

/// Plain InheritedNotifier so the tabs can read state without a package.
class AppStateScope extends InheritedNotifier<AppState> {
  const AppStateScope({super.key, required AppState state, required super.child})
      : super(notifier: state);

  static AppState of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AppStateScope>()!.notifier!;
}
