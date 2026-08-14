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

  static const _channel = AndroidNotificationDetails(
    'handy_push',
    'Updates from Handy',
    channelDescription: 'Attendance changes and announcements.',
    importance: Importance.high,
    priority: Priority.high,
     icon: 'ic_notification',
    color: Color(0xFFF97316),
  );

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
        notificationDetails: const NotificationDetails(android: _channel),
      );
    });

    return token;
  }

  Future<void> _saveToken(String token) async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return;
    await _db.collection('students').doc(uid).update({
      'fcmTokens': FieldValue.arrayUnion([token]),
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }
}
