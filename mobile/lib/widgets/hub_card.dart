import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../logic/hub_status.dart';
import '../logic/planning.dart';
import '../screens/hub_attendance_screen.dart';
import 'code_forge_loading.dart';
import '../widgets/app_icon.dart';

/// CodeForge attendance, as the second face of the Today screen's attendance
/// card — the same pair the web swipes between on Home.
///
/// Built to the rhythm of the card it sits behind rather than as a smaller,
/// flatter thing: same height, same label-then-number-then-bar order, same
/// footnote. A swipe between the two should feel like turning one card over,
/// not landing on a different component.
///
/// Read-only. Connecting and disconnecting live on one screen, so a credential
/// is entered in exactly one place; this shows what is there, or points at
/// where to set it up.
class CodeForgeCard extends StatelessWidget {
  const CodeForgeCard({super.key, required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final result = state.codeForge;
    // Nothing in hand yet. Falling through would render "Not linked", which is
    // a claim about this student's account rather than about what Handy has got
    // round to asking — and it is wrong for everyone who *is* linked.
    if (result == null) {
      return state.codeForgeLoading
          ? const CodeForgeCardSkeleton(fill: true)
          // Not loading and nothing to show means the gate upstream decided
          // there was nothing to fetch. Say nothing rather than guess.
          : const SizedBox.shrink();
    }

    final snapshot = result.snapshot;
    final linked = result.linked;
    // CodeForge only. A student's Maya login also carries the Arithmetic,
    // Logical and Verbal ability courses, and summing all of them gave a figure
    // that was not CodeForge attendance — see HubCourse.isCodeForge.
    final percent = linked ? snapshot?.codeForgePercentage : null;
    final status = hubStatus(percent);
    final courses = snapshot?.codeForgeCourses.length ?? 0;
    final next = daysToAttend(
      classes: 1,
      entries: state.entries,
      from: DateTime.now(),
      type: 'technical',
    )?.on;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () async {
          await Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const HubAttendanceScreen()),
          );
          // Connecting or disconnecting happens through there, so this has to
          // re-read rather than go on showing what was true before.
          await state.loadCodeForge();
        },
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'CODEFORGE ATTENDANCE',
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                  ),
                  AppIcon(HugeIcons.strokeRoundedArrowRight01, size: 16),
                ],
              ),
              const SizedBox(height: 10),

              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  // The word takes the number's place rather than sitting in a
                  // block of its own, so both faces are the same shape and the
                  // card does not resize as it is swiped.
                  Text(
                    !linked
                        ? 'Not linked'
                        : (percent == null ? '—' : percent.toStringAsFixed(2)),
                    style: TextStyle(
                      fontSize: linked ? 60 : 34,
                      fontWeight: FontWeight.w800,
                      letterSpacing: linked ? -3 : -1,
                      height: 1,
                      fontFeatures: const [FontFeature.tabularFigures()],
                      color: linked
                          ? status.colour
                          : Theme.of(context).textTheme.bodySmall?.color,
                    ),
                  ),
                  if (linked && percent != null)
                    Padding(
                      padding: const EdgeInsets.only(left: 3),
                      child: Text(
                        '%',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          color: status.colour,
                        ),
                      ),
                    ),
                  const Spacer(),
                  if (linked)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text(
                        '${snapshot?.codeForgeAttended ?? 0} / '
                        '${snapshot?.codeForgeTotal ?? 0}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                ],
              ),
              const Spacer(),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: linked ? (percent ?? 0) / 100 : 0,
                  minHeight: 7,
                  backgroundColor: Theme.of(context).dividerColor,
                  valueColor: AlwaysStoppedAnimation(status.colour),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  AppIcon(
                    HugeIcons.strokeRoundedCode,
                    size: 16,
                    color: Theme.of(context).textTheme.bodySmall?.color,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      !linked
                          ? 'Tap to sign in with your CodeForge login'
                          : [
                              courses == 0
                                  ? 'No sessions reported yet'
                                  : '$courses course${courses == 1 ? '' : 's'} tracked',
                              // The one actionable thing this card can say.
                              // CodeForge has no target to reach — Maya sets
                              // none — so "attend N more" would be inventing a
                              // rule. When the next session is, though, is a
                              // fact, and it comes off the same timetable as
                              // everything else: the Technical Hour period.
                              if (next case final on?) 'next ${shortWhen(on)}',
                            ].join('  ·  '),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Theme.of(context).textTheme.bodySmall?.color,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
