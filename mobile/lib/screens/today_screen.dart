import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../logic/attendance.dart';
import '../logic/deadlines.dart';
import '../logic/timetable.dart';
import '../main.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/class_tile.dart';

/// The screen that answers "what do I need to do today?" — the one a student
/// should be able to read in three seconds without tapping anything.
class TodayScreen extends StatelessWidget {
  const TodayScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);

    if (state.loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final now = DateTime.now();
    final nowHm = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    final blocks = classBlocksForDay(state.entries, now.weekday % 7);
    // The session you're in or heading to — matched on the merged block, so a
    // three-period lab counts as one thing to be "next".
    final next = blocks.where((b) => b.endTime.compareTo(nowHm) >= 0).firstOrNull;
    final free = todaysFreePeriodsOf(state);
    final dueSoon = state.tasks
        .where((t) => !t.done && getDeadline(t.dueDate, DateTime.now()).daysLeft <= soonDays)
        .toList();

    return Scaffold(
      // Sign-out lives in the You tab now — it has no business being one
      // mis-tap away from the screen you open every morning.
      appBar: AppBar(title: Text(_greeting(state.student?.name))),
      body: RefreshIndicator(
        onRefresh: () async => state.load(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            _AttendanceCard(percent: state.overallPercent, summaries: state.summaries),
            const SizedBox(height: 14),

            // Placed above everything but attendance: a class starting in ten
            // minutes is more urgent than any number on this screen.
            if (next != null) ...[
              _SectionLabel('Next class'),
              ClassTile(block: next, subject: state.subjectsById[next.first.subjectId], highlight: true),
              const SizedBox(height: 14),
            ],

            if (dueSoon.isNotEmpty) ...[
              _SectionLabel('Due soon'),
              ...dueSoon.map((t) => _DueRow(task: t)),
              const SizedBox(height: 14),
            ],

            _SectionLabel(blocks.isEmpty ? 'Today' : 'Today · ${blocks.length} classes'),
            if (blocks.isEmpty)
              const _Empty('No classes scheduled today.')
            else
              ...blocks.map((b) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: ClassTile(block: b, subject: state.subjectsById[b.first.subjectId]),
                  )),

            if (free.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                '${free.length} free period${free.length == 1 ? '' : 's'} today · '
                '${free.map((f) => f.startTime).join(', ')}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ),
    );
  }

  static String _greeting(String? name) {
    final hour = DateTime.now().hour;
    final part = hour < 12 ? 'Good morning' : (hour < 17 ? 'Good afternoon' : 'Good evening');
    final first = (name ?? '').split(' ').first;
    return first.isEmpty ? part : '$part, $first';
  }
}

List<FreePeriod> todaysFreePeriodsOf(AppState state) =>
    freePeriods(state.entries, DateTime.now().weekday % 7);

class _AttendanceCard extends StatelessWidget {
  const _AttendanceCard({required this.percent, required this.summaries});

  final double? percent;
  final List<AttendanceSummary> summaries;

  @override
  Widget build(BuildContext context) {
    final attended = summaries.fold<int>(0, (s, x) => s + x.attended);
    final held = summaries.fold<int>(0, (s, x) => s + x.held);
    final colour = statusColour(percent);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            SizedBox(
              width: 68,
              height: 68,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  CircularProgressIndicator(
                    value: (percent ?? 0) / 100,
                    strokeWidth: 7,
                    backgroundColor: Theme.of(context).dividerColor,
                    valueColor: AlwaysStoppedAnimation(colour),
                  ),
                  Text(
                    // Two decimals, matching the portal exactly — a student
                    // comparing the two must not see a different number.
                    percent == null ? '—' : '${percent!.toStringAsFixed(2)}%',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Overall attendance',
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text('$attended of $held classes',
                      style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DueRow extends StatelessWidget {
  const _DueRow({required this.task});
  final Task task;

  @override
  Widget build(BuildContext context) {
    final deadline = getDeadline(task.dueDate, DateTime.now(), done: task.done);
    final urgent = deadline.urgency == Urgency.overdue || deadline.urgency == Urgency.today;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Expanded(child: Text(task.title, overflow: TextOverflow.ellipsis)),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                decoration: BoxDecoration(
                  color: (urgent ? const Color(0xFFDC2626) : const Color(0xFFD97706))
                      .withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  deadline.label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: urgent ? const Color(0xFFDC2626) : const Color(0xFFD97706),
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

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, top: 4),
      child: Text(
        text.toUpperCase(),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
          color: Theme.of(context).textTheme.bodySmall?.color,
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Text(text, style: Theme.of(context).textTheme.bodySmall),
      );
}
