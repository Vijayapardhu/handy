import 'dart:async';

import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../main.dart';
import '../logic/attendance.dart';
import '../logic/deadlines.dart';
import '../logic/timetable.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/class_tile.dart';
import 'subject_detail_screen.dart';
import 'subjects_screen.dart';

/// The screen that answers "what do I need to do today?".
///
/// Ordered by urgency rather than by category: the number that decides
/// everything, then the class that's about to start, then what's due, then the
/// day itself. A student should get the answer without scrolling or tapping.
class TodayScreen extends StatefulWidget {
  const TodayScreen({super.key});

  @override
  State<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends State<TodayScreen> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    // The countdown and the "done so far" line are both time-relative, so the
    // screen has to re-read the clock. Every 20s is well under the resolution
    // anyone notices, and costs nothing.
    _tick = Timer.periodic(const Duration(seconds: 20), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);

    if (state.loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final now = DateTime.now();
    final nowHm =
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    final blocks = classBlocksForDay(state.entries, now.weekday % 7);
    final next = blocks
        .where((b) => b.endTime.compareTo(nowHm) >= 0)
        .firstOrNull;
    final done = blocks.where((b) => b.endTime.compareTo(nowHm) < 0).length;
    final free = freePeriods(state.entries, now.weekday % 7);

    final dueSoon =
        state.tasks
            .where(
              (t) =>
                  !t.done && getDeadline(t.dueDate, now).daysLeft <= soonDays,
            )
            .toList()
          ..sort((a, b) => a.dueDate.compareTo(b.dueDate));

    return Scaffold(
      body: SafeArea(
        // bottom: false because the nav bar draws its own inset. Without this
        // the greeting scrolls up under the status bar.
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () async => state.load(),
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  // Deliberate, generous header rather than an AppBar: the
                  // greeting is content, not chrome, and the old bar left it
                  // cramped against the status bar.
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _dateLine(now),
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        _greeting(settings.greetingName(state.student?.name)),
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
                sliver: SliverList.list(
                  children: [
                    _AttendanceHero(state: state),
                    const SizedBox(height: 12),

                    if (next != null) ...[
                      _NextClassCard(
                        block: next,
                        subject: state.subjectsById[next.first.subjectId],
                      ),
                      const SizedBox(height: 12),
                    ],

                    if (blocks.isNotEmpty) ...[
                      _DayProgress(
                        done: done,
                        total: blocks.length,
                        free: free.length,
                      ),
                      const SizedBox(height: 20),
                    ],

                    if (dueSoon.isNotEmpty) ...[
                      const _Label('Due soon'),
                      const SizedBox(height: 8),
                      ...dueSoon.map((t) => _DueRow(task: t, state: state)),
                      const SizedBox(height: 20),
                    ],

                    _AtRiskStrip(state: state),

                    const _Label('Today'),
                    const SizedBox(height: 8),
                    if (blocks.isEmpty)
                      _Quiet(
                        'No classes scheduled today.' +
                            (free.isEmpty ? '' : ' The whole day is yours.'),
                      )
                    else
                      ...blocks.map(
                        (b) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Opacity(
                            // Classes already finished fade back — they're
                            // context, not something to act on.
                            opacity: b.endTime.compareTo(nowHm) < 0 ? 0.45 : 1,
                            child: ClassTile(
                              block: b,
                              subject: state.subjectsById[b.first.subjectId],
                            ),
                          ),
                        ),
                      ),

                    if (free.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      _FreeTimeNote(free: free),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _greeting(String name) {
    final hour = DateTime.now().hour;
    final part = hour < 12
        ? 'Good morning'
        : (hour < 17 ? 'Good afternoon' : 'Good evening');
    return name.isEmpty ? part : '$part, $name';
  }

  static const _days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  static const _months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  static String _dateLine(DateTime now) =>
      '${_days[now.weekday % 7]}, ${now.day} ${_months[now.month - 1]}';
}

/// The number that decides everything, at the size that says so.
class _AttendanceHero extends StatelessWidget {
  const _AttendanceHero({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final percent = state.overallPercent;
    final colour = statusColour(percent);
    final attended = state.summaries.fold<int>(0, (s, x) => s + x.attended);
    final held = state.summaries.fold<int>(0, (s, x) => s + x.held);
    final canSkip = classesCanSkip(attended, held, SubjectsScreen.target);
    final needed = classesNeededForTarget(
      attended,
      held,
      SubjectsScreen.target,
    );

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'OVERALL ATTENDANCE',
              style: Theme.of(context).textTheme.labelSmall,
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  percent == null ? '—' : percent.toStringAsFixed(2),
                  style: TextStyle(
                    fontSize: 60,
                    fontWeight: FontWeight.w800,
                    // Tight tracking and tabular figures: the number shouldn't
                    // shuffle sideways as it changes.
                    letterSpacing: -3,
                    height: 1,
                    fontFeatures: const [FontFeature.tabularFigures()],
                    color: colour,
                  ),
                ),
                if (percent != null)
                  Padding(
                    padding: const EdgeInsets.only(left: 3),
                    child: Text(
                      '%',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: colour,
                      ),
                    ),
                  ),
                const Spacer(),
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(
                    '$attended / $held',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: (percent ?? 0) / 100,
                minHeight: 7,
                backgroundColor: Theme.of(context).dividerColor,
                valueColor: AlwaysStoppedAnimation(colour),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(
                  held == 0
                      ? Icons.info_outline
                      : (canSkip > 0
                            ? Icons.check_circle_outline
                            : Icons.priority_high),
                  size: 16,
                  color: held == 0
                      ? Theme.of(context).textTheme.bodySmall?.color
                      : colour,
                ),
                const SizedBox(width: 8),
                Expanded(
                  // The actionable translation of the number: what it lets you
                  // do, or what it will take to fix.
                  child: Text(
                    held == 0
                        ? 'No classes held yet'
                        : (canSkip > 0
                              ? 'You can miss $canSkip more and stay above ${SubjectsScreen.target.toInt()}%'
                              : 'Attend the next $needed to reach ${SubjectsScreen.target.toInt()}%'),
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: held == 0
                          ? Theme.of(context).textTheme.bodySmall?.color
                          : colour,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Next class with a live countdown — the one thing on this screen that
/// changes while you're looking at it.
class _NextClassCard extends StatelessWidget {
  const _NextClassCard({required this.block, this.subject});

  final ClassBlock block;
  final Subject? subject;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final start = _todayAt(block.startTime);
    final end = _todayAt(block.endTime);
    final running = now.isAfter(start) && now.isBefore(end);
    final minutes = start.difference(now).inMinutes;

    final label = running
        ? 'Now · ends ${_relative(end.difference(now))}'
        : 'Starts in ${_relative(start.difference(now))}';

    final place = [
      block.first.room,
      block.first.block,
    ].whereType<String>().where((p) => p.isNotEmpty).join(' · ');

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: running
              ? [HandyColors.orange, HandyColors.orangeDeep]
              : [
                  Theme.of(context).colorScheme.surface,
                  Theme.of(context).colorScheme.surface,
                ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: running || minutes <= 30
              ? HandyColors.orange
              : Theme.of(context).dividerColor,
          width: running || minutes <= 30 ? 1.6 : 1,
        ),
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                running ? Icons.play_circle_fill : Icons.schedule,
                size: 15,
                color: running ? Colors.white : HandyColors.orange,
              ),
              const SizedBox(width: 7),
              Text(
                label.toUpperCase(),
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                  color: running ? Colors.white : HandyColors.orange,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            subject?.name ?? 'Class',
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.3,
              color: running ? Colors.white : null,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(
                '${block.startTime} – ${block.endTime}',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: running
                      ? Colors.white70
                      : Theme.of(context).textTheme.bodySmall?.color,
                ),
              ),
              if (place.isNotEmpty) ...[
                const SizedBox(width: 10),
                Icon(
                  Icons.place_outlined,
                  size: 13,
                  color: running
                      ? Colors.white70
                      : Theme.of(context).textTheme.bodySmall?.color,
                ),
                const SizedBox(width: 3),
                Expanded(
                  child: Text(
                    place,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      color: running
                          ? Colors.white70
                          : Theme.of(context).textTheme.bodySmall?.color,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  static DateTime _todayAt(String hhmm) {
    final now = DateTime.now();
    final parts = hhmm.split(':');
    return DateTime(
      now.year,
      now.month,
      now.day,
      int.parse(parts[0]),
      int.parse(parts[1]),
    );
  }

  /// "45 min" / "1 h 20 min" — minutes matter up close, hours further out.
  static String _relative(Duration d) {
    final minutes = d.inMinutes;
    if (minutes < 1) return 'less than a minute';
    if (minutes < 60) return '$minutes min';
    final hours = minutes ~/ 60;
    final rest = minutes % 60;
    return rest == 0 ? '$hours h' : '$hours h $rest min';
  }
}

/// How far through the day you are — context the class list can't give at a glance.
class _DayProgress extends StatelessWidget {
  const _DayProgress({
    required this.done,
    required this.total,
    required this.free,
  });

  final int done;
  final int total;
  final int free;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: total == 0 ? 0 : done / total,
              minHeight: 5,
              backgroundColor: Theme.of(context).dividerColor,
              valueColor: const AlwaysStoppedAnimation(HandyColors.orange),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Text(
          done == total ? 'Day done' : '$done of $total done',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

/// The two or three subjects nearest the line, as a horizontal strip. Anything
/// comfortably above target isn't worth home-screen space.
class _AtRiskStrip extends StatelessWidget {
  const _AtRiskStrip({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final summaryBySubject = {for (final s in state.summaries) s.subjectId: s};

    final risky =
        state.subjects
            .map((subject) {
              final summary = summaryBySubject[subject.id];
              final percent = roundPercentage(
                calculateAttendance(summary?.attended ?? 0, summary?.held ?? 0),
              );
              return (subject: subject, summary: summary, percent: percent);
            })
            .where(
              (r) => r.percent != null && r.percent! < SubjectsScreen.target,
            )
            .toList()
          ..sort((a, b) => a.percent!.compareTo(b.percent!));

    if (risky.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Label('Needs attention · ${risky.length}'),
        const SizedBox(height: 8),
        SizedBox(
          // Sized to the tallest content this card can hold: a two-line
          // shortName plus the percentage plus the "need N more" line. 96 was
          // too tight and clipped by 17px on a real device.
          height: 122,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: risky.take(5).length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (context, i) {
              final row = risky[i];
              final colour = statusColour(row.percent);
              return GestureDetector(
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => SubjectDetailScreen(
                      subject: row.subject,
                      summary: row.summary,
                    ),
                  ),
                ),
                child: Container(
                  width: 148,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surface,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: colour.withValues(alpha: 0.45)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        row.subject.shortName.isEmpty
                            ? row.subject.name
                            : row.subject.shortName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        '${row.percent!.toStringAsFixed(1)}%',
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -1,
                          height: 1.1,
                          color: colour,
                        ),
                      ),
                      Text(
                        'need ${classesNeededForTarget(row.summary?.attended ?? 0, row.summary?.held ?? 0, SubjectsScreen.target)} more',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 20),
      ],
    );
  }
}

class _FreeTimeNote extends StatelessWidget {
  const _FreeTimeNote({required this.free});

  final List<FreePeriod> free;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Row(
        children: [
          Icon(
            Icons.free_breakfast_outlined,
            size: 16,
            color: Theme.of(context).textTheme.bodySmall?.color,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '${free.length} free period${free.length == 1 ? '' : 's'} today · '
              '${free.map((f) => f.startTime).join(', ')}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}

class _DueRow extends StatelessWidget {
  const _DueRow({required this.task, required this.state});

  final Task task;
  final AppState state;

  @override
  Widget build(BuildContext context) {
    final deadline = getDeadline(task.dueDate, DateTime.now(), done: task.done);
    final urgent =
        deadline.urgency == Urgency.overdue ||
        deadline.urgency == Urgency.today;
    final colour = urgent ? HandyColors.bad : HandyColors.warn;
    final subject = task.subjectId == null
        ? null
        : state.subjectsById[task.subjectId];

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(width: 3, height: 32, color: colour),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      task.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    Text(
                      [taskKindLabels[task.kind], subject?.shortName]
                          .whereType<String>()
                          .where((s) => s.isNotEmpty)
                          .join(' · '),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                deadline.label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: colour,
                ),
              ),
            ],
          ),
        ),
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

class _Quiet extends StatelessWidget {
  const _Quiet(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 10),
    child: Text(text, style: Theme.of(context).textTheme.bodySmall),
  );
}
