import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/app_icon.dart';
import '../widgets/skeleton.dart';

/// What actually moved when a section's timetable was republished.
///
/// This is the screen the "Timetable updated" notification opens, and the
/// reason that notification is worth sending at all. "Your timetable changed"
/// on its own makes a student open the app and compare two grids by eye; this
/// says the room moved from RB-221 to AGBI-2.1 on Monday at 09:30.
///
/// The comparison is done on the server, because the phone only holds the
/// version it last synced — and the student who most needs telling is exactly
/// the one who has not synced in a fortnight and has nothing to compare
/// against.
class TimetableChangesScreen extends StatelessWidget {
  const TimetableChangesScreen({
    super.key,
    required this.timetableId,
    required this.version,
    this.section,
    this.notificationId,
  });

  final String timetableId;
  final int version;
  final String? section;

  /// The notification this was opened from.
  ///
  /// The changes live on it rather than on a shared version document, because
  /// they differ per recipient: two students on the same timetable can have
  /// different electives, so there is no single "what changed" to point at.
  final String? notificationId;

  Future<Map<String, dynamic>?> _load() async {
    if (notificationId == null) return null;
    final doc = await FirebaseFirestore.instance
        .doc('notifications/$notificationId')
        .get();
    return doc.data();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Timetable changes')),
      body: FutureBuilder<Map<String, dynamic>?>(
        future: _load(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const ListSkeleton(rows: 4, height: 76);
          }

          final data = snapshot.data;
          if (data == null) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Text(
                  'That version is no longer kept. Only the last few are, so '
                  'the current timetable is the one to trust.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            );
          }

          final changes = (data['changes'] as List<dynamic>? ?? [])
              .map((c) => Map<String, dynamic>.from(c as Map))
              .toList();

          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 36),
            children: [
              _Header(
                timetableId: timetableId,
                section: (data['section'] as String?) ?? section ?? '',
                version: version,
                count: changes.length,
              ),
              const SizedBox(height: 22),

              if (changes.isEmpty)
                Text(
                  'The timetable was republished with the same schedule. '
                  'Nothing moved.',
                  style: Theme.of(context).textTheme.bodySmall,
                )
              else ...[
                Text('WHAT MOVED', style: Theme.of(context).textTheme.labelSmall),
                const SizedBox(height: 10),
                ...changes.map((change) => _ChangeCard(change: change)),
              ],

              const SizedBox(height: 20),
              Text(
                'This came from another student on the same timetable syncing '
                'before you did. Your own copy updates the next time you sync.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.timetableId,
    required this.section,
    required this.version,
    required this.count,
  });

  final String timetableId;
  final String section;
  final int version;
  final int count;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: scheme.primary.withValues(alpha: 0.4)),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            scheme.primary.withValues(alpha: 0.16),
            scheme.primary.withValues(alpha: 0.03),
          ],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            section.isEmpty ? 'Timetable $timetableId' : section,
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              _Pill(label: 'ID $timetableId'),
              _Pill(label: 'Version $version'),
              _Pill(
                label: count == 0
                    ? 'No changes'
                    : '$count change${count == 1 ? '' : 's'}',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: scheme.primary.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: scheme.primary),
      ),
    );
  }
}

class _ChangeCard extends StatelessWidget {
  const _ChangeCard({required this.change});

  final Map<String, dynamic> change;

  @override
  Widget build(BuildContext context) {
    final kind = change['kind'] as String? ?? 'changed';
    final (colour, icon, label) = switch (kind) {
      'added' => (HandyColors.good, HugeIcons.strokeRoundedAdd01, 'Added'),
      'removed' => (HandyColors.bad, HugeIcons.strokeRoundedMinusSign, 'Removed'),
      _ => (HandyColors.warn, HugeIcons.strokeRoundedArrowRight01, 'Moved'),
    };

    final from = change['from'] as String?;
    final to = change['to'] as String?;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  AppIcon(icon, size: 15, color: colour),
                  const SizedBox(width: 8),
                  Text(
                    label.toUpperCase(),
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.6,
                      color: colour,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    change['where'] as String? ?? '',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
              const SizedBox(height: 10),
              // Both sides shown for a move, one side for an add or a removal
              // — a struck-through line with nothing to replace it reads as a
              // rendering fault rather than as a cancelled class.
              if (from != null && from.isNotEmpty)
                Text(
                  from,
                  style: TextStyle(
                    fontSize: 14,
                    decoration: kind == 'changed' ? TextDecoration.lineThrough : null,
                    color: Theme.of(context).textTheme.bodySmall?.color,
                  ),
                ),
              if (to != null && to.isNotEmpty)
                Padding(
                  padding: EdgeInsets.only(top: from != null && from.isNotEmpty ? 3 : 0),
                  child: Text(
                    to,
                    style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
