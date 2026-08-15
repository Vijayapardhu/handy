import 'package:flutter/material.dart';

import '../logic/timetable.dart';
import '../models/models.dart';
import '../theme.dart';
import 'app_icon.dart';

/// One class — or one *session*, when the portal split it across consecutive
/// periods. A three-hour lab arrives as three rows; showing it as three
/// identical cards makes the reader do the merging in their head.
class ClassTile extends StatelessWidget {
  const ClassTile({super.key, required this.block, this.subject, this.highlight = false});

  final ClassBlock block;
  final Subject? subject;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final entry = block.first;
    final muted = Theme.of(context).textTheme.bodySmall?.color;
    final place =
        [entry.room, entry.block].whereType<String>().where((p) => p.isNotEmpty).join(' · ');

    return Card(
      shape: highlight
          ? RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: const BorderSide(color: HandyColors.orange, width: 1.6),
            )
          : null,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Time column: start prominent, end quiet — you scan for when it
            // begins, and only check the end when you're deciding.
            SizedBox(
              width: 56,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    block.startTime,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                    ),
                  ),
                  Text(block.endTime, style: TextStyle(fontSize: 12, color: muted)),
                ],
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    subject?.name ?? 'Class',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  if (entry.facultyName.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        entry.facultyName,
                        style: Theme.of(context).textTheme.bodySmall,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  if (place.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Row(
                        children: [
                          AppIcon(HugeIcons.strokeRoundedLocation01, size: 14, color: muted),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              place,
                              style: Theme.of(context).textTheme.bodySmall,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (entry.type != 'lecture') _Pill(label: _typeLabel(entry.type)),
                if (block.isMerged)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      '${block.periods} periods',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: muted),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static String _typeLabel(String type) => switch (type) {
        'lab' => 'Lab',
        'technical' => 'Technical',
        'activity' => 'Activity',
        _ => 'Class',
      };
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: HandyColors.orange.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: HandyColors.orange,
        ),
      ),
    );
  }
}
