import 'dart:async';

import 'package:flutter/material.dart' show Color, ChangeNotifier;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A study session, with a notification that stays on the lock screen while it
/// runs.
///
/// The notification is the feature, not decoration. A timer you have to unlock
/// the phone and open an app to check is a timer you stop trusting, and the
/// moment you stop trusting it you start checking it — which is the thing a
/// study session cannot survive. Ongoing and not dismissable, so it sits above
/// the noise and can be glanced at from a locked screen.
///
/// Survives the app being killed, but does not lie about it.
///
/// Android will stop a backgrounded app whenever it wants, and losing an
/// hour's session to that is worse than useless. So the session is written
/// down and picked back up. What it will not do is *keep running* through a
/// gap it cannot vouch for: a timer restored after four hours would be
/// crediting the student with work they may never have done. Anything older
/// than [staleAfter] comes back paused at the time it had already earned,
/// which is the honest half of the answer, and leaves the decision with the
/// person who knows.
class StudyTimer extends ChangeNotifier {
  StudyTimer(this._plugin);

  final FlutterLocalNotificationsPlugin _plugin;

  /// A fixed id, so each tick replaces the notification rather than stacking.
  static const _notificationId = 9100;

  /// Past this, a restored session comes back paused rather than running.
  /// Long enough to cover a phone being killed mid-session and reopened after
  /// a lecture; short enough that an overnight gap is never counted.
  static const staleAfter = Duration(hours: 3);

  static const _startedKey = 'handy.timer.startedAt';
  static const _accumulatedKey = 'handy.timer.accumulated';
  static const _subjectIdKey = 'handy.timer.subjectId';
  static const _subjectNameKey = 'handy.timer.subjectName';

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

  /// Picks up a session the app was killed in the middle of.
  ///
  /// Called once at startup. A session inside [staleAfter] resumes running —
  /// the student was almost certainly still studying. An older one comes back
  /// paused with the time it had earned up to the moment the app died, since
  /// the gap after that is unaccounted for and counting it would be a guess.
  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    final startedAt = prefs.getString(_startedKey);
    final accumulated = prefs.getInt(_accumulatedKey) ?? 0;
    if (startedAt == null && accumulated == 0) return;

    subjectId = prefs.getString(_subjectIdKey);
    subjectName = prefs.getString(_subjectNameKey);
    _accumulated = Duration(seconds: accumulated);

    final started = startedAt == null ? null : DateTime.tryParse(startedAt);
    if (started == null) {
      // Was paused when the app died; nothing to reconcile.
      await _show(paused: true);
      notifyListeners();
      return;
    }

    final gap = DateTime.now().difference(started);
    if (gap <= staleAfter) {
      _accumulated += gap;
      await _persist();
      await start(subjectId: subjectId, subjectName: subjectName);
      return;
    }

    // Too long ago to vouch for. Keep what was banked before the app died and
    // let the student restart if they were in fact still working.
    _startedAt = null;
    await _persist();
    await _show(paused: true);
    notifyListeners();
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    if (_startedAt == null) {
      await prefs.remove(_startedKey);
    } else {
      await prefs.setString(_startedKey, _startedAt!.toIso8601String());
    }
    await prefs.setInt(_accumulatedKey, _accumulated.inSeconds);
    await prefs.setString(_subjectIdKey, subjectId ?? '');
    await prefs.setString(_subjectNameKey, subjectName ?? '');
  }

  Future<void> _forget() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_startedKey);
    await prefs.remove(_accumulatedKey);
    await prefs.remove(_subjectIdKey);
    await prefs.remove(_subjectNameKey);
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

    await _persist();
    await _show();
    notifyListeners();
  }

  Future<void> pause() async {
    if (!isRunning) return;
    _accumulated = elapsed;
    _startedAt = null;
    _ticker?.cancel();
    _ticker = null;
    await _persist();
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
    await _forget();
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
