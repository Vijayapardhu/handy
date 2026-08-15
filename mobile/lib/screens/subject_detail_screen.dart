import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../logic/attendance.dart';
import '../logic/deadlines.dart';
import '../logic/timetable.dart';
import '../models/models.dart';
import '../models/timetable_entry.dart';
import '../theme.dart';
import '../widgets/detail_row.dart';
import '../widgets/study_timer_card.dart';
import '../widgets/subject_class_content.dart';
import 'attendance_history_screen.dart';
import 'subjects_screen.dart';
import '../widgets/app_icon.dart';

const _dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/// One subject in full: where it stands, what it would take to fix, when it
/// meets, and anything the student has noted against it.
class SubjectDetailScreen extends StatelessWidget {
  const SubjectDetailScreen({super.key, required this.subject, required this.summary});

  final Subject subject;
  final AttendanceSummary? summary;

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    // Carried forward by anything marked since the last sync, so this page
    // agrees with the one that sent you here.
    final projected = state.projectedFor(subject.id);
    final attended = projected.attended;
    final held = projected.held;
    final percent = projected.percent;
    final colour = statusColour(percent);
    final canSkip = classesCanSkip(attended, held, SubjectsScreen.target);
    final needed = classesNeededForTarget(attended, held, SubjectsScreen.target);

    final classes = state.entries.where((e) => e.subjectId == subject.id && e.active).toList()
      ..sort((a, b) => a.dayOfWeek == b.dayOfWeek
          ? a.startTime.compareTo(b.startTime)
          : a.dayOfWeek.compareTo(b.dayOfWeek));

    final tasks = state.tasks.where((t) => t.subjectId == subject.id && !t.done).toList();

    return Scaffold(
      appBar: AppBar(title: Text(subject.shortName.isEmpty ? subject.name : subject.shortName)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          Text(subject.name, style: Theme.of(context).textTheme.headlineMedium),
          if (subject.facultyName.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(subject.facultyName, style: Theme.of(context).textTheme.bodySmall),
          ],
          const SizedBox(height: 20),

          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        percent == null ? '—' : percent.toStringAsFixed(2),
                        style: TextStyle(
                          fontSize: 42,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -1.5,
                          height: 1,
                          color: colour,
                        ),
                      ),
                      if (percent != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 5, left: 2),
                          child: Text('%',
                              style: TextStyle(
                                  fontSize: 18, fontWeight: FontWeight.w700, color: colour)),
                        ),
                      const Spacer(),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('$attended / $held',
                              style: Theme.of(context).textTheme.bodySmall),
                          if (projected.isProjected)
                            Text(
                              'estimated',
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                                color: Theme.of(context).colorScheme.primary,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: (percent ?? 0) / 100,
                      minHeight: 8,
                      backgroundColor: Theme.of(context).dividerColor,
                      valueColor: AlwaysStoppedAnimation(colour),
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 12),

