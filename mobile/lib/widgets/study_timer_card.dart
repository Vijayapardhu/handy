import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/study_timer.dart';
import '../main.dart';
import '../models/models.dart';
import 'app_icon.dart';

/// Start, pause and stop a study session for one subject.
///
/// Placed on the subject page rather than under Deadlines: a study session is
/// time spent on a subject, not a thing that is due, and the name "Deadlines"
/// would have made it the odd one out in its own module.
///
/// Only one session runs at a time, and starting one on a second subject
/// switches to it. Two concurrent timers would just be two wrong figures.
class StudyTimerCard extends StatelessWidget {
  const StudyTimerCard({super.key, required this.subject});

  final Subject subject;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: studyTimer,
      builder: (context, _) {
        final scheme = Theme.of(context).colorScheme;
        final mine = studyTimer.subjectId == subject.id;
        final elsewhere = studyTimer.hasSession && !mine;

        return Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    AppIcon(
                      HugeIcons.strokeRoundedClock01,
                      size: 18,
                      color: mine && studyTimer.isRunning
                          ? scheme.primary
                          : Theme.of(context).textTheme.bodySmall?.color,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'STUDY TIMER',
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                    ),
                    if (mine)
                      Text(
                        StudyTimer.format(studyTimer.elapsed),
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.8,
                          // Tabular figures, or the whole row twitches every
                          // second as the digits change width.
                          fontFeatures: const [FontFeature.tabularFigures()],
                          color: studyTimer.isRunning ? scheme.primary : null,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),

                if (elsewhere)
                  Text(
                    'A session is running on ${studyTimer.subjectName ?? 'another subject'}. '
                    'Starting one here will switch to it.',
                    style: Theme.of(context).textTheme.bodySmall,
                  )
                else if (!mine)
                  Text(
                    'Runs on your lock screen, so you can leave the phone alone '
                    'and still see it.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),

                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.tonalIcon(
                        onPressed: () async {
                          HapticFeedback.selectionClick();
                          if (mine && studyTimer.isRunning) {
                            await studyTimer.pause();
                          } else {
                            // Switching subjects ends the old session rather
                            // than silently crediting its time to this one.
                            if (elsewhere) await studyTimer.stop();
                            await studyTimer.start(
                              subjectId: subject.id,
                              subjectName: subject.shortName.isEmpty
                                  ? subject.name
                                  : subject.shortName,
                            );
                          }
                        },
                        icon: AppIcon(
                          mine && studyTimer.isRunning
                              ? HugeIcons.strokeRoundedMinusSign
                              : HugeIcons.strokeRoundedPlayCircle,
                          size: 18,
                        ),
                        label: Text(
                          mine && studyTimer.isRunning
                              ? 'Pause'
                              : (mine ? 'Resume' : 'Start'),
                        ),
                      ),
                    ),
                    if (mine) ...[
                      const SizedBox(width: 10),
                      OutlinedButton(
                        onPressed: () async {
                          final total = await studyTimer.stop();
                          if (!context.mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                'Studied ${StudyTimer.format(total)} '
                                '${subject.shortName.isEmpty ? '' : 'of ${subject.shortName}'}'
                                    .trim(),
                              ),
                            ),
                          );
                        },
                        child: const Text('Stop'),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
