import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../logic/timetable.dart';
import '../widgets/class_tile.dart';

const _dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/// The week, one day at a time — with free periods shown in place rather than
/// skipped, because a gap is information a student plans around.
class TimetableScreen extends StatefulWidget {
  const TimetableScreen({super.key});

  @override
  State<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends State<TimetableScreen> {
  int _day = DateTime.now().weekday % 7;

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final blocks = classBlocksForDay(state.entries, _day);
    final free = freePeriods(state.entries, _day);

    // Merged and time-ordered so the day reads as a day.
    final items = <({String at, dynamic value})>[
      ...blocks.map((b) => (at: b.startTime, value: b)),
      ...free.map((f) => (at: f.startTime, value: f)),
    ]..sort((a, b) => a.at.compareTo(b.at));

    return Scaffold(
      appBar: AppBar(title: const Text('Timetable')),
      body: Column(
        children: [
          SizedBox(
            height: 46,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: 7,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final selected = i == _day;
                return ChoiceChip(
                  label: Text(_dayNames[i]),
                  selected: selected,
                  onSelected: (_) => setState(() => _day = i),
                );
              },
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: items.isEmpty
                ? Center(
                    child: Text('Nothing scheduled on ${_dayNames[_day]}.',
                        style: Theme.of(context).textTheme.bodySmall),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final value = items[i].value;
                      if (value is FreePeriod) return _FreeRow(free: value);
                      return ClassTile(
                        block: value,
                        subject: state.subjectsById[value.first.subjectId],
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _FreeRow extends StatelessWidget {
  const _FreeRow({required this.free});
  final FreePeriod free;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).dividerColor, style: BorderStyle.solid),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.free_breakfast_outlined, size: 15),
          const SizedBox(width: 8),
          const Text('Free period', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          const Spacer(),
          Text('${free.startTime} – ${free.endTime}',
              style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}