          // The actionable half: what this percentage lets you do, or costs.
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _Label('What this means'),
                  const SizedBox(height: 10),
                  if (held == 0)
                    Text('No classes held yet this semester.',
                        style: Theme.of(context).textTheme.bodyMedium)
                  else if (canSkip > 0) ...[
                    _Fact(
                      icon: HugeIcons.strokeRoundedCalendarCheckIn01,
                      text: 'You can miss $canSkip more class${canSkip == 1 ? '' : 'es'} '
                          'and stay above ${SubjectsScreen.target.toInt()}%.',
                    ),
                    const SizedBox(height: 8),
                    _Fact(
                      icon: HugeIcons.strokeRoundedChartDown,
                      text: 'Missing the next one takes you to '
                          '${roundPercentage(calculateAttendance(attended, held + 1))!.toStringAsFixed(2)}%.',
                    ),
                  ] else ...[
                    _Fact(
                      icon: HugeIcons.strokeRoundedAlert02,
                      text: 'Below ${SubjectsScreen.target.toInt()}%. '
                          'Attend the next $needed in a row to get back above it.',
                      colour: colour,
                    ),
                    const SizedBox(height: 8),
                    _Fact(
                      icon: HugeIcons.strokeRoundedChartUp,
                      text: 'Attending the next one takes you to '
                          '${roundPercentage(calculateAttendance(attended + 1, held + 1))!.toStringAsFixed(2)}%.',
                    ),
                  ],
                ],
              ),
            ),
          ),

          const SizedBox(height: 12),
          StudyTimerCard(subject: subject),

          SubjectClassContent(
            subjectCode: subject.code,
            facultyId: subject.facultyId,
          ),

          const SizedBox(height: 12),
          Card(
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => AttendanceHistoryScreen(subjectId: subject.id),
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Row(
                  children: [
                    AppIcon(
                      HugeIcons.strokeRoundedCalendar03,
                      size: 19,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Attendance history',
                              style: TextStyle(fontWeight: FontWeight.w600)),
                          Text(
                            state.marks.where((m) => m.subjectId == subject.id).isEmpty
                                ? 'Nothing marked yet'
                                : '${state.marks.where((m) => m.subjectId == subject.id).length} '
                                    'marked',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    AppIcon(HugeIcons.strokeRoundedArrowRight01, size: 18),
                  ],
                ),
              ),
            ),
          ),

          if (tasks.isNotEmpty) ...[
            const SizedBox(height: 22),
            const _Label('Your tasks'),
            const SizedBox(height: 10),
            ...tasks.map((task) {
              final deadline = getDeadline(task.dueDate, DateTime.now());
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        Expanded(child: Text(task.title)),
                        Text(deadline.label,
                            style: const TextStyle(
                                fontSize: 12, fontWeight: FontWeight.w700, color: HandyColors.orange)),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ],

          if (classes.isNotEmpty) ...[
            const SizedBox(height: 22),
            const _Label('From the timetable'),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  children: [
                    // Everything the portal sends for this subject. Taken from
                    // the first slot: room, faculty and cohort are properties
                    // of the subject, not of the individual period.
                    DetailRow(label: 'Subject code', value: subject.code),
                    DetailRow(label: 'Short name', value: subject.shortName),
                    DetailRow(label: 'Faculty', value: classes.first.facultyName),
                    DetailRow(label: 'Room', value: classes.first.room),
                    DetailRow(label: 'Building', value: classes.first.block),
                    DetailRow(label: 'Type', value: _typeLabel(classes.first.type)),
                    DetailRow(
                      label: 'Class strength',
                      value: classes.first.strength == null
                          ? null
                          : '${classes.first.strength} students',
                    ),
                    DetailRow(
                      label: 'Opted',
                      // A cohort of 145 with 109 opted is two sections
                      // combined, which is why those slots sit in a different
                      // room from the rest.
                      value:
                          classes.first.opted == null ? null : '${classes.first.opted} students',
                    ),
                    DetailRow(
                      label: 'Weekly load',
                      value: '${classes.length} period${classes.length == 1 ? '' : 's'} · '
                          '${_weeklyHours(classes)}',
                      last: true,
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 22),
            const _Label('When it meets'),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: Column(
                  // Merged into blocks rather than listed period by period: a
                  // three-period lab is one session a student attends once,
                  // and listing it as three identical rows reads as three.
                  children: _meetings(classes).map((block) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 84,
                            child: Text(_dayNames[block.first.dayOfWeek].substring(0, 3),
                                style: Theme.of(context).textTheme.titleMedium),
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('${block.startTime} – ${block.endTime}'),
                                Text(
                                  _periodLabel(block),
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// Every day's classes merged into blocks, in week order.
  static List<ClassBlock> _meetings(List<TimetableEntry> classes) {
    final days = classes.map((e) => e.dayOfWeek).toSet().toList()..sort();
    return [for (final day in days) ...classBlocksForDay(classes, day)];
  }

  /// Period numbers when we have them, a plain count when we don't — syncs
  /// from before the portal's period numbers were captured have none.
  static String _periodLabel(ClassBlock block) {
    final first = block.first.periodNo;
    final last = block.entries.last.periodNo;
    if (first == null) return '${block.periods} period${block.periods == 1 ? '' : 's'}';
    if (block.isMerged && last != null && last != first) return 'Periods $first–$last';
    return 'Period $first';
  }

  static String _typeLabel(String type) => switch (type) {
        'lab' => 'Lab',
        'technical' => 'Technical',
        'activity' => 'Activity',
        _ => 'Lecture',
      };

  /// Total scheduled time across the week, as "6h 10m".
  static String _weeklyHours(List<TimetableEntry> classes) {
    int mins(String hhmm) {
      final parts = hhmm.split(':');
      return int.parse(parts[0]) * 60 + int.parse(parts[1]);
    }

    final total = classes.fold<int>(0, (sum, e) => sum + mins(e.endTime) - mins(e.startTime));
    final hours = total ~/ 60;
    final rest = total % 60;
    if (hours == 0) return '${rest}m';
    return rest == 0 ? '${hours}h' : '${hours}h ${rest}m';
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;

  @override
  Widget build(BuildContext context) =>
      Text(text.toUpperCase(), style: Theme.of(context).textTheme.labelSmall);
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.text, this.colour});

  final AppIconData icon;
  final String text;
  final Color? colour;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppIcon(icon, size: 17, color: colour ?? Theme.of(context).textTheme.bodySmall?.color),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: Theme.of(context).textTheme.bodyMedium)),
      ],
    );
  }
}
