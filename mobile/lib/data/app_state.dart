import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:home_widget/home_widget.dart';

import '../logic/attendance.dart';
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

  /// Hands the widget a flat summary. The widget is a separate process with no
  /// Firebase access of its own — it can only render what's been saved for it.
  Future<void> pushToWidget() async {
    final next = nextClass;
    final subject = next == null ? null : subjectsById[next.subjectId];
    final percent = overallPercent;
    final open = tasks.where((t) => !t.done).length;

    await HomeWidget.saveWidgetData<String>(
      'attendance',
      percent == null ? '—' : '${percent.toStringAsFixed(2)}%',
    );
    await HomeWidget.saveWidgetData<String>(
      'nextClass',
      next == null ? 'No more classes today' : (subject?.shortName ?? 'Class'),
    );
    await HomeWidget.saveWidgetData<String>(
      'nextClassMeta',
      next == null
          ? ''
          : '${next.startTime} · ${[next.room, next.block].where((p) => p != null && p!.isNotEmpty).join(' · ')}',
    );
    await HomeWidget.saveWidgetData<String>(
      'tasks',
      open == 0 ? 'Nothing due' : '$open task${open == 1 ? '' : 's'} open',
    );
    await HomeWidget.updateWidget(androidName: 'HandyWidgetProvider');
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
