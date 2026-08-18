import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../firebase_options.dart';
import '../models/models.dart';
import '../models/timetable_entry.dart';
import 'repository.dart';
import 'widget_publish.dart';

/// Message types that mean the widgets are now showing something out of date.
///
/// Every one of these is sent by api/sync.js the moment a sync lands, and
/// every one of them carries new figures. "sync" used to be the only one
/// handled, which had it exactly backwards: sync.js sends the silent "sync"
/// message *only when nothing changed enough to announce*, and sends
/// "attendance" or "timetable" instead when it did. So the widgets refreshed
/// themselves after every sync that changed nothing and ignored every sync
/// that changed something — which is why they looked frozen until the app was
/// opened by hand.
///
/// "announcement" is deliberately absent. It is news for the student, not data
/// for a widget, and there is nothing to redraw.
const _refreshingTypes = {'sync', 'attendance', 'timetable'};

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
/// figures, the week's timetable and what is due, not the whole app state.
@pragma('vm:entry-point')
Future<void> handleBackgroundMessage(RemoteMessage message) async {
  if (!_refreshingTypes.contains(message.data['type'])) return;

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
/// The publishing itself is shared with the running app (see
/// widget_publish.dart) so that a widget refreshed by a push and one refreshed
/// by a launch cannot disagree. What is *not* shared is the loading: AppState
/// is a ChangeNotifier with streams and listeners attached, none of which
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

  await publishWidgetData(
    entries: entries,
    subjectsById: {for (final s in subjects) s.id: s},
    summaries: summaries,
    tasks: tasks,
  );
}
