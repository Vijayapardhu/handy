import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../logic/timetable.dart';
import '../models/models.dart';
import '../widgets/class_sheet.dart';
import '../widgets/skeleton.dart';

/// Indexed 0..6 to match DateTime.weekday % 7, so a date maps straight to a
/// name with no lookup table of its own.
const _dayNames = [
  (short: 'Sun', long: 'Sunday'),
  (short: 'Mon', long: 'Monday'),
  (short: 'Tue', long: 'Tuesday'),
  (short: 'Wed', long: 'Wednesday'),
  (short: 'Thu', long: 'Thursday'),
  (short: 'Fri', long: 'Friday'),
  (short: 'Sat', long: 'Saturday'),
];

const _monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const _fullMonths = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

String _formatFullDate(DateTime date) =>
    '${date.day} ${_fullMonths[date.month - 1]} ${date.year}';

bool _isToday(DateTime date) {
  final now = DateTime.now();
  return date.year == now.year && date.month == now.month && date.day == now.day;
}

bool _sameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

/// The week, a day at a time.
///
/// The timetable itself repeats weekly, but a student thinks in dates — "what
/// have I got on Tuesday the 18th" — so the selection is a real date and the
/// weekday is derived from it. Free periods are shown in place, because a gap
/// is something to plan around rather than an absence of information.
class TimetableScreen extends StatefulWidget {
  const TimetableScreen({super.key});

  @override
  State<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends State<TimetableScreen> {
  late DateTime _selected = _initialDate();

  static DateTime _initialDate() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    // Sunday is not taught, so open on tomorrow rather than an empty day.
    return today.weekday == DateTime.sunday ? today.add(const Duration(days: 1)) : today;
  }

  int get _day => _selected.weekday % 7;

  /// Monday of the selected week — the strip always shows one whole week.
  DateTime get _weekStart => _selected.subtract(Duration(days: _selected.weekday - 1));

