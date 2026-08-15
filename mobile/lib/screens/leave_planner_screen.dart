import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../logic/planning.dart';
import '../theme.dart';
import '../widgets/app_icon.dart';
import 'subjects_screen.dart';

/// "Can I afford to miss Thursday?"
///
/// The question every student actually asks before taking a day off, and the
/// one the portal cannot answer: it reports where you stand, not what a
/// decision would cost. Handy holds both halves — the timetable says which
/// classes fall in the range, the summaries say what each subject can bear —
/// so it can answer before the day rather than after it.
///
/// Nothing here is recorded. Planning to miss a day is not the same as missing
/// it, and a planner that quietly marked you absent would be lying about the
/// past to help with the future.
class LeavePlannerScreen extends StatefulWidget {
  const LeavePlannerScreen({super.key});

  @override
  State<LeavePlannerScreen> createState() => _LeavePlannerScreenState();
}

class _LeavePlannerScreenState extends State<LeavePlannerScreen> {
  late DateTime _from = _tomorrow();
  late DateTime _to = _tomorrow();

  static DateTime _tomorrow() {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day).add(const Duration(days: 1));
  }

  static const _months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  String _label(DateTime d) => '${d.day} ${_months[d.month - 1]}';

  int get _days => _to.difference(_from).inDays + 1;

  Future<void> _pickRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: now.add(const Duration(days: 180)),
      initialDateRange: DateTimeRange(start: _from, end: _to),
      helpText: 'Days you would miss',
    );
    if (picked != null) {
      setState(() {
        _from = picked.start;
        _to = picked.end;
      });
    }
  }

  void _setDays(int days) {
    setState(() {
      _from = _tomorrow();
      _to = _from.add(Duration(days: days - 1));
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final costs = leaveCost(
      entries: state.entries,
      subjects: state.subjects,
      summaries: state.summaries,
      from: _from,
      to: _to,
    );

    final periods = costs.fold<int>(0, (sum, c) => sum + c.periods);
    final falling = costs.where((c) => c.dropsBelow(SubjectsScreen.target)).toList();
    final overall = overallLeaveCost(summaries: state.summaries, costs: costs);

    return Scaffold(
      appBar: AppBar(title: const Text('Leave planner')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 36),
        children: [
          Text(
            'Pick the days you would miss. Handy works out what each subject '
            'would drop to — before you decide, not after.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 18),

          Card(
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: _pickRange,
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Row(
                  children: [
                    AppIcon(
                      HugeIcons.strokeRoundedCalendar02,
                      size: 20,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _days == 1
                                ? _label(_from)
                                : '${_label(_from)} – ${_label(_to)}',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          Text(
                            '$_days day${_days == 1 ? '' : 's'}',
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

          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            children: [1, 2, 3, 5]
                .map((d) => ChoiceChip(
                      label: Text(d == 1 ? 'Tomorrow' : '$d days'),
                      selected: _days == d && _from == _tomorrow(),
                      onSelected: (_) => _setDays(d),
                    ))
                .toList(),
          ),

          const SizedBox(height: 24),

          if (costs.isEmpty)
            Text(
              state.entries.isEmpty
                  ? 'Handy needs your timetable before it can price a day off.'
                  : 'Nothing is scheduled in those days — they cost you nothing.',
              style: Theme.of(context).textTheme.bodySmall,
            )
          else ...[
            // The verdict before the table. A student wants to know whether
            // the answer is yes or no, and only then why.
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                color: (falling.isEmpty ? HandyColors.good : HandyColors.bad)
                    .withValues(alpha: 0.10),
                border: Border.all(
                  color: (falling.isEmpty ? HandyColors.good : HandyColors.bad)
                      .withValues(alpha: 0.5),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AppIcon(
                    falling.isEmpty
                        ? HugeIcons.strokeRoundedCheckmarkCircle01
                        : HugeIcons.strokeRoundedAlert02,
                    size: 20,
                    color: falling.isEmpty ? HandyColors.good : HandyColors.bad,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          falling.isEmpty
                              ? 'You can afford it'
                              : '${falling.length} subject${falling.length == 1 ? '' : 's'} '
                                  'would fall below ${SubjectsScreen.target.toInt()}%',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '$periods period${periods == 1 ? '' : 's'} missed across '
                          '${costs.length} subject${costs.length == 1 ? '' : 's'}.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 22),
            Text('YOUR OVERALL', style: Theme.of(context).textTheme.labelSmall),
            const SizedBox(height: 10),
            _OverallCard(overall: overall),

            const SizedBox(height: 22),
            Text('SUBJECT BY SUBJECT', style: Theme.of(context).textTheme.labelSmall),
            const SizedBox(height: 10),
            ...costs.map((cost) => _CostRow(cost: cost)),

            const SizedBox(height: 18),
            Text(
              'Planning is not recording. Nothing here changes your attendance '
              '— mark the classes on Today if you do end up missing them.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}

/// The one number a student quotes, before and after.
///
/// Shown above the per-subject table because it is the question asked first —
/// leaving it to be worked out by adding up nine rows is leaving it unanswered.
class _OverallCard extends StatelessWidget {
  const _OverallCard({required this.overall});

  final OverallLeaveCost overall;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).textTheme.bodySmall?.color;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('NOW', style: Theme.of(context).textTheme.labelSmall),
                    Text(
                      overall.before == null
                          ? '—'
                          : '${overall.before!.toStringAsFixed(2)}%',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.8,
                        color: muted,
                      ),
                    ),
                  ],
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  child: AppIcon(
                    HugeIcons.strokeRoundedArrowRight01,
                    size: 20,
                    color: muted,
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('AFTER', style: Theme.of(context).textTheme.labelSmall),
                    Text(
                      overall.after == null
                          ? '—'
                          : '${overall.after!.toStringAsFixed(2)}%',
                      style: TextStyle(
                        fontSize: 30,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -1.2,
                        color: statusColour(overall.after),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              '${overall.attended} of ${overall.heldBefore} → '
              '${overall.attended} of ${overall.heldAfter}',
              style: Theme.of(context).textTheme.bodySmall,
            ),

            const SizedBox(height: 14),
            Divider(height: 1, color: Theme.of(context).dividerColor),
            const SizedBox(height: 14),

            // The number that turns a cost into a decision.
            Row(
              children: [
                AppIcon(
                  overall.recovery == 0
                      ? HugeIcons.strokeRoundedCheckmarkCircle01
                      : HugeIcons.strokeRoundedChartUp,
                  size: 17,
                  color: overall.recovery == 0 ? HandyColors.good : HandyColors.warn,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    overall.recovery == 0
                        ? 'Still above ${SubjectsScreen.target.toInt()}% — nothing to make up.'
                        : 'Then attend ${overall.recovery} in a row to get back to '
                            '${SubjectsScreen.target.toInt()}%.',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: overall.recovery == 0 ? HandyColors.good : HandyColors.warn,
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

class _CostRow extends StatelessWidget {
  const _CostRow({required this.cost});

  final LeaveCost cost;

  @override
  Widget build(BuildContext context) {
    final drops = cost.dropsBelow(SubjectsScreen.target);
    final colour = statusColour(cost.after);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      cost.subject.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${cost.periods} period${cost.periods == 1 ? '' : 's'} missed'
                      '${drops ? ' · drops below target' : ''}',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: drops ? FontWeight.w700 : FontWeight.w500,
                        color: drops
                            ? HandyColors.bad
                            : Theme.of(context).textTheme.bodySmall?.color,
                      ),
                    ),
                    // What it would take to undo, per subject. The overall
                    // figure says whether the day is affordable; this says
                    // which subject you would be paying it back in.
                    if (cost.recovery > 0) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Then ${cost.recovery} in a row to reach '
                        '${SubjectsScreen.target.toInt()}%',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: HandyColors.warn,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 12),
              // Both sides, because the drop is the point — a single figure
              // would leave the reader working out the difference.
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    cost.before == null ? '—' : '${cost.before!.toStringAsFixed(2)}%',
                    style: TextStyle(
                      fontSize: 12,
                      decoration: TextDecoration.lineThrough,
                      color: Theme.of(context).textTheme.bodySmall?.color,
                    ),
                  ),
                  Text(
                    cost.after == null ? '—' : '${cost.after!.toStringAsFixed(2)}%',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                      color: colour,
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
