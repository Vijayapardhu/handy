import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/app_state.dart';
import '../logic/deadlines.dart';
import '../main.dart';
import '../models/models.dart';
import '../widgets/form_sheet.dart';
import '../widgets/skeleton.dart';

/// What the student has to remember and the portal doesn't know: assignments,
/// presentations, lab records. The only screen in the app that writes.
///
/// Grouped by when things are due rather than listed flat. A deadline list is
/// read to answer "what do I have to deal with now", and a single column of
/// twelve items answers that only after you've read all twelve. The counts
/// along the top are the same question asked faster, and double as filters.
class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

/// Which slice of the list is on screen. Not persisted — a filter you set on
/// Tuesday should not still be hiding things on Friday.
enum _Filter { all, overdue, today, week }

class _TasksScreenState extends State<TasksScreen> {
  _Filter _filter = _Filter.all;
  bool _showDone = false;

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);

    if (state.loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Tasks')),
        body: const ListSkeleton(rows: 4, height: 84),
      );
    }

    final now = DateTime.now();
    final open = state.tasks.where((t) => !t.done).toList();
    final done = state.tasks.where((t) => t.done).toList();

    int countWhere(bool Function(int daysLeft) test) =>
        open.where((t) => test(getDeadline(t.dueDate, now).daysLeft)).length;

    final overdue = countWhere((d) => d < 0);
    final dueToday = countWhere((d) => d == 0);
    final thisWeek = countWhere((d) => d >= 0 && d <= 7);

    final visible = open.where((t) {
      final days = getDeadline(t.dueDate, now).daysLeft;
      return switch (_filter) {
        _Filter.all => true,
        _Filter.overdue => days < 0,
        _Filter.today => days == 0,
        _Filter.week => days >= 0 && days <= 7,
      };
    }).toList();

    final groups = _group(visible, now);

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(context, state),
        icon: const Icon(Icons.add),
        label: const Text('Add'),
      ),
      body: CustomScrollView(
        slivers: [
          SliverAppBar.large(
            title: const Text('Tasks'),
            expandedHeight: 120,
            actions: [
              if (done.isNotEmpty)
                IconButton(
                  onPressed: () => setState(() => _showDone = !_showDone),
                  icon: Icon(_showDone ? Icons.visibility_off_outlined : Icons.history),
                  tooltip: _showDone ? 'Hide completed' : 'Show completed',
                ),
            ],
          ),

          if (state.tasks.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: _Empty(onAdd: () => _openForm(context, state)),
            )
          else ...[
            SliverToBoxAdapter(
              child: _Summary(
                overdue: overdue,
                today: dueToday,
                week: thisWeek,
                filter: _filter,
                onFilter: (f) => setState(() => _filter = _filter == f ? _Filter.all : f),
              ),
            ),

            if (visible.isEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
                  child: Text(
                    switch (_filter) {
                      _Filter.overdue => 'Nothing overdue. Good.',
                      _Filter.today => 'Nothing due today.',
                      _Filter.week => 'Nothing due this week.',
                      _Filter.all => 'Everything here is done.',
                    },
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ),

            for (final group in groups) ...[
              SliverToBoxAdapter(child: _GroupHeader(group.label, group.tasks.length)),
              SliverList.builder(
                itemCount: group.tasks.length,
                itemBuilder: (context, i) => _TaskCard(task: group.tasks[i], state: state),
              ),
            ],

            if (_showDone && done.isNotEmpty) ...[
              SliverToBoxAdapter(child: _GroupHeader('Completed', done.length)),
              SliverList.builder(
                itemCount: done.length,
                itemBuilder: (context, i) => _TaskCard(task: done[i], state: state),
              ),
            ],

            const SliverToBoxAdapter(child: SizedBox(height: 96)),
          ],
        ],
      ),
    );
  }

  /// Buckets in the order a student worries about them. Empty buckets are
  /// dropped rather than shown empty — a heading with nothing under it reads
  /// as a loading failure.
  List<({String label, List<Task> tasks})> _group(List<Task> tasks, DateTime now) {
    final buckets = <String, List<Task>>{
      'Overdue': [],
      'Today': [],
      'Tomorrow': [],
      'This week': [],
      'Later': [],
    };

    for (final task in tasks) {
      final days = getDeadline(task.dueDate, now).daysLeft;
      final key = switch (days) {
        < 0 => 'Overdue',
        0 => 'Today',
        1 => 'Tomorrow',
        <= 7 => 'This week',
        _ => 'Later',
      };
      buckets[key]!.add(task);
    }

    return [
      for (final entry in buckets.entries)
        if (entry.value.isNotEmpty) (label: entry.key, tasks: entry.value),
    ];
  }

  void _openForm(BuildContext context, AppState state) {
    showFormSheet<void>(
      context: context,
      builder: (_) => _TaskForm(subjects: state.subjects),
    );
  }
}

/// Three counts across the top. Tapping one filters to it and tapping it again
/// clears — the count and the control are the same object, so there is nothing
/// extra to learn.
class _Summary extends StatelessWidget {
  const _Summary({
    required this.overdue,
    required this.today,
    required this.week,
    required this.filter,
    required this.onFilter,
  });