  /// Steps a day at a time, stepping over Sunday rather than landing on it.
  /// Crossing the edge of the week carries the strip along with it.
  void _step(int delta) {
    var next = _selected.add(Duration(days: delta));
    if (next.weekday == DateTime.sunday) next = next.add(Duration(days: delta));
    setState(() => _selected = next);
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _selected,
      firstDate: now.subtract(const Duration(days: 180)),
      lastDate: now.add(const Duration(days: 180)),
      helpText: 'Jump to a date',
      // Sundays are unselectable rather than selectable-and-empty.
      selectableDayPredicate: (date) => date.weekday != DateTime.sunday,
    );
    if (picked != null && mounted) setState(() => _selected = picked);
  }

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);

    if (state.loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Timetable')),
        body: const ListSkeleton(rows: 5, height: 104),
      );
    }

    final blocks = classBlocksForDay(state.entries, _day);
    final free = freePeriods(state.entries, _day);

    // Merged and time-ordered, so the day reads as a day.
    final items = <({String at, dynamic value})>[
      ...blocks.map((b) => (at: b.startTime, value: b)),
      ...free.map((f) => (at: f.startTime, value: f)),
    ]..sort((a, b) => a.at.compareTo(b.at));

    final periods = blocks.fold<int>(0, (sum, b) => sum + b.periods);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 12, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _isToday(_selected)
                              ? 'TODAY'
                              : (state.student?.section.isNotEmpty == true
                                  ? 'SECTION ${state.student!.section}'
                                  : 'TIMETABLE'),
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _dayNames[_day].long,
                          style: Theme.of(context).textTheme.headlineMedium,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '${_formatFullDate(_selected)} · '
                          '${blocks.isEmpty ? 'no classes' : '$periods period${periods == 1 ? '' : 's'}'}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: _pickDate,
                    icon: const Icon(Icons.calendar_month_outlined, size: 22),
                    tooltip: 'Jump to a date',
                  ),
                ],
              ),
            ),

            _DayStrip(
              weekStart: _weekStart,
              selected: _selected,
              entries: state.entries,
              onSelect: (date) => setState(() => _selected = date),
              onPrevious: () => _step(-1),
              onNext: () => _step(1),
            ),

            const SizedBox(height: 10),

            Expanded(
              child: items.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Text(
                          'Nothing scheduled on ${_dayNames[_day].long}.',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, i) {
                        final value = items[i].value;
                        if (value is FreePeriod) return _FreeRow(free: value);
                        return _ClassRow(
                          block: value as ClassBlock,
                          subject: state.subjectsById[value.first.subjectId],
                          date: _selected,
                          state: state,
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The selected week, Monday to Saturday, each chip carrying its real date.
///
/// Sunday is left out because the college does not teach on it — a seventh
/// chip could only ever say "nothing scheduled". A fixed row rather than a
/// scroller: six days always fit, and a list that *might* scroll makes people
/// wonder whether they are missing one.
class _DayStrip extends StatelessWidget {
  const _DayStrip({
    required this.weekStart,
    required this.selected,
    required this.entries,
    required this.onSelect,
    required this.onPrevious,
    required this.onNext,
  });

  final DateTime weekStart;
  final DateTime selected;
  final List<dynamic> entries;
  final ValueChanged<DateTime> onSelect;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final muted = Theme.of(context).textTheme.bodySmall?.color;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Row(
            children: [
              _Arrow(icon: Icons.chevron_left, onTap: onPrevious, tooltip: 'Previous day'),
              Expanded(
                child: Row(
                  children: List.generate(6, (i) {
                    final date = weekStart.add(Duration(days: i));
                    final dayIndex = date.weekday % 7;
                    final isSelected = _sameDay(date, selected);
                    final isToday = _isToday(date);
                    final count = classBlocksForDay(entries.cast(), dayIndex).length;

                    return Expanded(
                      child: GestureDetector(
                        onTap: () => onSelect(date),
                        behavior: HitTestBehavior.opaque,
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          curve: Curves.easeOutCubic,
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            color: isSelected ? scheme.primary : scheme.surface,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              // Today keeps a coloured outline even when it is
                              // not the selected day, so you never lose your
                              // place in the week.
                              color: isSelected
                                  ? scheme.primary
                                  : (isToday
                                      ? scheme.primary.withValues(alpha: 0.55)
                                      : Theme.of(context).dividerColor),
                              width: isToday && !isSelected ? 1.4 : 1,
                            ),
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                _dayNames[dayIndex].short,
                                style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w600,
                                  color: isSelected ? Colors.white70 : muted,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${date.day}',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.5,
                                  color: isSelected
                                      ? Colors.white
                                      : (isToday ? scheme.primary : null),
                                ),
                              ),
                              const SizedBox(height: 4),
                              SizedBox(
                                height: 4,
                                // Dots rather than a number: three dots reads
                                // as "busy" faster than the digit 3 does.
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: List.generate(
                                    count.clamp(0, 4),
                                    (_) => Container(
                                      width: 3.5,
                                      height: 3.5,
                                      margin: const EdgeInsets.symmetric(horizontal: 1),
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: isSelected ? Colors.white : muted,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                ),
              ),
              _Arrow(icon: Icons.chevron_right, onTap: onNext, tooltip: 'Next day'),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(_weekLabel(weekStart), style: Theme.of(context).textTheme.bodySmall),
        ),
      ],
    );
  }

  /// "11 – 16 Aug", or "30 Aug – 4 Sep" when the week straddles a month.
  static String _weekLabel(DateTime weekStart) {
    final end = weekStart.add(const Duration(days: 5));
    return weekStart.month == end.month
        ? '${weekStart.day} – ${end.day} ${_monthNames[end.month - 1]}'
        : '${weekStart.day} ${_monthNames[weekStart.month - 1]} – ${end.day} ${_monthNames[end.month - 1]}';
  }
}

class _Arrow extends StatelessWidget {
  const _Arrow({required this.icon, required this.onTap, required this.tooltip});

  final IconData icon;
  final VoidCallback onTap;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      icon: Icon(icon, size: 22),
      tooltip: tooltip,
      visualDensity: VisualDensity.compact,
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
      color: Theme.of(context).textTheme.bodySmall?.color,
    );
  }
}

/// "3", "1–3", or a plain count when the portal's period numbers were not
/// captured — older syncs predate that field.
String _periodLabel(ClassBlock block) {
  final first = block.first.periodNo;
  final last = block.entries.last.periodNo;
  if (first == null) return '${block.periods}';
  if (block.isMerged && last != null && last != first) return '$first–$last';
  return '$first';
}

/// A class in the day list. Tapping opens everything the portal told us about
/// it, plus this student's own notes.
class _ClassRow extends StatelessWidget {
  const _ClassRow({
    required this.block,
    required this.subject,
    required this.date,
    required this.state,
  });

  final ClassBlock block;
  final Subject? subject;
  final DateTime date;
  final AppState state;

  @override
  Widget build(BuildContext context) {
    final entry = block.first;
    final scheme = Theme.of(context).colorScheme;
    final muted = Theme.of(context).textTheme.bodySmall?.color;
    final place =
        [entry.room, entry.block].whereType<String>().where((p) => p.isNotEmpty).join(' · ');

    // Notes the student attached to this subject, surfaced on the class itself.
    final notes = state.tasks.where((t) => !t.done && t.subjectId == entry.subjectId).toList();
    final label = _periodLabel(block);

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => showClassSheet(
          context,
          block: block,
          subject: subject,
          state: state,
          date: date,
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Period badge — the portal numbers its slots and students
                  // refer to them that way ("third period").
                  Container(
                    width: 44,
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    decoration: BoxDecoration(
                      color: scheme.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        Text(
                          label,
                          style: TextStyle(
                            fontSize: label.length > 2 ? 12 : 15,
                            fontWeight: FontWeight.w800,
                            color: scheme.primary,
                          ),
                        ),
                        Text(
                          block.periods > 1 ? 'periods' : 'period',
                          style: TextStyle(fontSize: 8, color: scheme.primary),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(subject?.name ?? 'Class',
                            style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 2),
                        Text(
                          '${block.startTime} – ${block.endTime}',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _TypePill(type: entry.type),
                ],
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 14,
                runSpacing: 6,
                children: [
                  if (subject?.code.isNotEmpty == true) _Fact(icon: Icons.tag, text: subject!.code),
                  if (place.isNotEmpty) _Fact(icon: Icons.place_outlined, text: place),
                  if (entry.facultyName.isNotEmpty)
                    _Fact(icon: Icons.person_outline, text: entry.facultyName),
                  if (entry.opted != null && entry.strength != null)
                    _Fact(icon: Icons.groups_outlined, text: '${entry.opted} of ${entry.strength}'),
                ],
              ),
              if (notes.isNotEmpty) ...[
                const SizedBox(height: 10),
                ...notes.take(2).map(
                      (n) => Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(
                          children: [
                            Icon(Icons.sticky_note_2_outlined, size: 13, color: scheme.primary),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                n.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: scheme.primary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).textTheme.bodySmall?.color;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: muted),
        const SizedBox(width: 4),
        Text(text, style: TextStyle(fontSize: 12, color: muted)),
      ],
    );
  }
}

class _TypePill extends StatelessWidget {
  const _TypePill({required this.type});
  final String type;

  @override
  Widget build(BuildContext context) {
    final label = switch (type) {
      'lab' => 'Lab',
      'technical' => 'Technical',
      'activity' => 'Activity',
      _ => 'Lecture',
    };
    final scheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: scheme.primary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: scheme.primary),
      ),
    );
  }
}

class _FreeRow extends StatelessWidget {
  const _FreeRow({required this.free});
  final FreePeriod free;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).textTheme.bodySmall?.color;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).dividerColor),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 44,
            child: Text(
              '${free.periodNo}',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: muted),
            ),
          ),
          const SizedBox(width: 14),
          Icon(Icons.free_breakfast_outlined, size: 15, color: muted),
          const SizedBox(width: 8),
          Text('Free period',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: muted)),
          const Spacer(),
          Text('${free.startTime} – ${free.endTime}',
              style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}
