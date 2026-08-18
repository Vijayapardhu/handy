import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../logic/attendance.dart';
import '../logic/planning.dart';
import '../models/models.dart';
import '../models/timetable_entry.dart';
import '../theme.dart';
import '../widgets/app_icon.dart';

/// "What would it take?" — the arithmetic behind the percentage, in three
/// answers rather than one.
///
/// A port of the web's AttendancePlannerPage. The subject screens already say
/// what a single subject needs; this is the whole semester at once, and the
/// three tabs are three genuinely different questions a student asks at
/// different points in a term:
///
///   Reach   — I am behind. How many in a row fixes it?
///   Regular — If I just turn up from now on, where do I end up?
///   Goals   — Which subjects am I actually safe in?
///
/// Nothing here is written anywhere. A projection is not a record, and a
/// planner that quietly marked attendance would be lying about the past to
/// help with the future.
class AttendancePlannerScreen extends StatefulWidget {
  const AttendancePlannerScreen({super.key, this.subject});

  /// Opened from a subject, this narrows to that one — the same thing
  /// `/subjects/:id/planner` does on the web. Null plans the whole semester.
  final Subject? subject;

  @override
  State<AttendancePlannerScreen> createState() => _AttendancePlannerScreenState();
}

enum _Tab { reach, regular, goals }

class _AttendancePlannerScreenState extends State<AttendancePlannerScreen> {
  _Tab _tab = _Tab.reach;

  /// Classes a week the student reckons they will make, per subject. Five is
  /// the web's default and roughly a daily subject.
  int _perWeek = 5;

  /// How far ahead "if I attend regularly" looks. Four weeks is far enough to
  /// move a percentage and near enough to still be this term's problem.
  static const _weeks = 4;

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final target = state.target;

    final rows = [
      for (final subject in state.subjects)
        if (widget.subject == null || subject.id == widget.subject!.id)
          _Row(subject: subject, state: state),
    ]..sort((a, b) => (a.percent ?? 200).compareTo(b.percent ?? 200));

    final onTrack = rows.where((r) => r.onTrack).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Planner'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(52),
          child: _Tabs(
            tab: _tab,
            target: target,
            onSelect: (t) => setState(() => _tab = t),
          ),
        ),
      ),
      body: rows.isEmpty
          ? const _Empty()
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              children: [
                _Summary(state: state, target: target),
                const SizedBox(height: 16),
                ...switch (_tab) {
                  _Tab.reach => _reach(rows),
                  _Tab.regular => _regular(rows),
                  _Tab.goals => _goals(rows),
                },
                const SizedBox(height: 20),
                _Footer(onTrack: onTrack, total: rows.length),
              ],
            ),
    );
  }

  // — To reach the target —

  List<Widget> _reach(List<_Row> rows) => [
        const _Hint('Attend this many classes in a row, missing none, to get back above target.'),
        const SizedBox(height: 10),
        for (final row in rows) ...[
          _SubjectRow(
            row: row,
            trailing: switch (row) {
              _ when row.onTrack => _Reached(percent: row.percent),
              _ when row.needed < 0 => const _Flat(
                  'Not reachable this term',
                  colour: HandyColors.bad,
                ),
              _ => _Need(classes: row.needed, by: row.reachedOn),
            },
          ),
          const SizedBox(height: 8),
        ],
      ];

  // — If I attend regularly —

  List<Widget> _regular(List<_Row> rows) {
    final future = _perWeek * _weeks;
    return [
      Card(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Classes a week, per subject',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                  Text(
                    '$_perWeek',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                ],
              ),
              Slider(
                value: _perWeek.toDouble(),
                min: 0,
                max: 10,
                divisions: 10,
                label: '$_perWeek',
                onChanged: (v) => setState(() => _perWeek = v.round()),
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 10),
      _Hint(
        'Where each subject lands after $_weeks weeks at that rate. '
        'A projection only — it never changes your record.',
      ),
      const SizedBox(height: 10),
      for (final row in rows) ...[
        _SubjectRow(
          row: row,
          trailing: _Projection(
            from: row.percent,
            to: roundPercentage(projectedAfter(row.attended, row.held, future)),
          ),
        ),
        const SizedBox(height: 8),
      ],
    ];
  }

  // — Subject goals —

  List<Widget> _goals(List<_Row> rows) => [
        const _Hint(
          "Each subject's goal is your college's minimum, unless that subject has been given one of its own.",
        ),
        const SizedBox(height: 10),
        for (final row in rows) ...[
          _GoalCard(row: row),
          const SizedBox(height: 8),
        ],
      ];
}

