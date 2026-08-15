import 'dart:async';

import 'package:flutter/material.dart' show Color, ChangeNotifier;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// A study session, with a notification that stays on the lock screen while it
/// runs.
///
/// The notification is the feature, not decoration. A timer you have to unlock
/// the phone and open an app to check is a timer you stop trusting, and the
/// moment you stop trusting it you start checking it — which is the thing a
/// study session cannot survive. Ongoing and not dismissable, so it sits above
/// the noise and can be glanced at from a locked screen.
///
/// Deliberately not persisted across a process death. A session Handy cannot
/// prove is still running is one it should not claim: reviving a timer that
/// has been dead for four hours and calling it a study session would be
/// inventing work the student never did.
class StudyTimer extends ChangeNotifier {
  StudyTimer(this._plugin);

  final FlutterLocalNotificationsPlugin _plugin;

  /// A fixed id, so each tick replaces the notification rather than stacking.
  static const _notificationId = 9100;

  static const _channel = AndroidNotificationDetails(
    'handy_study',
    'Study timer',
    channelDescription: 'Shows a running study session on your lock screen.',
    importance: Importance.low,
    priority: Priority.low,
    icon: 'ic_notification',
    color: Color(0xFFF97316),
    ongoing: true,
    autoCancel: false,
    // Low importance keeps it silent and out of the way; showWhen false stops
    // Android printing a start time next to a figure that already is one.
    showWhen: false,
    onlyAlertOnce: true,
  );

  Timer? _ticker;
  DateTime? _startedAt;
  Duration _accumulated = Duration.zero;

  String? subjectId;
  String? subjectName;

  bool get isRunning => _ticker != null;
  bool get hasSession => _startedAt != null || _accumulated > Duration.zero;

  Duration get elapsed {
    if (_startedAt == null) return _accumulated;
    return _accumulated + DateTime.now().difference(_startedAt!);
  }

  Future<void> start({String? subjectId, String? subjectName}) async {
    if (isRunning) return;
    this.subjectId = subjectId ?? this.subjectId;
    this.subjectName = subjectName ?? this.subjectName;

    _startedAt = DateTime.now();
    // Every second on screen, but the notification is only rewritten each
    // minute — a lock-screen figure that changes every second is a distraction
    // and costs a wakeup for every one of them.
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      notifyListeners();
      if (elapsed.inSeconds % 60 == 0) _show();
    });

    await _show();
    notifyListeners();
  }

  Future<void> pause() async {
    if (!isRunning) return;
    _accumulated = elapsed;
    _startedAt = null;
    _ticker?.cancel();
    _ticker = null;
    await _show(paused: true);
    notifyListeners();
  }

  /// Ends the session and returns how long it ran, so the caller can record it.
  Future<Duration> stop() async {
    final total = elapsed;
    _ticker?.cancel();
    _ticker = null;
    _startedAt = null;
    _accumulated = Duration.zero;
    subjectId = null;
    subjectName = null;
    await _plugin.cancel(id: _notificationId);
    notifyListeners();
    return total;
  }

  Future<void> _show({bool paused = false}) async {
    await _plugin.show(
      id: _notificationId,
      title: paused ? 'Paused — ${format(elapsed)}' : 'Studying — ${format(elapsed)}',
      body: subjectName ?? 'Tap to open Handy',
      notificationDetails: const NotificationDetails(
        android: _channel,
        iOS: DarwinNotificationDetails(presentSound: false),
      ),
    );
  }

  /// "1:04:12" past an hour, "4:12" under it — an hour-place that is always
  /// zero is a digit the reader has to skip.
  static String format(Duration d) {
    final hours = d.inHours;
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return hours > 0 ? '$hours:$minutes:$seconds' : '$minutes:$seconds';
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }
}
