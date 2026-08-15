import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:home_widget/home_widget.dart';

import '../firebase_options.dart';
import '../logic/deadlines.dart';
import '../logic/timetable.dart';
import '../models/models.dart';
import '../models/timetable_entry.dart';
import 'repository.dart';

/// Refreshes the home-screen widgets when the app is not running.
///
/// A widget is only ever as current as the last thing written for it, and the
/// app is what writes. For a student who syncs on a laptop and does not open
/// Handy for a week, that is a week-old tile — which is the whole complaint.
/// So the server pushes a data message the moment a sync lands (see
/// api/sync.js), and this handles it in a background isolate: fetch, republish,
/// redraw. No app launch, no pull-to-refresh.
///
/// This runs in its own isolate with none of main()'s globals, so everything
/// it needs is built locally. It is deliberately small — the widgets only need
/// figures and today's schedule, not the whole app state.
@pragma('vm:entry-point')
Future<void> handleBackgroundMessage(RemoteMessage message) async {
  // Only sync pushes carry work. An announcement is just a notification and
  // has nothing for us to redraw.
  if (message.data['type'] != 'sync') return;

  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  final auth = FirebaseAuth.instance;
  // Auth state is persisted to disk, so a signed-in student is still signed in
  // here. If they are not, there is nothing to fetch and nothing to draw.
  if (auth.currentUser == null) return;

  final repository = Repository(FirebaseFirestore.instance, auth);
  await refreshWidgetData(repository);
}

/// Fetches what the widgets show and publishes it.
///
/// Shares no code with AppState.pushToWidget on purpose: that method belongs to
/// a live ChangeNotifier with streams and listeners attached, none of which
/// exist — or should be started — in a background isolate.
Future<void> refreshWidgetData(Repository repository) async {
  final student = await repository.watchStudent().first;
  if (student == null || student.semesterId.isEmpty) return;

  final results = await Future.wait([
    repository.subjects(student.semesterId),
    repository.summaries(),
    repository.timetableEntries(student.semesterId),
    repository.watchTasks().first,
  ]);

  final subjects = results[0] as List<Subject>;
  final summaries = results[1] as List<AttendanceSummary>;
  final entries = results[2] as List<TimetableEntry>;
  final tasks = results[3] as List<Task>;
  final subjectsById = {for (final s in subjects) s.id: s};

  final now = DateTime.now();
  final today = classBlocksForDay(entries, now.weekday % 7);

  final attended = summaries.fold<int>(0, (total, s) => total + s.attended);
  final held = summaries.fold<int>(0, (total, s) => total + s.held);
  final percent = held == 0 ? null : (attended / held) * 100;

  Future<void> put(String key, String value) =>
      HomeWidget.saveWidgetData<String>(key, value);

  await put('attendance', percent == null ? '—' : '${percent.toStringAsFixed(2)}%');
  await put('attendanceMeta', '$attended / $held classes');
  await HomeWidget.saveWidgetData<int>('attendedCount', attended);
  await HomeWidget.saveWidgetData<int>('heldCount', held);

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

  // The raw schedule, which is what lets the widgets keep themselves right as
  // the day goes on without another push. See Schedule.kt.
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