/// One subject with every figure the three tabs need, worked out once.
class _Row {
  _Row({required this.subject, required AppState state})
      : target = state.targetFor(subject),
        attended = state.projectedFor(subject.id).attended,
        held = state.projectedFor(subject.id).held,
        percent = state.projectedFor(subject.id).percent,
        entries = state.entries;

  final Subject subject;

  /// The whole timetable, so a row can date its own advice.
  final List<TimetableEntry> entries;
  final double target;
  final int attended;
  final int held;
  final double? percent;

  bool get onTrack => percent != null && percent! >= target;

  /// Classes needed in a row to reach the target; negative when the target
  /// cannot be reached at all this term.
  int get needed => classesNeededForTarget(attended, held, target);

  /// How many more can be missed while staying at or above the goal.
  int get canSkip => classesCanSkip(attended, held, target);

  /// When attending every one of [needed] would get there, off this subject's
  /// own place in the timetable. Null when the timetable cannot say.
  DateTime? get reachedOn => needed <= 0
      ? null
      : daysToAttend(
          classes: needed,
          entries: entries,
          from: DateTime.now(),
          subjectId: subject.id,
        )?.on;

  String get name => subject.name.isEmpty ? subject.shortName : subject.name;
}

class _Tabs extends StatelessWidget {
  const _Tabs({required this.tab, required this.target, required this.onSelect});

  final _Tab tab;
  final double target;
  final ValueChanged<_Tab> onSelect;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _TabChip(
              label: 'To reach ${target.toInt()}%',
              icon: HugeIcons.strokeRoundedTarget02,
              selected: tab == _Tab.reach,
              onTap: () => onSelect(_Tab.reach),
            ),
            const SizedBox(width: 8),
            _TabChip(
              label: 'If I attend regularly',
              icon: HugeIcons.strokeRoundedChartUp,
              selected: tab == _Tab.regular,
              onTap: () => onSelect(_Tab.regular),
            ),
            const SizedBox(width: 8),
            _TabChip(
              label: 'Subject goals',
              icon: HugeIcons.strokeRoundedFlag02,
              selected: tab == _Tab.goals,
              onTap: () => onSelect(_Tab.goals),
            ),
          ],
        ),
      ),
    );
  }
}

class _TabChip extends StatelessWidget {
  const _TabChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final AppIconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: selected ? scheme.primary : scheme.surface,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          child: Row(
            children: [
              AppIcon(icon, size: 14, color: selected ? scheme.onPrimary : scheme.onSurfaceVariant),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: selected ? scheme.onPrimary : scheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Target and where the student stands against it, above every tab.
class _Summary extends StatelessWidget {
  const _Summary({required this.state, required this.target});

  final AppState state;
  final double target;

  @override
  Widget build(BuildContext context) {
    final overall = state.overallProjected.percent;
    final short = overall != null && overall < target;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _Caption('Your target'),
                  const SizedBox(height: 4),
                  Text(
                    '${target.toInt()}%',
                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, height: 1.1),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Required by your college',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            Container(width: 1, height: 54, color: Theme.of(context).dividerColor),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(left: 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _Caption('Overall'),
                    const SizedBox(height: 4),
                    Text(
                      overall == null ? '—' : '${overall.toStringAsFixed(2)}%',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        height: 1.1,
                        color: statusColour(overall),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      short ? 'Below target' : 'On track',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: short ? HandyColors.bad : null,
                            fontWeight: short ? FontWeight.w700 : null,
                          ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A subject, its bar, and whatever the current tab has to say about it.
class _SubjectRow extends StatelessWidget {
  const _SubjectRow({required this.row, required this.trailing});

  final _Row row;
  final Widget trailing;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    row.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, height: 1.25),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${row.attended} / ${row.held} attended',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 8),
                  _Bar(percent: row.percent),
                ],
              ),
            ),
            const SizedBox(width: 14),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 108),
              child: trailing,
            ),
          ],
        ),
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({required this.percent});
  final double? percent;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: LinearProgressIndicator(
        value: (percent ?? 0) / 100,
        minHeight: 6,
        backgroundColor: Theme.of(context).dividerColor,
        valueColor: AlwaysStoppedAnimation(statusColour(percent)),
      ),
    );
  }
}

class _Need extends StatelessWidget {
  const _Need({required this.classes, required this.by});

  final int classes;

