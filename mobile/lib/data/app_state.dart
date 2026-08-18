import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:home_widget/home_widget.dart';

import '../logic/attendance.dart';
import '../logic/planning.dart';
import '../logic/timetable.dart';
import '../main.dart';
import '../models/models.dart';
import '../models/hub_attendance.dart';
import '../models/timetable_entry.dart';
import 'widget_publish.dart';

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
  List<AttendanceMark> marks = [];

  /// The college's own rules. Starts at the fallback so every screen has a
  /// number to render before the document arrives, and is replaced by the real
  /// one on the first load.
  CollegeConfig config = CollegeConfig.fallback;

  /// CodeForge sessions, as Maya last reported them.
  ///
  /// Held here rather than fetched by the card that shows it, so that opening
  /// Today does not start a network call every time: the figure is the same
  /// one the breakdown screen reads, and it is fetched once on startup like
  /// everything else on this screen.
  ///
  /// Null means "not asked yet" and is distinct from a result whose `linked`
  /// is false, which means "asked, and this student has not connected one".
  /// Conflating the two is how the card came to show "Not linked" to a student
  /// who *was* linked, for the several seconds the request takes.
  HubAttendanceResult? codeForge;

  /// Whether that request is in flight.
  ///
  /// Its own flag rather than inferred from `codeForge == null`, because a
  /// refresh has a result in hand and is fetching another — and during that,
  /// the honest thing is to keep showing the figure while saying it is being
  /// checked, not to blank the card.
  bool codeForgeLoading = false;

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

  /// What this subject has to reach: its own target when it has been given
  /// one, else the college's minimum. Mirrors subjectService.ts, which resolves
  /// it the same way for the web.
  double targetFor(Subject? subject) =>
      subject?.targetAttendance ?? config.minimumAttendancePercentage;

  /// The college minimum, which is what every "are you safe" line is measured
  /// against when a subject has no target of its own.
  double get target => config.minimumAttendancePercentage;

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
            repository.collegeConfig(s.collegeId),
          ]);
          subjects = results[0] as List<Subject>;
          summaries = results[1] as List<AttendanceSummary>;
          entries = results[2] as List<TimetableEntry>;
          config = results[3] as CollegeConfig;
          await _afterDataChanged();
          // Deliberately not awaited: CodeForge is a second college system
          // reached over the network, and Today should not wait on it to show
          // a student their own attendance. It fills in when it arrives.
          unawaited(loadCodeForge());
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
      repository.collegeConfig(s.collegeId),
    ]);
    subjects = results[0] as List<Subject>;
    summaries = results[1] as List<AttendanceSummary>;
    entries = results[2] as List<TimetableEntry>;
    config = results[3] as CollegeConfig;

    await _afterDataChanged();
    notifyListeners();
  }

  /// Fetches CodeForge attendance, if this student has any to fetch.
  ///
  /// Gated on the timetable carrying a Technical Hour — the same test the web
  /// makes before rendering its card. Asking for a student whose course has no
  /// such period is a request that can only ever come back empty.
  ///
  /// Never throws. It is one card on a screen full of other things, and a
  /// second college system being down is not a reason for Today to fail.
  Future<void> loadCodeForge() async {
    if (!entries.any((e) => e.type == 'technical')) return;
    codeForgeLoading = true;
    notifyListeners();
    try {
      codeForge = await hub.attendance();
    } catch (_) {
      // Left as it was: a stale figure with a date on it beats an empty card,
      // and the breakdown screen is where a failure is worth reporting.
    }
    codeForgeLoading = false;
    notifyListeners();

    // The home-screen tile too, and from here rather than from publishWidgetData
    // — that runs with everything else out of Firestore, and this figure arrives
    // separately and can fail separately.
    final nextSession = daysToAttend(
      classes: 1,
      entries: entries,
      from: DateTime.now(),
      type: 'technical',
    )?.on;
    await publishCodeForge(
      result: codeForge,
      next: nextSession == null ? null : shortWhen(nextSession),
    );
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

  /// Reminders and the home-screen widgets both derive from the same data, so
  /// they're refreshed together whenever any of it changes.
  Future<void> _afterDataChanged() async {
    // Nothing to remind anyone about with no timetable and no deadlines. The
    // widgets are a different question, and this guard used to answer it the
    // same way: a student at a college that publishes no timetable has empty
    // entries permanently, so if they were also keeping no deadlines their
    // attendance tile was never republished at all.
    if (entries.isNotEmpty || tasks.isNotEmpty) {
      await reminders.reschedule(
        entries: entries,
        tasks: tasks,
        subjectsById: subjectsById,
        classes: settings.remindClasses,
        deadlines: settings.remindDeadlines,
        classLeadMinutes: settings.classLeadMinutes,
        deadlineLeadDays: settings.deadlineLeadDays,
      );
    }
    await pushToWidget();
  }

  /// Publishes everything the home-screen widgets render.
  ///
  /// The values themselves are written by publishWidgetData, which the
  /// background isolate calls too — the two paths write the same keys or the
  /// widget refreshed by a push disagrees with the one refreshed by a launch.
  /// What is added here is the half only a running app knows: the student's
  /// appearance and layout choices, which live in settings and change nowhere
  /// else.
  Future<void> pushToWidget() async {
    Future<void> put(String key, String value) => HomeWidget.saveWidgetData<String>(key, value);

    // Appearance and content preferences, so the launcher-side providers can
    // honour them without reading the app's theme.
    await put('widgetStyle', settings.widgetStyle.name);
    await put('widgetShowFaculty', settings.widgetShowFaculty ? '1' : '0');
    await put('widgetRows', '${settings.widgetRows}');
    await put('widgetFont', settings.widgetFont.key);
    await put('widgetTextColour', settings.widgetTextColour);
    await put('overviewBlocks', settings.widgetBlocks.map((b) => b.name).join(','));

    await publishWidgetData(
      entries: entries,
      subjectsById: subjectsById,
      summaries: summaries,
      tasks: tasks,
    );
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
