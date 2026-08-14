import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../logic/deadlines.dart';
import '../main.dart';
import '../models/models.dart';

/// What the student has to remember and the portal doesn't know: assignments,
/// presentations, lab records. The only screen in the app that writes.
class TasksScreen extends StatelessWidget {
  const TasksScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final open = state.tasks.where((t) => !t.done).toList();
    final done = state.tasks.where((t) => t.done).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tasks'),
        actions: [
          IconButton(
            onPressed: () => _openForm(context, state),
            icon: const Icon(Icons.add),
            tooltip: 'Add task',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(context, state),
        icon: const Icon(Icons.add),
        label: const Text('Add'),
      ),
      body: state.tasks.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Text(
                  'Nothing to remember yet.\nAdd a presentation, an assignment deadline, or anything else you need to keep track of.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
              children: [
                ...open.map((t) => _TaskCard(task: t, state: state)),
                if (done.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text('COMPLETED',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.6,
                        color: Theme.of(context).textTheme.bodySmall?.color,
                      )),
                  const SizedBox(height: 8),
                  ...done.map((t) => _TaskCard(task: t, state: state)),
                ],
              ],
            ),
    );
  }

  void _openForm(BuildContext context, AppState state) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: _TaskForm(subjects: state.subjects),
      ),
    );
  }
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({required this.task, required this.state});

  final Task task;
  final AppState state;

  @override
  Widget build(BuildContext context) {
    final deadline = getDeadline(task.dueDate, DateTime.now(), done: task.done);
    final colour = switch (deadline.urgency) {
      Urgency.overdue || Urgency.today => const Color(0xFFDC2626),
      Urgency.tomorrow || Urgency.soon => const Color(0xFFD97706),
      _ => Theme.of(context).textTheme.bodySmall?.color ?? Colors.grey,
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Checkbox(
                value: task.done,
                onChanged: (v) => repository.setTaskDone(task.id, v ?? false),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      task.title,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        decoration: task.done ? TextDecoration.lineThrough : null,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [
                        taskKindLabels[task.kind],
                        if (task.subjectId != null) state.subjectsById[task.subjectId]?.shortName,
                        if (task.dueTime != null) task.dueTime,
                      ].whereType<String>().join(' · '),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    if (task.notes.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(task.notes, style: Theme.of(context).textTheme.bodySmall),
                      ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    deadline.label,
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: colour),
                  ),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: () => repository.deleteTask(task.id),
                    icon: const Icon(Icons.delete_outline, size: 17),
                    tooltip: 'Delete',
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

/// Quick add: only a title and a date are required. Anything that makes a
/// student stop and think is a reason not to write the thing down at all.
class _TaskForm extends StatefulWidget {
  const _TaskForm({required this.subjects});
  final List<Subject> subjects;

  @override
  State<_TaskForm> createState() => _TaskFormState();
}

class _TaskFormState extends State<_TaskForm> {
  final _title = TextEditingController();
  final _notes = TextEditingController();
  TaskKind _kind = TaskKind.assignment;
  DateTime _due = DateTime.now();
  String? _subjectId;
  bool _busy = false;

  @override
  void dispose() {
    _title.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_title.text.trim().isEmpty) return;
    setState(() => _busy = true);
    await repository.addTask(
      title: _title.text,
      notes: _notes.text,
      kind: _kind,
      dueDate: _due,
      subjectId: _subjectId,
    );
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _title,
            autofocus: true,
            decoration: const InputDecoration(
              hintText: 'What do you need to remember?',
              border: OutlineInputBorder(),
            ),
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
                firstDate: DateTime.now().subtract(const Duration(days: 30)),
                lastDate: DateTime.now().add(const Duration(days: 365)),
              );
              if (picked != null) setState(() => _due = picked);
            },
            icon: const Icon(Icons.event, size: 18),
            label: Text('Due ${_due.day}/${_due.month}/${_due.year}'),
          ),
          if (widget.subjects.isNotEmpty) ...[
            const SizedBox(height: 12),
            DropdownButtonFormField<String?>(
              value: _subjectId,
              decoration: const InputDecoration(
                labelText: 'Subject (optional)',
                border: OutlineInputBorder(),
              ),
              items: [
                const DropdownMenuItem(value: null, child: Text('Not tied to a subject')),
                ...widget.subjects.map(
                  (s) => DropdownMenuItem(value: s.id, child: Text(s.name)),
                ),
              ],
              onChanged: (v) => setState(() => _subjectId = v),
            ),
          ],
          const SizedBox(height: 12),
          TextField(
            controller: _notes,
            maxLines: 2,
            decoration: const InputDecoration(
              hintText: 'Notes — what to prepare, what to bring…',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _save,
            style: FilledButton.styleFrom(padding: const EdgeInsets.all(15)),
            child: const Text('Add task'),
          ),
        ],
      ),
    );
  }
}
