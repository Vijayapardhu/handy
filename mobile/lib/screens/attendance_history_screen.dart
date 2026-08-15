import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../logic/attendance.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/app_icon.dart';

/// Every class the student has marked, as a month and as a list.
///
/// The college publishes running totals and nothing else — there is no
/// per-day record to import, which is why Handy could never show a history.
/// These are the student's own marks, so this screen is the only place in the
/// app where attendance has a shape rather than a single number.
///
/// Scoped to one subject when opened from a subject, or to everything when
/// opened from the profile.
class AttendanceHistoryScreen extends StatefulWidget {
  const AttendanceHistoryScreen({super.key, this.subjectId});

  /// Null shows every subject.
  final String? subjectId;

  @override
  State<AttendanceHistoryScreen> createState() => _AttendanceHistoryScreenState();
}

class _AttendanceHistoryScreenState extends State<AttendanceHistoryScreen> {
  late DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);

  static const _monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final subject = widget.subjectId == null ? null : state.subjectsById[widget.subjectId];

    final marks = state.marks
        .where((m) => widget.subjectId == null || m.subjectId == widget.subjectId)
        .toList()
      ..sort((a, b) => b.date.compareTo(a.date));

    final present = marks.where((m) => m.status == MarkStatus.present).length;
    final absent = marks.where((m) => m.status == MarkStatus.absent).length;
    final cancelled = marks.where((m) => m.status == MarkStatus.cancelled).length;

    return Scaffold(
      appBar: AppBar(title: Text(subject?.shortName ?? 'Attendance history')),
      body: marks.isEmpty
          ? _Empty(scoped: subject != null)
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 36),
              children: [
                _Totals(present: present, absent: absent, cancelled: cancelled),
                const SizedBox(height: 18),

                _MonthGrid(
                  month: _month,
                  marks: marks,
                  onStep: (delta) => setState(
                    () => _month = DateTime(_month.year, _month.month + delta),
                  ),
                ),

                const SizedBox(height: 22),
                Text('EVERY MARK', style: Theme.of(context).textTheme.labelSmall),
                const SizedBox(height: 8),
                ...marks.map((mark) => _MarkRow(
                      mark: mark,
                      subject: state.subjectsById[mark.subjectId],
                      showSubject: widget.subjectId == null,
                    )),

                const SizedBox(height: 16),
                Text(
                  'These are your own marks, not the college record. The portal '
                  'publishes totals only — it has no per-day data to show.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.scoped});
  final bool scoped;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(36),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AppIcon(
              HugeIcons.strokeRoundedCalendar03,
              size: 40,
              color: Theme.of(context).textTheme.bodySmall?.color,
            ),
            const SizedBox(height: 14),
            Text('Nothing marked yet', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(
              scoped
                  ? 'Mark this subject present or missed on Today and it will '
                      'build up here.'
                  : 'Mark your classes present or missed on Today. The college '
                      'only publishes totals, so this is the one place your '
                      'attendance has a history.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _Totals extends StatelessWidget {
  const _Totals({required this.present, required this.absent, required this.cancelled});

  final int present;
  final int absent;
  final int cancelled;

  @override
  Widget build(BuildContext context) {
    // Cancelled sits apart from the ratio deliberately: it was never held, so
    // folding it into either side would misstate the rate.
    final counted = present + absent;
    final rate = roundPercentage(calculateAttendance(present, counted));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  rate == null ? '—' : '${rate.toStringAsFixed(2)}%',
                  style: TextStyle(
                    fontSize: 30,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -1.2,
                    height: 1,
                    color: statusColour(rate),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'of what you have marked',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                _Count(label: 'Present', value: present, colour: HandyColors.good),
                _Count(label: 'Missed', value: absent, colour: HandyColors.bad),
                _Count(
                  label: 'Cancelled',
                  value: cancelled,
                  colour: Theme.of(context).textTheme.bodySmall?.color ?? Colors.grey,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Count extends StatelessWidget {
  const _Count({required this.label, required this.value, required this.colour});

  final String label;
  final int value;
  final Color colour;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$value',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
              color: colour,
            ),
          ),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

/// A month with a dot on every marked day, coloured by what happened.
class _MonthGrid extends StatelessWidget {
  const _MonthGrid({required this.month, required this.marks, required this.onStep});

  final DateTime month;
  final List<AttendanceMark> marks;
  final ValueChanged<int> onStep;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).textTheme.bodySmall?.color;
    final first = DateTime(month.year, month.month);
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final leading = (first.weekday - 1) % 7;

    final byDay = <int, List<AttendanceMark>>{};
    for (final mark in marks) {
      final parts = mark.date.split('-');
      if (parts.length != 3) continue;
      if (int.tryParse(parts[0]) != month.year) continue;
      if (int.tryParse(parts[1]) != month.month) continue;
      final day = int.tryParse(parts[2]);
      if (day != null) byDay.putIfAbsent(day, () => []).add(mark);
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(10, 12, 10, 14),
        child: Column(
          children: [
            Row(
              children: [
                IconButton(
                  onPressed: () => onStep(-1),
                  icon: AppIcon(HugeIcons.strokeRoundedArrowLeft01, size: 20),
                  visualDensity: VisualDensity.compact,
                ),
                Expanded(
                  child: Text(
                    '${_AttendanceHistoryScreenState._monthNames[month.month - 1]} ${month.year}',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                IconButton(
                  onPressed: () => onStep(1),
                  icon: AppIcon(HugeIcons.strokeRoundedArrowRight01, size: 20),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
            Row(
              children: ['M', 'T', 'W', 'T', 'F', 'S', 'S']
                  .map((d) => Expanded(
                        child: Text(
                          d,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: muted,
                          ),
                        ),
                      ))
                  .toList(),
            ),
            const SizedBox(height: 6),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 7,
                childAspectRatio: 1,
              ),
              itemCount: leading + daysInMonth,
              itemBuilder: (context, i) {
                if (i < leading) return const SizedBox.shrink();
                final day = i - leading + 1;
                final onDay = byDay[day] ?? const <AttendanceMark>[];

                // A day with any absence is drawn as an absence. It is the
                // fact worth seeing from across the month.
                final colour = onDay.isEmpty
                    ? Colors.transparent
                    : onDay.any((m) => m.status == MarkStatus.absent)
                        ? HandyColors.bad
                        : onDay.every((m) => m.status == MarkStatus.cancelled)
                            ? (muted ?? Colors.grey)
                            : HandyColors.good;

                return Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('$day', style: const TextStyle(fontSize: 13)),
                    const SizedBox(height: 3),
                    Container(
                      width: onDay.length > 1 ? 12 : 5,
                      height: 4,
                      decoration: BoxDecoration(
                        color: colour,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _MarkRow extends StatelessWidget {
  const _MarkRow({required this.mark, required this.subject, required this.showSubject});

  final AttendanceMark mark;
  final Subject? subject;
  final bool showSubject;

  @override
  Widget build(BuildContext context) {
    final (colour, icon) = switch (mark.status) {
      MarkStatus.present => (HandyColors.good, HugeIcons.strokeRoundedTick02),
      MarkStatus.absent => (HandyColors.bad, HugeIcons.strokeRoundedCancel01),
      MarkStatus.cancelled => (
          Theme.of(context).textTheme.bodySmall?.color ?? Colors.grey,
          HugeIcons.strokeRoundedMinusSign,
        ),
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              AppIcon(icon, size: 16, color: colour),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      showSubject ? (subject?.name ?? 'Class') : mark.status.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    Text(
                      [
                        mark.date,
                        mark.startTime,
                        if (mark.periods > 1) '${mark.periods} periods',
                        if (showSubject) mark.status.label,
                      ].join(' · '),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
