import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../logic/attendance.dart';
import '../logic/deadlines.dart';
import '../logic/timetable.dart';
import '../main.dart';
import '../models/models.dart';
import '../theme.dart';
import 'detail_row.dart';
import 'form_sheet.dart';

/// Everything the portal told us about one class, plus the student's own notes.
///
/// This is where the fields that don't fit on a list row live — class strength,
/// subject code, faculty, building, period range — so the row can stay
/// scannable without the data being thrown away.
Future<void> showClassSheet(
  BuildContext context, {
  required ClassBlock block,
  required Subject? subject,
  required AppState state,
  required DateTime date,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _ClassSheet(block: block, subject: subject, state: state, date: date),
  );
}

class _ClassSheet extends StatelessWidget {
  const _ClassSheet({
    required this.block,
    required this.subject,
    required this.state,
    required this.date,
  });

  final ClassBlock block;
  final Subject? subject;
  final AppState state;

  /// The day being viewed — a note defaults to this date rather than today,
  /// so noting Tuesday's presentation on Sunday still lands on Tuesday.
  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final entry = block.first;
    final scheme = Theme.of(context).colorScheme;

    final summary = state.summaries.where((s) => s.subjectId == entry.subjectId).firstOrNull;
    final percent = roundPercentage(
      calculateAttendance(summary?.attended ?? 0, summary?.held ?? 0),
    );

    final notes = state.tasks.where((t) => t.subjectId == entry.subjectId && !t.done).toList()
      ..sort((a, b) => a.dueDate.compareTo(b.dueDate));

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.72,
      maxChildSize: 0.95,
      builder: (context, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
        children: [
          Text(subject?.name ?? 'Class', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 6),
          Text(
            '${block.startTime} – ${block.endTime} · ${_periods(block)}',
            style: Theme.of(context).textTheme.bodySmall,
          ),

          if (percent != null) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                Text(
                  '${percent.toStringAsFixed(2)}%',
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -1,
                    color: statusColour(percent),
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  '${summary!.attended} of ${summary.held} attended',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ],

          const SizedBox(height: 20),
          Text('DETAILS', style: Theme.of(context).textTheme.labelSmall),
          const SizedBox(height: 10),
          Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  // Everything the timetable response carries for this slot.
                  DetailRow(label: 'Subject code', value: subject?.code),
                  DetailRow(label: 'Short name', value: subject?.shortName),
                  DetailRow(label: 'Faculty', value: entry.facultyName),
                  DetailRow(label: 'Room', value: entry.room),
                  DetailRow(label: 'Building', value: entry.block),
                  DetailRow(
                    label: 'Type',
                    value: switch (entry.type) {
                      'lab' => 'Lab',
                      'technical' => 'Technical',
                      'activity' => 'Activity',
                      _ => 'Lecture',
                    },
                  ),
                  DetailRow(
                    label: 'Class strength',
                    value: entry.strength == null ? null : '${entry.strength} students',
                  ),
                  DetailRow(
                    label: 'Opted',
                    value: entry.opted == null
                        ? null
                        // Worth spelling out: a cohort of 145 with 109 opted is
                        // two sections combined, which is why the room is
                        // different for those slots.
                        : '${entry.opted} students',
                  ),
                  DetailRow(
                    label: 'Periods',
                    value: '${block.periods} × ${_minutes(block)} min',
                    last: true,
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 20),
          Row(
            children: [
              Text('YOUR NOTES', style: Theme.of(context).textTheme.labelSmall),
              const Spacer(),
              TextButton.icon(
                onPressed: () => _addNote(context),
                icon: const Icon(Icons.add, size: 17),
                label: const Text('Add'),
              ),
            ],
          ),
          if (notes.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'Nothing noted for this class. Add a reminder for a presentation, '
                'a submission, or anything to bring.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            )
          else
            ...notes.map((note) {
              final deadline = getDeadline(note.dueDate, DateTime.now());
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(note.title,
                                  style: Theme.of(context).textTheme.titleMedium),
                              if (note.notes.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 2),
                                  child: Text(note.notes,
                                      style: Theme.of(context).textTheme.bodySmall),
                                ),
                            ],
                          ),
                        ),
                        Text(
                          deadline.label,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: scheme.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  /// Period numbers when we have them, a plain count when we don't — older
  /// syncs predate the portal's period numbers being captured.
  static String _periods(ClassBlock block) {
    final first = block.first.periodNo;
    final last = block.entries.last.periodNo;
    if (first == null) {
      return '${block.periods} period${block.periods == 1 ? '' : 's'}';
    }
    if (block.isMerged && last != null && last != first) return 'periods $first–$last';
    return 'period $first';
  }

  static int _minutes(ClassBlock block) {
    int mins(String hhmm) {
      final parts = hhmm.split(':');
      return int.parse(parts[0]) * 60 + int.parse(parts[1]);
    }

    return ((mins(block.endTime) - mins(block.startTime)) / block.periods).round();
  }

  void _addNote(BuildContext context) {
    showFormSheet<void>(
      context: context,
      builder: (_) => _NoteForm(subject: subject, subjectId: block.first.subjectId, date: date),
    );
  }
}

/// Note against a class, with the date it's for — which is also when the
/// reminder fires, since reminders are scheduled from tasks.
class _NoteForm extends StatefulWidget {
  const _NoteForm({required this.subject, required this.subjectId, required this.date});

  final Subject? subject;
  final String subjectId;
  final DateTime date;

  @override
  State<_NoteForm> createState() => _NoteFormState();
}

class _NoteFormState extends State<_NoteForm> {
  final _title = TextEditingController();
  final _detail = TextEditingController();
  TaskKind _kind = TaskKind.other;
  late DateTime _due = widget.date;
  bool _busy = false;

  @override
  void dispose() {
    _title.dispose();
    _detail.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_title.text.trim().isEmpty) return;
    setState(() => _busy = true);
    await repository.addTask(
      title: _title.text,
      notes: _detail.text,
      kind: _kind,
      dueDate: _due,
      subjectId: widget.subjectId,
    );
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Note for ${widget.subject?.shortName ?? 'this class'}',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 4),
          Text(
            'You will be reminded two days before, and again the evening before.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _title,
            autofocus: true,
            decoration: const InputDecoration(hintText: 'Presentation on unit 3'),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 6,
            children: TaskKind.values
                .map((k) => ChoiceChip(
                      label: Text(taskKindLabels[k]!),
                      selected: k == _kind,
                      onSelected: (_) => setState(() => _kind = k),
                    ))
                .toList(),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: _due,
                firstDate: DateTime.now().subtract(const Duration(days: 7)),
                lastDate: DateTime.now().add(const Duration(days: 365)),
              );
              if (picked != null) setState(() => _due = picked);
            },
            icon: const Icon(Icons.event, size: 18),
            label: Text('For ${_due.day}/${_due.month}/${_due.year}'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _detail,
            maxLines: 2,
            decoration: const InputDecoration(hintText: 'Anything to prepare or bring…'),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _save,
            child: const Text('Save note'),
          ),
        ],
      ),
    );
  }
}