  final int overdue;
  final int today;
  final int week;
  final _Filter filter;
  final ValueChanged<_Filter> onFilter;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
      child: Row(
        children: [
          _Stat(
            value: overdue,
            label: 'Overdue',
            colour: const Color(0xFFDC2626),
            selected: filter == _Filter.overdue,
            onTap: () => onFilter(_Filter.overdue),
          ),
          const SizedBox(width: 10),
          _Stat(
            value: today,
            label: 'Today',
            colour: const Color(0xFFD97706),
            selected: filter == _Filter.today,
            onTap: () => onFilter(_Filter.today),
          ),
          const SizedBox(width: 10),
          _Stat(
            value: week,
            label: 'This week',
            colour: Theme.of(context).colorScheme.primary,
            selected: filter == _Filter.week,
            onTap: () => onFilter(_Filter.week),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({
    required this.value,
    required this.label,
    required this.colour,
    required this.selected,
    required this.onTap,
  });

  final int value;
  final String label;
  final Color colour;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // A zero is greyed rather than hidden: the shape of the row shouldn't
    // change as the week goes on, or the counts move under the thumb.
    final live = value > 0;
    final tint = live ? colour : Theme.of(context).textTheme.bodySmall?.color ?? Colors.grey;

    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: live ? onTap : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
          decoration: BoxDecoration(
            color: selected ? tint.withValues(alpha: 0.14) : Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected ? tint : Theme.of(context).dividerColor,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$value',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -1,
                  height: 1,
                  color: tint,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GroupHeader extends StatelessWidget {
  const _GroupHeader(this.label, this.count);
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
      child: Row(
        children: [
          Text(label.toUpperCase(), style: Theme.of(context).textTheme.labelSmall),
          const SizedBox(width: 8),
          Text(
            '$count',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                ),
          ),
        ],
      ),
    );
  }
}

/// One task. Swipe right to tick it off, swipe left to delete — both faster
/// than aiming at a control, and both undoable.
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

    final meta = [
      taskKindLabels[task.kind],
      if (task.subjectId != null) state.subjectsById[task.subjectId]?.shortName,
      if (task.dueTime != null) task.dueTime,
    ].whereType<String>().join(' · ');

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Dismissible(
        key: ValueKey(task.id),
        background: _SwipeHint(
          icon: task.done ? Icons.undo : Icons.check_circle,
          label: task.done ? 'Reopen' : 'Done',
          colour: const Color(0xFF16A34A),
          alignment: Alignment.centerLeft,
        ),
        secondaryBackground: const _SwipeHint(
          icon: Icons.delete_outline,
          label: 'Delete',
          colour: Color(0xFFDC2626),
          alignment: Alignment.centerRight,
        ),
        confirmDismiss: (direction) async {
          HapticFeedback.mediumImpact();
          if (direction == DismissDirection.startToEnd) {
            // Ticking off isn't a removal — the row stays and redraws struck
            // through, so it must not animate away.
            await repository.setTaskDone(task.id, !task.done);
            return false;
          }
          return true;
        },
        onDismissed: (_) => _deleteWithUndo(context),
        child: Card(
          clipBehavior: Clip.antiAlias,
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Urgency reads before any text does.
                Container(width: 4, color: task.done ? Colors.transparent : colour),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(10, 12, 12, 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _Tick(
                          done: task.done,
                          onTap: () {
                            HapticFeedback.selectionClick();
                            repository.setTaskDone(task.id, !task.done);
                          },
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                task.title,
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  decoration: task.done ? TextDecoration.lineThrough : null,
                                  color: task.done
                                      ? Theme.of(context).textTheme.bodySmall?.color
                                      : null,
                                ),
                              ),
                              if (meta.isNotEmpty) ...[
                                const SizedBox(height: 3),
                                Text(meta, style: Theme.of(context).textTheme.bodySmall),
                              ],
                              if (task.notes.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Text(
                                  task.notes,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          deadline.label,
                          textAlign: TextAlign.right,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: colour,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Deleting is the one destructive thing this screen does, and a swipe is
  /// easy to do by accident — so it always comes back with an undo.
  void _deleteWithUndo(BuildContext context) {
    final messenger = ScaffoldMessenger.of(context);
    final snapshot = task;
    repository.deleteTask(task.id);

    messenger.showSnackBar(
      SnackBar(
        content: Text('Deleted "${snapshot.title}"'),
        action: SnackBarAction(
          label: 'Undo',
          // Re-created rather than restored: the document is gone, so this
          // writes a new one with the same content.
          onPressed: () => repository.addTask(
            title: snapshot.title,
            notes: snapshot.notes,
            kind: snapshot.kind,
            dueDate: snapshot.dueDate,
            dueTime: snapshot.dueTime,
            subjectId: snapshot.subjectId,
          ),
        ),
      ),
    );
  }
}

/// Round tick rather than a Material checkbox: a square box in a rounded card
/// reads as a form field, and this is the primary action on the row.
class _Tick extends StatelessWidget {
  const _Tick({required this.done, required this.onTap});

  final bool done;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    const green = Color(0xFF16A34A);
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.only(top: 1, right: 2, bottom: 2),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          width: 22,
          height: 22,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: done ? green : Colors.transparent,
            border: Border.all(
              color: done ? green : Theme.of(context).dividerColor,
              width: 2,
            ),
          ),
          child: done
              ? const Icon(Icons.check, size: 14, color: Colors.white)
              : const SizedBox.shrink(),
        ),
      ),
    );
  }
}

