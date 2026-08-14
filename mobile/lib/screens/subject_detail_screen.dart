import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../logic/attendance.dart';
import '../logic/deadlines.dart';
import '../models/models.dart';
import '../theme.dart';
import 'subjects_screen.dart';

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
    final attended = summary?.attended ?? 0;
    final held = summary?.held ?? 0;
    final percent = roundPercentage(calculateAttendance(attended, held));
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
                      Text('$attended / $held',
                          style: Theme.of(context).textTheme.bodySmall),
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
                      icon: Icons.event_available_outlined,
                      text: 'You can miss $canSkip more class${canSkip == 1 ? '' : 'es'} '
                          'and stay above ${SubjectsScreen.target.toInt()}%.',
                    ),
                    const SizedBox(height: 8),
                    _Fact(
                      icon: Icons.trending_down,
                      text: 'Missing the next one takes you to '
                          '${roundPercentage(calculateAttendance(attended, held + 1))!.toStringAsFixed(2)}%.',
                    ),
                  ] else ...[
                    _Fact(
                      icon: Icons.priority_high,
                      text: 'Below ${SubjectsScreen.target.toInt()}%. '
                          'Attend the next $needed in a row to get back above it.',
                      colour: colour,
                    ),
                    const SizedBox(height: 8),
                    _Fact(
                      icon: Icons.trending_up,
                      text: 'Attending the next one takes you to '
                          '${roundPercentage(calculateAttendance(attended + 1, held + 1))!.toStringAsFixed(2)}%.',
                    ),
                  ],
                ],
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
            const _Label('When it meets'),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: Column(
                  children: classes.map((entry) {
                    final place = [entry.room, entry.block]
                        .whereType<String>()
                        .where((p) => p.isNotEmpty)
                        .join(' · ');
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 84,
                            child: Text(_dayNames[entry.dayOfWeek].substring(0, 3),
                                style: Theme.of(context).textTheme.titleMedium),
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('${entry.startTime} – ${entry.endTime}'),
                                if (place.isNotEmpty)
                                  Text(place, style: Theme.of(context).textTheme.bodySmall),
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

  final IconData icon;
  final String text;
  final Color? colour;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 17, color: colour ?? Theme.of(context).textTheme.bodySmall?.color),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: Theme.of(context).textTheme.bodyMedium)),
      ],
    );
  }
}
