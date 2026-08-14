import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'data/reminders.dart';
import 'data/repository.dart';
import 'firebase_options.dart';
import 'screens/home_shell.dart';
import 'screens/sign_in_screen.dart';
import 'theme.dart';

late final Repository repository;
late final Reminders reminders;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  repository = Repository(FirebaseFirestore.instance, FirebaseAuth.instance);
  reminders = Reminders(FlutterLocalNotificationsPlugin());
  await reminders.init();

  runApp(const HandyApp());
}

class HandyApp extends StatelessWidget {
  const HandyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Handy',
      debugShowCheckedModeBanner: false,
      theme: handyTheme(Brightness.light),
      darkTheme: handyTheme(Brightness.dark),
      // Follows the phone, like the web app follows the browser.
      themeMode: ThemeMode.system,
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
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        return snapshot.data == null ? const SignInScreen() : const HomeShell();
      },
    );
  }
}