  /// When the last of them falls, off the timetable — null when it cannot be
  /// worked out, in which case the count stands on its own.
  final DateTime? by;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        const _Caption('Need'),
        Text(
          '$classes',
          style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, height: 1.1),
        ),
        Text(
          // A count of classes is not a plan until it has a date on it.
          by == null ? 'in a row' : 'by ${shortWhen(by!)}',
          textAlign: TextAlign.right,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _Reached extends StatelessWidget {
  const _Reached({required this.percent});
  final double? percent;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        AppIcon(HugeIcons.strokeRoundedCheckmarkCircle02, size: 18, color: HandyColors.good),
        const SizedBox(height: 4),
        const Text(
          'On target',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: HandyColors.good),
        ),
        if (percent != null)
          Text(
            '${percent!.toStringAsFixed(1)}%',
            style: Theme.of(context).textTheme.bodySmall,
          ),
      ],
    );
  }
}

class _Projection extends StatelessWidget {
  const _Projection({required this.from, required this.to});

  final double? from;
  final double? to;

  @override
  Widget build(BuildContext context) {
    // Direction matters more than the arithmetic: a student wants to know
    // whether turning up gets them anywhere, not two decimal places.
    final up = from != null && to != null && to! > from!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        const _Caption('In 4 weeks'),
        Text(
          to == null ? '—' : '${to!.toStringAsFixed(1)}%',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            height: 1.15,
            color: statusColour(to),
          ),
        ),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppIcon(
              up ? HugeIcons.strokeRoundedChartUp : HugeIcons.strokeRoundedChartDown,
              size: 12,
              color: Theme.of(context).textTheme.bodySmall?.color,
            ),
            const SizedBox(width: 4),
            Text(
              from == null ? '—' : 'from ${from!.toStringAsFixed(1)}%',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ],
    );
  }
}

/// One subject's goal, with the single sentence that follows from it.
class _GoalCard extends StatelessWidget {
  const _GoalCard({required this.row});
  final _Row row;

  @override
  Widget build(BuildContext context) {
    final (icon, note, colour) = _note();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        row.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700, height: 1.25),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Goal ${row.target.toInt()}% · now '
                        '${row.percent == null ? '—' : '${row.percent!.toStringAsFixed(2)}%'}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                AppIcon(
                  HugeIcons.strokeRoundedFlag02,
                  size: 18,
                  color: row.onTrack ? HandyColors.good : HandyColors.bad,
                ),
              ],
            ),
            const SizedBox(height: 12),
            _Bar(percent: row.percent),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppIcon(icon, size: 14, color: colour),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(note, style: Theme.of(context).textTheme.bodyMedium),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  (AppIconData, String, Color) _note() {
    if (row.held == 0) {
      return (
        HugeIcons.strokeRoundedInformationCircle,
        'No classes held yet, so there is nothing to plan against.',
        HandyColors.lightMuted,
      );
    }
    if (row.onTrack) {
      return row.canSkip > 0
          ? (
              HugeIcons.strokeRoundedShield01,
              'You can miss ${row.canSkip} more class${row.canSkip == 1 ? '' : 'es'} '
                  'and stay at or above your goal.',
              HandyColors.good,
            )
          : (
              HugeIcons.strokeRoundedShield01,
              'Right on your goal — missing the next one drops you below it.',
              HandyColors.warn,
            );
    }
    if (row.needed < 0) {
      return (
        HugeIcons.strokeRoundedChartDown,
        'Not reachable this term. Worth asking your department about condonation.',
        HandyColors.bad,
      );
    }
    return (
      HugeIcons.strokeRoundedChartDown,
      'Attend the next ${row.needed} in a row to reach your goal.',
      HandyColors.bad,
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({required this.onTrack, required this.total});

  final int onTrack;
  final int total;

  @override
  Widget build(BuildContext context) {
    final all = onTrack == total;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Column(
        children: [
          Text(
            all ? "You're on the right track" : 'Stay consistent',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            '$onTrack of $total subject${total == 1 ? '' : 's'} on track',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _Hint extends StatelessWidget {
  const _Hint(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppIcon(
          HugeIcons.strokeRoundedInformationCircle,
          size: 13,
          color: Theme.of(context).textTheme.bodySmall?.color,
        ),
        const SizedBox(width: 7),
        Expanded(child: Text(text, style: Theme.of(context).textTheme.bodySmall)),
      ],
    );
  }
}

class _Flat extends StatelessWidget {
  const _Flat(this.text, {required this.colour});
  final String text;
  final Color colour;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      textAlign: TextAlign.right,
      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: colour),
    );
  }
}

class _Caption extends StatelessWidget {
  const _Caption(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.6,
        color: Theme.of(context).textTheme.bodySmall?.color,
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Text(
          'No subjects to plan yet — they appear once your college publishes them.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ),
    );
  }
}
