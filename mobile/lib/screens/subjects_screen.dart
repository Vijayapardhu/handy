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

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar.large(
            title: const Text('Subjects'),
            expandedHeight: 120,
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: Text(
                atRisk == 0
                    ? 'All subjects are above ${target.toInt()}%.'
                    : '$atRisk subject${atRisk == 1 ? '' : 's'} below ${target.toInt()}%.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 28),
            sliver: SliverList.separated(
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final row = rows[i];
                return _SubjectCard(
                  subject: row.subject,
                  summary: row.summary,
                  percent: row.percent,
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _SubjectCard extends StatelessWidget {
  const _SubjectCard({required this.subject, required this.summary, required this.percent});

  final Subject subject;
  final AttendanceSummary? summary;
  final double? percent;

  @override
  Widget build(BuildContext context) {
    final colour = statusColour(percent);
    final attended = summary?.attended ?? 0;
    final held = summary?.held ?? 0;
    final canSkip = classesCanSkip(attended, held, SubjectsScreen.target);
    final needed = classesNeededForTarget(attended, held, SubjectsScreen.target);

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => SubjectDetailScreen(subject: subject, summary: summary),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(subject.name, style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 2),
                        Text('$attended of $held classes',
                            style: Theme.of(context).textTheme.bodySmall),
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
                      color: colour,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: (percent ?? 0) / 100,
                  minHeight: 6,
                  backgroundColor: Theme.of(context).dividerColor,
                  valueColor: AlwaysStoppedAnimation(colour),
                ),
              ),
              const SizedBox(height: 10),
              // The number a student actually wants: not the percentage, but
              // what it lets them do.
              Text(
                held == 0
                    ? 'No classes held yet'
                    : (canSkip > 0
                        ? 'You can miss $canSkip more and stay above ${SubjectsScreen.target.toInt()}%'
                        : 'Attend the next $needed to reach ${SubjectsScreen.target.toInt()}%'),
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: held == 0 ? Theme.of(context).textTheme.bodySmall?.color : colour,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
