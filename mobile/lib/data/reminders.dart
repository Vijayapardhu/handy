import 'package:flutter/material.dart' show Color;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../logic/timetable.dart';
import '../models/models.dart';
import '../models/timetable_entry.dart';

/// On-device reminders.
///
/// Deliberately *local* rather than server push: the timetable is known a week
/// in advance and doesn't change between syncs, so scheduling on the device
/// needs no backend, no FCM token, and keeps working with no signal. Push stays
/// for the things only a server learns, like a sync changing the numbers.
class Reminders {
  Reminders(this._plugin);

  final FlutterLocalNotificationsPlugin _plugin;

  /// Default minutes before a class starts. Enough time to get moving, not so
  /// early that it becomes noise — but a student living on campus and one
  /// commuting want different numbers, so this is only the starting point
  /// (see AppSettings.classLeadMinutes).
  static const defaultClassLeadMinutes = 15;

  static const _classChannel = AndroidNotificationDetails(
    'handy_classes',
    'Class reminders',
    channelDescription: 'Reminds you before each class, with the room and building.',
    importance: Importance.high,
    priority: Priority.high,
    // Silhouette for the status bar; the colour tints the small icon and the
    // notification's accent line.
    icon: 'ic_notification',
    color: Color(0xFFF97316),
  );

  static const _taskChannel = AndroidNotificationDetails(
    'handy_tasks',
    'Deadlines',
    channelDescription: 'Reminds you about assignments and presentations that are due.',
    importance: Importance.high,
    priority: Priority.high,
     icon: 'ic_notification',
    color: Color(0xFFF97316),
  );

  Future<void> init() async {
    tzdata.initializeTimeZones();
    // Fixed to IST: this is an Aditya University app, and the right default
    // beats a wrong guess for every actual user.
    tz.setLocalLocation(tz.getLocation('Asia/Kolkata'));

    await _plugin.initialize(
      settings: const InitializationSettings(
        // The status-bar icon must be a white-on-transparent silhouette;
        // pointing this at ic_launcher renders the orange tile as a white
        // blob. See tool/make_icon.mjs.
        android: AndroidInitializationSettings('@drawable/ic_notification'),
        iOS: DarwinInitializationSettings(),
      ),
    );

    await _plugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
  }

  /// Rebuilds the whole schedule. Clearing first is what stops a changed
  /// timetable from leaving last week's reminders behind.
  ///
  /// Deliberately *not* `cancelAll()`. That call goes through to Android's
  /// `NotificationManager.cancelAll()`, which clears every notification the
  /// app has posted — including ones delivered by Firebase Messaging that this
  /// plugin never created. Since a sync push is immediately followed by a
  /// reschedule, the "new data" notification was being wiped out of the shade
  /// a moment after arriving: it appeared, then vanished on its own.
  ///
  /// Only *pending* (scheduled, not yet fired) reminders are cancelled here,
  /// which is all this method ever meant to clear.
  Future<void> reschedule({
    required List<TimetableEntry> entries,
    required List<Task> tasks,
    required Map<String, Subject> subjectsById,
    bool classes = true,
    bool deadlines = true,
    int classLeadMinutes = 15,
    int deadlineLeadDays = 2,
  }) async {
    for (final pending in await _plugin.pendingNotificationRequests()) {
      await _plugin.cancel(id: pending.id);
    }
    // Switching a kind off has to unschedule what is already queued, not just
    // stop adding more — reminders are scheduled weeks ahead, so skipping the
    // next scheduling pass would leave a month of them still to fire. That is
    // why the cancel above happens unconditionally and these gate the rebuild.
    if (classes) await _scheduleClasses(entries, subjectsById, classLeadMinutes);
    if (deadlines) await _scheduleTasks(tasks, deadlineLeadDays);
  }