class _SwipeHint extends StatelessWidget {
  const _SwipeHint({
    required this.icon,
    required this.label,
    required this.colour,
    required this.alignment,
  });

  final IconData icon;
  final String label;
  final Color colour;
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: colour, borderRadius: BorderRadius.circular(20)),
      alignment: alignment,
      padding: const EdgeInsets.symmetric(horizontal: 22),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 20),
          const SizedBox(width: 8),
          Text(
            label,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.onAdd});
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(32, 0, 32, 80),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.checklist_rtl,
              size: 44,
              color: Theme.of(context).textTheme.bodySmall?.color,
            ),
            const SizedBox(height: 14),
            Text('Nothing to remember yet', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(
              'Add a presentation, an assignment deadline, or anything '
              'the portal will never tell you about.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 18),
            FilledButton.tonalIcon(
              onPressed: onAdd,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add your first task'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Quick add: only a title and a date are required. Anything that makes a
/// student stop and think is a reason not to write the thing down at all —
/// so the date starts on today, the common dates are one tap, and everything
/// else is optional and below the fold.
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
  TimeOfDay? _time;
  String? _subjectId;
  bool _more = false;
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
      dueTime: _time == null
          ? null
          : '${_time!.hour.toString().padLeft(2, '0')}:'
              '${_time!.minute.toString().padLeft(2, '0')}',
      subjectId: _subjectId,
    );
    if (mounted) Navigator.of(context).pop();
  }

  bool _isDay(int offset) {
    final target = DateTime.now().add(Duration(days: offset));
    return _due.year == target.year && _due.month == target.month && _due.day == target.day;
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _title,
              autofocus: true,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(hintText: 'What do you need to remember?'),
            ),
            const SizedBox(height: 14),

            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: TaskKind.values
                  .map((k) => ChoiceChip(
                        label: Text(taskKindLabels[k]!),
                        selected: k == _kind,
                        onSelected: (_) => setState(() => _kind = k),
                      ))
                  .toList(),
            ),
            const SizedBox(height: 14),

            Text('DUE', style: Theme.of(context).textTheme.labelSmall),
            const SizedBox(height: 8),
            // Nearly every task a student adds is due today, tomorrow, or a
            // week out. Those are one tap; the picker is for the rest.
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                ChoiceChip(
                  label: const Text('Today'),
                  selected: _isDay(0),
                  onSelected: (_) => setState(() => _due = DateTime.now()),
                ),
                ChoiceChip(
                  label: const Text('Tomorrow'),
                  selected: _isDay(1),
                  onSelected: (_) =>
                      setState(() => _due = DateTime.now().add(const Duration(days: 1))),
                ),
                ChoiceChip(
                  label: const Text('Next week'),
                  selected: _isDay(7),
                  onSelected: (_) =>
                      setState(() => _due = DateTime.now().add(const Duration(days: 7))),
                ),
                ActionChip(
                  avatar: const Icon(Icons.event, size: 16),
                  label: Text('${_due.day}/${_due.month}'),
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _due,
                      firstDate: DateTime.now().subtract(const Duration(days: 30)),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) setState(() => _due = picked);
                  },
                ),
                ActionChip(
                  avatar: const Icon(Icons.schedule, size: 16),
                  label: Text(_time == null ? 'Add time' : _time!.format(context)),
                  onPressed: () async {
                    final picked = await showTimePicker(
                      context: context,
                      initialTime: _time ?? TimeOfDay.now(),
                    );
                    if (picked != null) setState(() => _time = picked);
                  },
                ),
              ],
            ),

            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => setState(() => _more = !_more),
                icon: Icon(_more ? Icons.expand_less : Icons.expand_more, size: 18),
                label: Text(_more ? 'Less' : 'Subject and notes'),
              ),
            ),

            if (_more) ...[
              if (widget.subjects.isNotEmpty) ...[
                DropdownButtonFormField<String?>(
                  value: _subjectId,
                  decoration: const InputDecoration(labelText: 'Subject (optional)'),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('Not tied to a subject')),
                    ...widget.subjects.map(
                      (s) => DropdownMenuItem(value: s.id, child: Text(s.name)),
                    ),
                  ],
                  onChanged: (v) => setState(() => _subjectId = v),
                ),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: _notes,
                maxLines: 2,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  hintText: 'Notes — what to prepare, what to bring…',
                ),
              ),
              const SizedBox(height: 12),
            ],

            const SizedBox(height: 6),
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
