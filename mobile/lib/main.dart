import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'data/app_state.dart';
import 'data/background_sync.dart';
import 'data/push.dart';
import 'data/reminders.dart';
import 'data/study_timer.dart';
import 'data/settings.dart';
import 'data/repository.dart';
import 'firebase_options.dart';
import 'screens/home_shell.dart';
import 'screens/sign_in_screen.dart';
import 'screens/timetable_changes_screen.dart';
import 'theme.dart';

late final Repository repository;
late final Reminders reminders;
late final Push push;
late final StudyTimer studyTimer;
final settings = AppSettings();

/// Global so that routes pushed onto the root Navigator can reach it: an
/// InheritedWidget inside HomeShell is *below* the Navigator, so a pushed
/// screen sits outside its subtree and the lookup returns null.
final appState = AppState();

/// Lets a tapped notification push a screen. Notifications arrive with no
/// BuildContext — often before any route is on screen — so the navigator has
/// to be reachable from outside the tree.
final navigatorKey = GlobalKey<NavigatorState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // Registered before anything else touches messaging. This is what keeps the
  // home-screen widgets current for a student who syncs on a laptop and does
  // not open the app: the server pushes on every sync and this wakes a
  // background isolate to redraw them.
  FirebaseMessaging.onBackgroundMessage(handleBackgroundMessage);

  repository = Repository(FirebaseFirestore.instance, FirebaseAuth.instance);
  final localNotifications = FlutterLocalNotificationsPlugin();
  reminders = Reminders(localNotifications);
  studyTimer = StudyTimer(localNotifications);
  push = Push(
    FirebaseMessaging.instance,
    localNotifications,
    FirebaseFirestore.instance,
    FirebaseAuth.instance,
  );
  await reminders.init();
  await settings.load();
  // After reminders.init(), which is what sets the notification plugin up —
  // a restored session needs to repost its ongoing notification.
  await studyTimer.restore();

  // A timetable push exists to answer "what moved", so tapping it opens the
  // diff. Wired here rather than inside Push because that class is built
  // before there is a navigator to hand it.
  push.onOpenTimetableChanges = (timetableId, version, section) {
    navigatorKey.currentState?.push(
      MaterialPageRoute<void>(
        builder: (_) => TimetableChangesScreen(
          timetableId: timetableId,
          version: version,
          section: section,
        ),
      ),
    );
  };

  runApp(const HandyApp());
}

class HandyApp extends StatelessWidget {
  const HandyApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Rebuilds the whole app when the student changes theme or accent, so the
    // change lands everywhere at once rather than on the next screen push.
    return ListenableBuilder(
      listenable: settings,
      builder: (context, _) => _app(),
    );
  }

  Widget _app() {
    return MaterialApp(
      title: 'Handy',
      navigatorKey: navigatorKey,
      debugShowCheckedModeBanner: false,
      theme: handyTheme(Brightness.light, settings.accent.colour),
      darkTheme: handyTheme(Brightness.dark, settings.accent.colour),
      themeMode: settings.themeMode,
      // builder puts the scope above the Navigator, so every route — including
      // pushed ones like subject detail — can read app state.
      builder: (context, child) => AppStateScope(state: appState, child: child!),
      home: const _AuthGate(),
    );
  }
}

/// Signed out shows sign-in; signed in shows the app. Firebase persists the
/// session, so a returning student lands straight on Today.
class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const _Splash();
        }
        return snapshot.data == null ? const SignInScreen() : const HomeShell();
      },
    );
  }
}


/// Shown for the instant before Firebase reports whether there's a session.
/// A skeleton would be a lie here — nothing is known about what comes next —
/// so this is the brand mark, matching the native splash it hands over from.
class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Container(
          width: 76,
          height: 76,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primary,
            borderRadius: BorderRadius.circular(24),
          ),
          alignment: Alignment.center,
          child: const Text(
            'H',
            style: TextStyle(fontSize: 38, fontWeight: FontWeight.w800, color: Colors.white),
          ),
        ),
      ),
    );
  }
}
