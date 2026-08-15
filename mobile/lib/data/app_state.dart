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

  /// How many classes a day this student typically has, on days they have any.
  ///
  /// Two sources, because the two kinds of college give different things. With
  /// a timetable it is exact — count the classes on each weekday that has any.
  /// Without one (AEC, ACET), it is averaged from the college's own per-day
  /// attendance records, which is why it improves as those accumulate.
  ///
  /// Null means there is not enough to say yet, and every figure derived from
  /// it is hidden rather than guessed.
  double? classesPerDay;
  List<Task> tasks = [];
  List<AttendanceMark> marks = [];

  /// Unopened notifications, for the badge. A notification nobody can see is
  /// a notification nobody reads.
  int unreadNotifications = 0;

  bool loading = true;
  String? error;

  StreamSubscription<Student?>? _studentSub;
  StreamSubscription<List<Task>>? _tasksSub;
  StreamSubscription<List<AttendanceMark>>? _marksSub;
  StreamSubscription<int>? _unreadSub;

  Map<String, Subject> get subjectsById => {for (final s in subjects) s.id: s};

  /// Overall attendance across every subject — the number on the Today screen.
  double? get overallPercent {
    final attended = summaries.fold<int>(0, (sum, s) => sum + s.attended);
    final held = summaries.fold<int>(0, (sum, s) => sum + s.held);
    return roundPercentage(calculateAttendance(attended, held));
  }

  /// The same figure carried forward by what the student has marked since the
  /// last sync. Falls back to the portal's own number when nothing is marked.
  ProjectedAttendance get overallProjected => projectAttendance(
        attended: summaries.fold<int>(0, (sum, s) => sum + s.attended),
        held: summaries.fold<int>(0, (sum, s) => sum + s.held),
        marks: marks,
        since: lastSyncedOn,
      );

  ProjectedAttendance projectedFor(String subjectId) {
    final summary = summaries.where((s) => s.subjectId == subjectId).firstOrNull;
    return projectAttendance(
      attended: summary?.attended ?? 0,
      held: summary?.held ?? 0,
      marks: marks.where((m) => m.subjectId == subjectId).toList(),
      since: lastSyncedOn,
    );
  }

  /// The mark for one class on one day, if there is one.
  AttendanceMark? markFor(String subjectId, DateTime date, String startTime) {
    final day = date.toIso8601String().substring(0, 10);
    return marks
        .where((m) => m.subjectId == subjectId && m.date == day && m.startTime == startTime)
        .firstOrNull;
  }

  /// yyyy-MM-dd the portal figures were last written, so marks the portal has
  /// already counted are not counted twice.
  String? get lastSyncedOn {
    final at = student?.updatedAt;
    return (at != null && at.length >= 10) ? at.substring(0, 10) : null;
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
      // Cancelled first: load() is called on every HomeShell mount, and
      // without this each one stacked another pair of listeners on the same
      // documents — every subsequent snapshot then ran the whole refresh
      // chain once per stale subscription.
      await _studentSub?.cancel();
      await _tasksSub?.cancel();
      await _marksSub?.cancel();
      await _unreadSub?.cancel();

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

      _marksSub = repository.watchMarks().listen((m) {
        marks = m;
        notifyListeners();
      });

      _unreadSub = repository.watchUnreadNotifications().listen((count) {
        unreadNotifications = count;
        notifyListeners();
      });
    } catch (e) {
      error = e.toString();
      loading = false;
      notifyListeners();
    }
  }

  /// Re-fetches everything and completes when it has.
  ///
  /// Pull-to-refresh needs a Future that finishes when the work does. It used
  /// to call load(), which only attaches stream listeners — so it returned
  /// immediately, the spinner snapped away, and nothing had actually been
  /// re-read. Worse, it attached a *second* set of listeners each time.
  ///
  /// The student document and tasks are already live over snapshots; what
  /// genuinely needs pulling is the rest, which is fetched once and does not
  /// change under us.
  Future<void> refresh() async {
    final s = student;
    if (s == null || s.semesterId.isEmpty) return;

    // A pull-to-refresh means "get me the current numbers". For a student whose
    // college is read by scraping, re-reading Firestore alone cannot do that —
    // nothing has put anything new there. This asks the portal first, and only
    // when it is actually due, so holding the list open does not hammer it.
    //
    // Deliberately awaited: the spinner should still be turning while the
    // college is being asked, otherwise the gesture looks finished and the
    // numbers change a moment later on their own.
    await portalAuth.resyncIfDue();

    final results = await Future.wait([
      repository.subjects(s.semesterId),
      repository.summaries(),
      repository.timetableEntries(s.semesterId),
    ]);
    subjects = results[0] as List<Subject>;
    summaries = results[1] as List<AttendanceSummary>;
    entries = results[2] as List<TimetableEntry>;

    await _afterDataChanged();
    notifyListeners();
  }

  /// Rebuilds the reminder schedule from the current data and preferences.
  ///
  /// Changing a lead time has to reach what is already queued: reminders are
  /// scheduled weeks ahead, so without this a new setting would only take
  /// effect the next time the data happened to change.
  Future<void> rescheduleReminders() => reminders.reschedule(
        entries: entries,
        tasks: tasks,
        subjectsById: subjectsById,
        classes: settings.remindClasses,
        deadlines: settings.remindDeadlines,
        classLeadMinutes: settings.classLeadMinutes,
        deadlineLeadDays: settings.deadlineLeadDays,
      );

  /// Works out how many classes a day this student has, from whichever source
  /// their college provides.
  ///
  /// The timetable is preferred because it is exact and needs no history. The
  /// per-day records are the fallback, and one day of them is not an average —
  /// hence the two-day floor, which keeps a brand-new account from telling
  /// somebody to come in for eleven days on the strength of one busy Tuesday.
  Future<void> _recomputeClassesPerDay() async {
    if (entries.isNotEmpty) {
      final perWeekday = <int, int>{};
      for (final entry in entries.where((e) => e.active)) {
        perWeekday[entry.dayOfWeek] = (perWeekday[entry.dayOfWeek] ?? 0) + 1;
      }
      classesPerDay = classesPerActiveDay(perWeekday.values.toList());
      return;
    }

    final recorded = await repository.classesPerRecordedDay();
    classesPerDay = recorded.length >= 2 ? classesPerActiveDay(recorded) : null;
  }

  /// Reminders and the home-screen widget both derive from the same data, so
  /// they're refreshed together whenever any of it changes.
  Future<void> _afterDataChanged() async {
    await _recomputeClassesPerDay();
    if (entries.isEmpty && tasks.isEmpty) return;
    await reminders.reschedule(
      entries: entries,
      tasks: tasks,
      subjectsById: subjectsById,
      classes: settings.remindClasses,
      deadlines: settings.remindDeadlines,
      classLeadMinutes: settings.classLeadMinutes,
      deadlineLeadDays: settings.deadlineLeadDays,
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
    // Strictly after: a class ending at exactly this minute is over.
    final next = today.where((b) => b.endTime.compareTo(nowHm) > 0).firstOrNull;
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
      // The short name too: a widget naming what comes *after* the current
      // class has room for "ADSAA" and not for the full title.
      await put(
        'sched${i}Short',
        block == null ? '' : (subjectsById[block.first.subjectId]?.shortName ?? ''),
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
      // Step progress, so the widget shows how far in something is rather than
      // only that it exists. Empty when a deadline has no steps — "0 of 0"
      // would read as no progress rather than as nothing to track.
      await put(
        'due${i}Steps',
        task == null || task.subtasks.isEmpty
            ? ''
            : '${task.subtasksDone}/${task.subtasks.length}',
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
