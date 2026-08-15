import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart' show Color;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Firebase Cloud Messaging — the *server-initiated* half of notifications.
///
/// Class and deadline reminders are scheduled on-device instead (see
/// reminders.dart), because the timetable is known in advance and needs no
/// server. Push is for what only the server learns: a sync that changed the
/// numbers, or an announcement.
///
/// Tokens land in `students/{uid}.fcmTokens`, the same array the web app
/// writes and `api/notify.js` reads — one device per entry, so a phone and a
/// laptop both ring.
class Push {
  Push(this._messaging, this._local, this._db, this._auth);

  final FirebaseMessaging _messaging;
  final FlutterLocalNotificationsPlugin _local;
  final FirebaseFirestore _db;
  final FirebaseAuth _auth;

  /// One channel per kind of news, not one for everything.
  ///
  /// Attendance moves every week and is worth a glance; a timetable moves
  /// rarely and means rearranging your day. Android lets a student silence a
  /// channel, and lumping the two together meant silencing the important one
  /// to be rid of the routine one. The ids match what api/sync.js sends.
  static const _attendanceChannel = AndroidNotificationDetails(
    'handy_attendance',
    'Attendance updates',
    channelDescription: 'When your attendance figures change.',
    importance: Importance.defaultImportance,
    priority: Priority.defaultPriority,
    icon: 'ic_notification',
    color: Color(0xFFF97316),
  );

  static const _timetableChannel = AndroidNotificationDetails(
    'handy_timetable',
    'Timetable changes',
    channelDescription: "When your section's timetable is republished.",
    importance: Importance.high,
    priority: Priority.high,
    icon: 'ic_notification',
    color: Color(0xFFF97316),
  );

  static const _generalChannel = AndroidNotificationDetails(
    'handy_push',
    'Updates from Handy',
    channelDescription: 'Announcements.',
    importance: Importance.high,
    priority: Priority.high,
    icon: 'ic_notification',
    color: Color(0xFFF97316),
  );

  static AndroidNotificationDetails _channelFor(String? type) => switch (type) {
        'attendance' => _attendanceChannel,
        'timetable' => _timetableChannel,
        _ => _generalChannel,
      };

  /// Call once the student is signed in — the token is stored against their
  /// uid, so registering earlier would have nowhere to put it.
  Future<String?> register() async {
    final settings = await _messaging.requestPermission();
    if (settings.authorizationStatus == AuthorizationStatus.denied) return null;

    final token = await _messaging.getToken();
    if (token != null) await _saveToken(token);

    // Tokens rotate (app reinstall, restore to a new device); without this the
    // server keeps pushing to a dead one.
    _messaging.onTokenRefresh.listen(_saveToken);

    // A foreground message shows nothing by itself — Android hands it to the
    // app instead of the tray — so it's re-raised through the local plugin.
    FirebaseMessaging.onMessage.listen((message) {
      final notification = message.notification;
      if (notification == null) return;
      _local.show(
        id: message.hashCode,
        title: notification.title,
        body: notification.body,
        notificationDetails: NotificationDetails(
          android: _channelFor(message.data['type'] as String?),
        ),
      );
    });

    // Tapping one has to land somewhere useful. A timetable push exists to
    // answer "what moved", so it opens the diff rather than the app's home
    // screen and a hunt.
    FirebaseMessaging.onMessageOpenedApp.listen(_openFor);
    final initial = await _messaging.getInitialMessage();
    if (initial != null) _openFor(initial);

    return token;
  }

  /// Where a tapped notification should take you.
  void _openFor(RemoteMessage message) {
    if (message.data['type'] != 'timetable') return;
    final id = message.data['timetableId'] as String?;
    final version = int.tryParse(message.data['version'] as String? ?? '');
    if (id == null || version == null) return;

    onOpenTimetableChanges?.call(
      id,
      version,
      message.data['section'] as String?,
      message.data['notificationId'] as String?,
    );
  }

  /// Set by the app once its navigator exists. A callback rather than a
  /// Navigator reference because this class is constructed in main() before
  /// there is anything to navigate.
  void Function(
    String timetableId,
    int version,
    String? section,
    String? notificationId,
  )? onOpenTimetableChanges;

  Future<void> _saveToken(String token) async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return;
    await _db.collection('students').doc(uid).update({
      'fcmTokens': FieldValue.arrayUnion([token]),
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }
}
