import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';

import '../firebase_options.dart';
import '../logic/planning.dart';
import '../models/hub_attendance.dart';
import 'hub.dart';
import 'repository.dart';
import 'widget_publish.dart';

/// Refreshes CodeForge on its own, once a day, without the app being open.
///
/// The rest of the widgets are kept current by the sync push (see
/// background_sync.dart) — but that fires when a student's *college* attendance
/// syncs, which has nothing to do with when Maya posts a CodeForge session. So
/// CodeForge got its own schedule: a daily alarm (see WidgetTick) at a fixed
/// morning hour, on the days the timetable actually holds a Technical Hour, that
/// fetches the figure and redraws the tile.
///
/// Runs in a background isolate with none of main()'s globals — the same
/// constraint background_sync.dart works under — so everything it needs is
/// built here.
///
/// Registered against home_widget's interactivity callback, and dispatched by
/// CodeForgeRefreshReceiver firing HomeWidgetBackgroundIntent. The URI is how a
/// generic "the widget did something" callback tells this apart from a tap on
/// some future interactive widget.
@pragma('vm:entry-point')
Future<void> codeForgeBackgroundCallback(Uri? uri) async {
  if (uri?.host != 'codeforge') return;

  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  final auth = FirebaseAuth.instance;
  // Auth is persisted to disk, so a signed-in student is still signed in here.
  // A signed-out one has nothing to fetch and no token to fetch it with.
  if (auth.currentUser == null) return;

  await refreshCodeForge(Repository(FirebaseFirestore.instance, auth));
}

/// Fetches CodeForge and republishes the tile, gated on the student actually
/// having a Technical Hour.
///
/// The gate is the "when there is a session class" half of the request: a
/// college with no Technical Hour has no CodeForge, and waking the network for
/// it would be asking Maya a question about a course that does not exist.
/// Checked here against the real timetable rather than trusting the alarm,
/// because the alarm fires off cached data and this is the authoritative copy.
Future<void> refreshCodeForge(Repository repository) async {
  final student = await repository.watchStudent().first;
  if (student == null || student.semesterId.isEmpty) return;

  final entries = await repository.timetableEntries(student.semesterId);
  if (!entries.any((e) => e.active && e.type == 'technical')) return;

  final HubAttendanceResult result;
  try {
    result = await Hub().attendance();
  } catch (_) {
    // Maya was unreachable or answered with something unreadable. The tile
    // keeps its last figure — a day-old percentage beats a blank one — and the
    // next day's alarm tries again.
    return;
  }

  final nextSession = daysToAttend(
    classes: 1,
    entries: entries,
    from: DateTime.now(),
    type: 'technical',
  )?.on;

  await publishCodeForge(
    result: result,
    next: nextSession == null ? null : shortWhen(nextSession),
  );
}
