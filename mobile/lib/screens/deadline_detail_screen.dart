import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/app_state.dart';
import '../data/repository.dart';
import '../logic/deadlines.dart';
import '../logic/planning.dart';
import '../main.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/app_icon.dart';

/// One deadline in full, and the only place it can be changed after it's
/// written.
///
/// Until this screen existed a deadline was write-once: a typo in the title
/// or a date that moved meant deleting it and starting again, which is why
/// notes went unwritten — anything you can't correct isn't worth typing
/// carefully.
///
/// Edits save as you make them rather than behind a Save button. There is no
/// draft worth protecting here, and a settings-style screen that silently
/// discards work when you press back is worse than one that commits.
class DeadlineDetailScreen extends StatelessWidget {
  const DeadlineDetailScreen({super.key, required this.taskId});

  /// Looked up by id on every build rather than passed in whole, so the screen
  /// redraws from the stream when anything changes it.
  final String taskId;

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final task = state.tasks.where((t) => t.id == taskId).firstOrNull;

    if (task == null) {
      // Deleted from under us — an empty screen with a working back button
      // beats a crash or a stale copy of something that no longer exists.
      return Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Text('This deadline is gone.', style: Theme.of(context).textTheme.bodySmall),
        ),
      );
    }

    final deadline = getDeadline(task.dueDate, DateTime.now(), done: task.done);
    final colour = switch (deadline.urgency) {
      Urgency.overdue || Urgency.today => HandyColors.bad,
      Urgency.tomorrow || Urgency.soon => HandyColors.warn,
      _ => Theme.of(context).textTheme.bodySmall?.color ?? Colors.grey,
    };
    final subject = task.subjectId == null ? null : state.subjectsById[task.subjectId];

    return Scaffold(
      appBar: AppBar(
        actions: [
          IconButton(
            tooltip: 'Delete',
            onPressed: () => _confirmDelete(context, task),
            icon: AppIcon(HugeIcons.strokeRoundedDelete02),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  task.title,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        decoration: task.done ? TextDecoration.lineThrough : null,
                      ),
                ),
              ),
              IconButton(
                tooltip: 'Rename',
                onPressed: () => _editTitle(context, task),
                icon: AppIcon(HugeIcons.strokeRoundedEdit02, size: 20),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(
                deadline.label,
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: colour),
              ),
              const SizedBox(width: 8),
              Text(
                '· ${taskKindLabels[task.kind]}'
                '${subject == null ? '' : ' · ${subject.shortName}'}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),

          const SizedBox(height: 18),
          FilledButton.tonalIcon(
            onPressed: () {
              HapticFeedback.selectionClick();
              repository.setTaskDone(task.id, !task.done, task: task);
              if (!task.done && task.repeat != TaskRepeat.none) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      'Done. Next one set for '
                      '${_shortDate(Repository.nextOccurrence(task.dueDate, task.repeat))}.',
                    ),
                  ),
                );
              }
            },
            icon: AppIcon(task.done ? HugeIcons.strokeRoundedArrowTurnBackward : HugeIcons.strokeRoundedCheckmarkCircle01, size: 18),
            label: Text(task.done ? 'Mark as not done' : 'Mark as done'),
          ),

          const SizedBox(height: 26),
          _Section(
            title: 'Steps',
            trailing: TextButton.icon(
              onPressed: () => _addSubtask(context, task),
              icon: AppIcon(HugeIcons.strokeRoundedAdd01, size: 17),
              label: const Text('Add step'),
            ),
          ),
          if (task.subtasks.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Text(
                'Break it into steps — write it up, print it, get it signed. '
                'One checkbox for the lot stays unticked until the last minute.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            )
          else ...[
            _SubtaskProgress(task: task),
            const SizedBox(height: 8),
            ...List.generate(task.subtasks.length, (i) {
              final step = task.subtasks[i];
              return Dismissible(
                key: ValueKey('$taskId-$i-${step.title}'),
                direction: DismissDirection.endToStart,
                background: Container(
                  alignment: Alignment.centerRight,
                  padding: const EdgeInsets.only(right: 18),
                  decoration: BoxDecoration(
                    color: HandyColors.bad,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: AppIcon(HugeIcons.strokeRoundedDelete02, color: Colors.white, size: 18),
                ),
                onDismissed: (_) {
                  final next = [...task.subtasks]..removeAt(i);
                  repository.updateTask(task.id, subtasks: next);
                },
                child: CheckboxListTile(
                  value: step.done,
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  onChanged: (v) {
                    HapticFeedback.selectionClick();
                    final next = [...task.subtasks];
                    next[i] = step.copyWith(done: v ?? false);
                    repository.updateTask(task.id, subtasks: next);
                  },
                  title: Text(
                    step.title,
                    style: TextStyle(
                      fontSize: 14.5,
                      decoration: step.done ? TextDecoration.lineThrough : null,
                      color: step.done ? Theme.of(context).textTheme.bodySmall?.color : null,
                    ),
                  ),
                ),
              );
            }),
          ],

          const SizedBox(height: 22),
          _PlanSection(task: task, state: state),

          const SizedBox(height: 22),
          const _Section(title: 'Details'),
          Card(
            child: Column(
              children: [
                _EditRow(
                  icon: HugeIcons.strokeRoundedCalendar02,
                  label: 'Due',
                  value: _longDate(task.dueDate),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: task.dueDate,
                      firstDate: DateTime.now().subtract(const Duration(days: 365)),
                      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
                    );
                    if (picked != null) repository.updateTask(task.id, dueDate: picked);
                  },
                ),
                _EditRow(
                  icon: HugeIcons.strokeRoundedClock01,
                  label: 'Time',
                  value: task.dueTime ?? 'No time set',
                  onTap: () async {
                    final picked = await showTimePicker(
                      context: context,
                      initialTime: _parseTime(task.dueTime) ?? TimeOfDay.now(),
                    );
                    if (picked != null) {
                      repository.updateTask(
                        task.id,
                        dueTime: '${picked.hour.toString().padLeft(2, '0')}:'
                            '${picked.minute.toString().padLeft(2, '0')}',
                      );
                    }
                  },
                  onClear: task.dueTime == null
                      ? null
                      : () => repository.updateTask(task.id, clearDueTime: true),
                ),
                _EditRow(
                  icon: HugeIcons.strokeRoundedLayers01,
                  label: 'Kind',
                  value: taskKindLabels[task.kind]!,
                  onTap: () => _pickKind(context, task),
                ),
                _EditRow(
                  icon: HugeIcons.strokeRoundedBookOpen01,
                  label: 'Subject',
                  value: subject?.name ?? 'Not tied to a subject',
                  onTap: () => _pickSubject(context, task, state),
                  onClear: task.subjectId == null
                      ? null
                      : () => repository.updateTask(task.id, clearSubject: true),
                ),
                _EditRow(
                  icon: HugeIcons.strokeRoundedRepeat,
                  label: 'Repeat',
                  value: taskRepeatLabels[task.repeat]!,
                  onTap: () => _pickRepeat(context, task),
                  last: true,
                ),
              ],
            ),
          ),

          const SizedBox(height: 22),
          _Section(
            title: 'Notes',
            trailing: TextButton.icon(
              onPressed: () => _editNotes(context, task),
              icon: AppIcon(HugeIcons.strokeRoundedEdit02, size: 16),
              label: Text(task.notes.isEmpty ? 'Add' : 'Edit'),
            ),
          ),
          Text(
            task.notes.isEmpty ? 'Nothing noted.' : task.notes,
            style: task.notes.isEmpty
                ? Theme.of(context).textTheme.bodySmall
                : Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }

  static TimeOfDay? _parseTime(String? hhmm) {
    if (hhmm == null) return null;
    final parts = hhmm.split(':');
    if (parts.length != 2) return null;
    return TimeOfDay(hour: int.tryParse(parts[0]) ?? 0, minute: int.tryParse(parts[1]) ?? 0);
  }

  static const _months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  static String _longDate(DateTime d) => '${d.day} ${_months[d.month - 1]} ${d.year}';
  static String _shortDate(DateTime d) => '${d.day} ${_months[d.month - 1].substring(0, 3)}';

  Future<void> _editTitle(BuildContext context, Task task) async {
    final value = await _promptText(context, 'Title', task.title, lines: 1);
    if (value != null && value.trim().isNotEmpty) {
      repository.updateTask(task.id, title: value);
    }
  }

  Future<void> _editNotes(BuildContext context, Task task) async {
    final value = await _promptText(context, 'Notes', task.notes, lines: 4);
    if (value != null) repository.updateTask(task.id, notes: value);
  }

  Future<void> _addSubtask(BuildContext context, Task task) async {
    final value = await _promptText(context, 'Add a step', '', lines: 1);
    if (value == null || value.trim().isEmpty) return;
    repository.updateTask(
      task.id,
      subtasks: [...task.subtasks, Subtask(title: value.trim(), done: false)],
    );
  }

  Future<String?> _promptText(
    BuildContext context,
    String label,
    String initial, {
    required int lines,
  }) {
    final controller = TextEditingController(text: initial);
    return showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(label),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: lines,
          textCapitalization: TextCapitalization.sentences,
          onSubmitted: lines == 1
              ? (v) => Navigator.of(dialogContext).pop(v)
              : null,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(controller.text),
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _pickKind(BuildContext context, Task task) {
    _pickFrom<TaskKind>(
      context,
      title: 'Kind',
      values: TaskKind.values,
      labels: taskKindLabels,
      current: task.kind,
      onPick: (v) => repository.updateTask(task.id, kind: v),
    );
  }

  void _pickRepeat(BuildContext context, Task task) {
    _pickFrom<TaskRepeat>(
      context,
      title: 'Repeat',
      values: TaskRepeat.values,
      labels: taskRepeatLabels,
      current: task.repeat,
      onPick: (v) => repository.updateTask(task.id, repeat: v),
    );
  }

  void _pickFrom<T>(
    BuildContext context, {
    required String title,
    required List<T> values,
    required Map<T, String> labels,
    required T current,
    required ValueChanged<T> onPick,
  }) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Text(title.toUpperCase(),
                  style: Theme.of(sheetContext).textTheme.labelSmall),
            ),
            ...values.map(
              (v) => RadioListTile<T>(
                value: v,
                groupValue: current,
                title: Text(labels[v]!),
                onChanged: (picked) {
                  Navigator.of(sheetContext).pop();
                  if (picked != null) onPick(picked);
                },
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _pickSubject(BuildContext context, Task task, AppState state) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            ListTile(
              title: const Text('Not tied to a subject'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                repository.updateTask(task.id, clearSubject: true);
              },
            ),
            ...state.subjects.map(
              (s) => ListTile(
                title: Text(s.name),
                subtitle: s.code.isEmpty ? null : Text(s.code),
                selected: s.id == task.subjectId,
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  repository.updateTask(task.id, subjectId: s.id);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmDelete(BuildContext context, Task task) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete this deadline?'),
        content: Text('"${task.title}" and its steps will be removed.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: HandyColors.bad),
            onPressed: () {
              Navigator.of(dialogContext).pop();
              Navigator.of(context).pop();
              repository.deleteTask(task.id);
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}

/// "When are you actually going to do this?"
///
/// The gap nothing else can fill: Handy knows both when the work is due and
/// when the student is free, and joining them turns a deadline from a fact
/// into a plan. Picking a slot also schedules the one reminder that arrives
/// while they can act on it — the two-days-out and evening-before nudges land
/// when the day is already over.
class _PlanSection extends StatelessWidget {
  const _PlanSection({required this.task, required this.state});

  final Task task;
  final AppState state;

  static const _days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    if (task.isAttached) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Section(title: 'Planned for'),
          const SizedBox(height: 8),
          Card(
            child: ListTile(
              leading: AppIcon(HugeIcons.strokeRoundedCoffee02, size: 20, color: scheme.primary),
              title: Text(
                '${_days[task.attachDay!]} at ${task.attachTime}',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              subtitle: Text(
                'A free period. You will be reminded when it starts.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              trailing: IconButton(
                tooltip: 'Unplan',
                onPressed: () => repository.updateTask(task.id, clearAttachment: true),
                icon: const AppIcon(HugeIcons.strokeRoundedCancel01, size: 18),
              ),
            ),
          ),
        ],
      );
    }

    final slots = plannableSlots(state.entries, task.dueDate, DateTime.now());

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _Section(title: 'When will you do it?'),
        const SizedBox(height: 8),
        if (slots.isEmpty)
          Text(
            state.entries.isEmpty
                ? 'Handy needs your timetable before it can suggest a time.'
                : 'No free periods between now and the deadline.',
            style: Theme.of(context).textTheme.bodySmall,
          )
        else ...[
          Text(
            'Free periods before this is due. Pick one and it becomes a plan.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 84,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: slots.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final slot = slots[i];
                return InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () {
                    HapticFeedback.selectionClick();
                    repository.updateTask(
                      task.id,
                      attachDay: slot.dayOfWeek,
                      attachTime: slot.startTime,
                    );
                  },
                  child: Container(
                    width: 116,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Theme.of(context).dividerColor),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${_days[slot.dayOfWeek].substring(0, 3)} ${slot.date.day}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        Text(
                          slot.startTime,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                          ),
                        ),
                        Text(
                          'Period ${slot.periodNo}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ],
    );
  }
}

class _SubtaskProgress extends StatelessWidget {
  const _SubtaskProgress({required this.task});
  final Task task;

  @override
  Widget build(BuildContext context) {
    final done = task.subtasksDone;
    final total = task.subtasks.length;
    return Row(
      children: [
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: total == 0 ? 0 : done / total,
              minHeight: 5,
              backgroundColor: Theme.of(context).dividerColor,
              valueColor: AlwaysStoppedAnimation(Theme.of(context).colorScheme.primary),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Text('$done of $total', style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, this.trailing});
  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(title.toUpperCase(), style: Theme.of(context).textTheme.labelSmall),
        const Spacer(),
        if (trailing != null) trailing!,
      ],
    );
  }
}

class _EditRow extends StatelessWidget {
  const _EditRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
    this.onClear,
    this.last = false,
  });

  final AppIconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;

  /// Present only when there is something to clear — a permanently greyed
  /// clear button is a control that lies about what it does.
  final VoidCallback? onClear;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: last
            ? null
            : BoxDecoration(
                border: Border(bottom: BorderSide(color: Theme.of(context).dividerColor)),
              ),
        child: Row(
          children: [
            AppIcon(icon, size: 18, color: Theme.of(context).textTheme.bodySmall?.color),
            const SizedBox(width: 14),
            SizedBox(
              width: 74,
              child: Text(label, style: Theme.of(context).textTheme.bodySmall),
            ),
            Expanded(
              child: Text(
                value,
                textAlign: TextAlign.right,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            if (onClear != null)
              IconButton(
                visualDensity: VisualDensity.compact,
                onPressed: onClear,
                icon: AppIcon(HugeIcons.strokeRoundedCancel01, size: 16),
                tooltip: 'Clear',
              ),
          ],
        ),
      ),
    );
  }
}
