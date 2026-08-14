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

  /// Minutes before a class starts. Enough time to get moving, not so early
  /// that it becomes noise.
  static const classLeadMinutes = 15;

  static const _classChannel = AndroidNotificationDetails(
    'handy_classes',
    'Class reminders',
    channelDescription: 'Reminds you before each class, with the room and building.',
    importance: Importance.high,
    priority: Priority.high,
  );

  static const _taskChannel = AndroidNotificationDetails(
    'handy_tasks',
    'Deadlines',
    channelDescription: 'Reminds you about assignments and presentations that are due.',
    importance: Importance.high,
    priority: Priority.high,
  );

  Future<void> init() async {
    tzdata.initializeTimeZones();
    // Fixed to IST: this is an Aditya University app, and the right default
    // beats a wrong guess for every actual user.
    tz.setLocalLocation(tz.getLocation('Asia/Kolkata'));

    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );

    await _plugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
  }

  /// Rebuilds the whole schedule. Cancelling first is what stops a changed
  /// timetable from leaving last week's reminders behind.
  Future<void> reschedule({
    required List<TimetableEntry> entries,
    required List<Task> tasks,
    required Map<String, Subject> subjectsById,
  }) async {
    await _plugin.cancelAll();
    await _scheduleClasses(entries, subjectsById);
    await _scheduleTasks(tasks);
  }

  Future<void> _scheduleClasses(
    List<TimetableEntry> entries,
    Map<String, Subject> subjectsById,
  ) async {
    var id = 1000;
    for (final entry in entries.where((e) => e.active)) {
      final subject = subjectsById[entry.subjectId];
      final when = _nextOccurrence(entry.dayOfWeek, entry.startTime)
          .subtract(const Duration(minutes: classLeadMinutes));

      // Room *and* building: "AGBI-2.1" alone doesn't say which side of campus.
      final place = [
        entry.room,
        entry.block,
      ].where((p) => p != null && p.isNotEmpty).join(' · ');

      await _plugin.zonedSchedule(
        id: id++,
        title: '${subject?.shortName ?? 'Class'} in $classLeadMinutes min',
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

  Future<void> _scheduleTasks(List<Task> tasks) async {
    var id = 5000;
    final now = tz.TZDateTime.now(tz.local);

    for (final task in tasks.where((t) => !t.done)) {
      // Two nudges: two days out to start it, the evening before to finish it.
      for (final daysBefore in [2, 1]) {
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
          title: daysBefore == 1 ? 'Due tomorrow: ${task.title}' : '2 days left: ${task.title}',
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
