import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../logic/attendance.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/skeleton.dart';
import 'subject_detail_screen.dart';

/// Every subject, ordered by risk rather than alphabetically — the one closest
/// to falling below target is the one a student needs to see first.
class SubjectsScreen extends StatelessWidget {
  const SubjectsScreen({super.key});

  static const target = 75.0;

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);

    if (state.loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Subjects')),
        body: const ListSkeleton(rows: 6, height: 118),
      );
    }

    final summaryBySubject = {for (final s in state.summaries) s.subjectId: s};

    final rows = state.subjects
        .map((subject) {
          final summary = summaryBySubject[subject.id];
          final percent = roundPercentage(
            calculateAttendance(summary?.attended ?? 0, summary?.held ?? 0),
          );
          return (subject: subject, summary: summary, percent: percent);
        })
        .toList()
      // Nulls (nothing held yet) sort last: they're not at risk, just unknown.
      ..sort((a, b) => (a.percent ?? 999).compareTo(b.percent ?? 999));

    final atRisk = rows.where((r) => r.percent != null && r.percent! < target).length;
    final safe = rows.where((r) => r.percent != null && r.percent! >= target).length;
    final attended = state.summaries.fold<int>(0, (sum, s) => sum + s.attended);
    final held = state.summaries.fold<int>(0, (sum, s) => sum + s.held);
    final overall = roundPercentage(calculateAttendance(attended, held));

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar.large(
            title: const Text('Subjects'),
            expandedHeight: 120,
          ),

          // The distribution before the list. Eight rows of percentages don't
          // add up to an impression on their own, and "how many am I actually
          // in trouble in" is the first thing anyone wants from this screen.
          SliverToBoxAdapter(
            child: _Overview(
              atRisk: atRisk,
              safe: safe,
              overall: overall,
              rows: rows,
            ),
          ),

          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            sliver: SliverList.separated(
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final row = rows[i];
                // A rule after the last subject below target: the list is
                // sorted by risk, so that boundary is real information and
                // worth drawing rather than leaving to be counted.
                final crossesLine = i > 0 &&
                    rows[i - 1].percent != null &&
                    rows[i - 1].percent! < target &&
                    (row.percent == null || row.percent! >= target);

                final card = _SubjectCard(
                  subject: row.subject,
                  summary: row.summary,
                  percent: row.percent,
                  rank: i + 1,
                );

                if (!crossesLine) return card;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(4, 4, 4, 14),
                      child: Row(
                        children: [
                          Text(
                            'ABOVE ${target.toInt()}%',
                            style: Theme.of(context).textTheme.labelSmall,
                          ),
                          const SizedBox(width: 10),
                          Expanded(child: Divider(color: Theme.of(context).dividerColor)),
                        ],
                      ),
                    ),
                    card,
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Overall figure, a split bar, and the count that matters.
class _Overview extends StatelessWidget {
  const _Overview({
    required this.atRisk,
    required this.safe,
    required this.overall,
    required this.rows,
  });

  final int atRisk;
  final int safe;
  final double? overall;
  final List<({Subject subject, AttendanceSummary? summary, double? percent})> rows;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).textTheme.bodySmall?.color;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    overall == null ? '—' : '${overall!.toStringAsFixed(2)}%',
                    style: TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -1.2,
                      height: 1,
                      color: statusColour(overall),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'across ${rows.length} subject${rows.length == 1 ? '' : 's'}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // One bar split by count, not by percentage — this is "how many
              // subjects", and a proportional bar would quietly answer a
              // different question.
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: SizedBox(
                  height: 8,
                  child: Row(
                    children: [
                      if (atRisk > 0)
                        Expanded(flex: atRisk, child: const ColoredBox(color: HandyColors.bad)),
                      if (safe > 0)
                        Expanded(flex: safe, child: const ColoredBox(color: HandyColors.good)),
                      if (atRisk == 0 && safe == 0)
                        Expanded(child: ColoredBox(color: Theme.of(context).dividerColor)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              Row(
                children: [
                  _Key(colour: HandyColors.bad, label: '$atRisk below target'),
                  const SizedBox(width: 16),
                  _Key(colour: HandyColors.good, label: '$safe safe'),
                  const Spacer(),
                  Text(
                    'sorted by risk',
                    style: TextStyle(fontSize: 11, color: muted),
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

class _Key extends StatelessWidget {
  const _Key({required this.colour, required this.label});
  final Color colour;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: colour, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _SubjectCard extends StatelessWidget {
  const _SubjectCard({
    required this.subject,
    required this.summary,
    required this.percent,
    required this.rank,
  });

  final Subject subject;
  final AttendanceSummary? summary;
  final double? percent;

  /// Position in the risk order. Shown because the list *is* a ranking, and a
  /// ranking with no numbers makes the reader count rows to place something.
  final int rank;

  @override
  Widget build(BuildContext context) {
    final colour = statusColour(percent);
    final attended = summary?.attended ?? 0;
    final held = summary?.held ?? 0;
    final canSkip = classesCanSkip(attended, held, SubjectsScreen.target);
    final needed = classesNeededForTarget(attended, held, SubjectsScreen.target);
    final below = percent != null && percent! < SubjectsScreen.target;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => SubjectDetailScreen(subject: subject, summary: summary),
          ),
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Status reads before any text does.
              Container(width: 4, color: below ? colour : Colors.transparent),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 16, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 24,
                            child: Text(
                              '$rank',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: Theme.of(context).textTheme.bodySmall?.color,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(subject.name, style: Theme.of(context).textTheme.titleMedium),
                                const SizedBox(height: 2),
                                Text(
                                  [
                                    if (subject.code.isNotEmpty) subject.code,
                                    '$attended of $held classes',
                                  ].join(' · '),
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            percent == null ? '—' : '${percent!.toStringAsFixed(2)}%',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.5,
                              fontFeatures: const [FontFeature.tabularFigures()],
                              color: colour,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      // The target line drawn on the bar, so "how far off am
                      // I" is a distance rather than a subtraction.
                      _TargetBar(percent: percent, colour: colour),
                      const SizedBox(height: 10),
                      // The number a student actually wants: not the
                      // percentage, but what it lets them do.
                      Text(
                        held == 0
                            ? 'No classes held yet'
                            : (canSkip > 0
                                ? 'You can miss $canSkip more and stay above ${SubjectsScreen.target.toInt()}%'
                                : 'Attend the next $needed to reach ${SubjectsScreen.target.toInt()}%'),
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color:
                              held == 0 ? Theme.of(context).textTheme.bodySmall?.color : colour,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Progress bar with the target line marked on it.
///
/// Positioned with Align rather than LayoutBuilder, which is not a style
/// preference: this sits inside an IntrinsicHeight (the card's full-height
/// status rail needs one), and LayoutBuilder cannot report intrinsic
/// dimensions. Using one here threw during layout and took the whole Subjects
/// screen blank with it — no red error box, just nothing.
///
/// Align maps a fraction of the width to x = 2f - 1, so the marker lands at
/// the target without anyone needing to measure.
class _TargetBar extends StatelessWidget {
  const _TargetBar({required this.percent, required this.colour});

  final double? percent;
  final Color colour;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 6,
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: (percent ?? 0) / 100,
              minHeight: 6,
              backgroundColor: Theme.of(context).dividerColor,
              valueColor: AlwaysStoppedAnimation(colour),
            ),
          ),
          Positioned.fill(
            child: Align(
              alignment: Alignment(2 * SubjectsScreen.target / 100 - 1, 0),
              child: Container(
                width: 2,
                height: 6,
                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.55),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