  Future<void> _scheduleClasses(
    List<TimetableEntry> entries,
    Map<String, Subject> subjectsById,
    int leadMinutes,
  ) async {
    var id = 1000;
    for (final entry in entries.where((e) => e.active)) {
      final subject = subjectsById[entry.subjectId];
      final when = _nextOccurrence(entry.dayOfWeek, entry.startTime)
          .subtract(Duration(minutes: leadMinutes));

      // Room *and* building: "AGBI-2.1" alone doesn't say which side of campus.
      final place = [
        entry.room,
        entry.block,
      ].where((p) => p != null && p.isNotEmpty).join(' · ');

      await _plugin.zonedSchedule(
        id: id++,
        title: '${subject?.shortName ?? 'Class'} in $leadMinutes min',
        body: place.isEmpty ? entry.facultyName : place,
        scheduledDate: when,
        notificationDetails: const NotificationDetails(
          android: _classChannel,
          iOS: DarwinNotificationDetails(),
        ),
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        // Weekly repeat, so one pass covers the whole semester.
        matchDateTimeComponents: DateTimeComponents.dayOfWeekAndTime,
      );
    }
  }

  Future<void> _scheduleTasks(List<Task> tasks, int leadDays) async {
    var id = 5000;
    final now = tz.TZDateTime.now(tz.local);

    // A deadline pinned to a free period gets a reminder when that period
    // starts. This is the one reminder that arrives while a student is
    // actually able to act on it — the other two arrive at six in the evening
    // and are only ever a note to self.
    for (final task in tasks.where((t) => !t.done && t.isAttached)) {
      final when = _nextOccurrence(task.attachDay!, task.attachTime!);
      final due = tz.TZDateTime(
        tz.local,
        task.dueDate.year,
        task.dueDate.month,
        task.dueDate.day,
        23,
        59,
      );
      // Only if that slot still falls before the deadline; a weekly repeat
      // past the due date would nag about something already late.
      if (when.isAfter(due) || when.isBefore(now)) continue;

      await _plugin.zonedSchedule(
        id: id++,
        title: 'Free period — ${task.title}',
        body: 'You planned this for now. ${taskKindLabels[task.kind] ?? ''}'.trim(),
        scheduledDate: when,
        notificationDetails: const NotificationDetails(
          android: _taskChannel,
          iOS: DarwinNotificationDetails(),
        ),
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      );
    }

    for (final task in tasks.where((t) => !t.done)) {
      // Two nudges: one to start it, and the evening before to finish it. The
      // first is configurable because two days suits an assignment and is
      // useless for a lab record that takes a week; the second is not, because
      // it is the one that stops something being forgotten outright.
      //
      // A set, so a lead of one day does not schedule the same evening twice.
      for (final daysBefore in {leadDays, 1}) {
        final due = tz.TZDateTime(
          tz.local,
          task.dueDate.year,
          task.dueDate.month,
          task.dueDate.day,
          18,
        );
        final when = due.subtract(Duration(days: daysBefore));
        if (when.isBefore(now)) continue;

        await _plugin.zonedSchedule(
          id: id++,
          title: daysBefore == 1
              ? 'Due tomorrow: ${task.title}'
              : '$daysBefore days left: ${task.title}',
          body: taskKindLabels[task.kind] ?? 'Reminder',
          scheduledDate: when,
          notificationDetails: const NotificationDetails(
            android: _taskChannel,
            iOS: DarwinNotificationDetails(),
          ),
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        );
      }
    }
  }

  /// The next time this weekday-and-time comes round, today included when it
  /// hasn't passed yet.
  tz.TZDateTime _nextOccurrence(int dayOfWeek, String hhmm) {
    final parts = hhmm.split(':');
    final hour = int.tryParse(parts.first) ?? 0;
    final minute = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;

    final now = tz.TZDateTime.now(tz.local);
    var candidate = tz.TZDateTime(tz.local, now.year, now.month, now.day, hour, minute);
    // DateTime.weekday is 1..7 (Mon..Sun); dayOfWeek here is 0..6 (Sun..Sat).
    while (candidate.weekday % 7 != dayOfWeek || candidate.isBefore(now)) {
      candidate = candidate.add(const Duration(days: 1));
    }
    return candidate;
  }
}

/// Free periods today — the honest answer to "when can I actually work?".
List<FreePeriod> todaysFreePeriods(List<TimetableEntry> entries) {
  return freePeriods(entries, DateTime.now().weekday % 7);
}
