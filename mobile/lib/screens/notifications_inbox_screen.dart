import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../main.dart';
import '../theme.dart';
import '../widgets/app_icon.dart';
import '../widgets/skeleton.dart';
import 'account_screens.dart';
import 'timetable_changes_screen.dart';

/// Everything Handy has told this student, kept.
///
/// A push is gone the moment it is swiped away. A student who clears their
/// shade on the bus has no way back to what it said, and the useful ones —
/// "your timetable changed" — are exactly the ones worth re-reading. The
/// server records every notification it sends, whether or not a device was
/// registered to receive it, and this is where they live.
class NotificationsInboxScreen extends StatelessWidget {
  const NotificationsInboxScreen({super.key});

  /// Ordered here rather than in the query so the collection needs no
  /// composite index alongside the userId filter.
  Stream<List<_Item>> _watch() {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return Stream.value(const []);

    return FirebaseFirestore.instance
        .collection('notifications')
        .where('userId', isEqualTo: uid)
        .snapshots()
        .map((snap) {
      final items = snap.docs.map((d) => _Item.fromMap(d.id, d.data())).toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return items;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          IconButton(
            tooltip: 'Preferences',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const NotificationSettingsScreen(),
              ),
            ),
            icon: AppIcon(HugeIcons.strokeRoundedSettings02, size: 20),
          ),
        ],
      ),
      body: StreamBuilder<List<_Item>>(
        stream: _watch(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const ListSkeleton(rows: 5, height: 76);
          }

          final items = snapshot.data ?? const <_Item>[];
          if (items.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(36),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    AppIcon(
                      HugeIcons.strokeRoundedNotification01,
                      size: 40,
                      color: Theme.of(context).textTheme.bodySmall?.color,
                    ),
                    const SizedBox(height: 14),
                    Text('Nothing yet', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 6),
                    Text(
                      'Attendance updates and timetable changes will be kept '
                      'here, so clearing them from your phone does not lose them.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            );
          }

          final unread = items.where((i) => !i.read).length;

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              if (unread > 0)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      Text(
                        '$unread unread',
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                      const Spacer(),
                      TextButton(
                        onPressed: () => _markAllRead(items),
                        child: const Text('Mark all read'),
                      ),
                    ],
                  ),
                ),
              ...items.map((item) => _Row(item: item)),
            ],
          );
        },
      ),
    );
  }

  static Future<void> _markAllRead(List<_Item> items) async {
    final db = FirebaseFirestore.instance;
    final batch = db.batch();
    for (final item in items.where((i) => !i.read)) {
      batch.update(db.collection('notifications').doc(item.id), {'read': true});
    }
    await batch.commit();
  }
}

class _Item {
  const _Item({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.read,
    required this.createdAt,
    this.timetableId,
    this.version,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final bool read;
  final String createdAt;

  /// Set on timetable notifications so the inbox can open the right version.
  final String? timetableId;
  final int? version;

  factory _Item.fromMap(String id, Map<String, dynamic> d) => _Item(
        id: id,
        type: d['type'] as String? ?? 'announcement',
        title: d['title'] as String? ?? '',
        body: d['body'] as String? ?? '',
        read: d['read'] as bool? ?? false,
        createdAt: d['createdAt'] as String? ?? '',
        timetableId: d['timetableId'] as String?,
        version: (d['version'] as num?)?.toInt(),
      );
}

class _Row extends StatelessWidget {
  const _Row({required this.item});

  final _Item item;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final (icon, colour) = switch (item.type) {
      'timetable' => (HugeIcons.strokeRoundedCalendar01, scheme.primary),
      'attendance' => (HugeIcons.strokeRoundedPieChart, HandyColors.good),
      'target' => (HugeIcons.strokeRoundedAlert02, HandyColors.bad),
      _ => (HugeIcons.strokeRoundedNotification01, scheme.primary),
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        // Unread carries a tint rather than a dot: the whole row is the thing
        // that is new, and a dot makes the reader hunt for it.
        color: item.read ? null : scheme.primary.withValues(alpha: 0.06),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => _open(context),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppIcon(icon, size: 18, color: colour),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        style: TextStyle(
                          fontWeight: item.read ? FontWeight.w600 : FontWeight.w800,
                        ),
                      ),
                      if (item.body.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(item.body, style: Theme.of(context).textTheme.bodySmall),
                      ],
                      const SizedBox(height: 4),
                      Text(
                        _relative(item.createdAt),
                        style: TextStyle(
                          fontSize: 11,
                          color: Theme.of(context).textTheme.bodySmall?.color,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _open(BuildContext context) {
    if (!item.read) {
      FirebaseFirestore.instance
          .collection('notifications')
          .doc(item.id)
          .update({'read': true});
    }

    // Only the timetable one has somewhere to go. Sending the rest to a screen
    // that does not answer them would be worse than leaving them alone.
    if (item.type != 'timetable') return;
    if (item.timetableId == null || item.version == null) return;

    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TimetableChangesScreen(
          timetableId: item.timetableId!,
          version: item.version!,
          section: appState.student?.section,
          // The changes live on the notification, since they differ per
          // recipient — see TimetableChangesScreen.
          notificationId: item.id,
        ),
      ),
    );
  }

  static String _relative(String iso) {
    final at = DateTime.tryParse(iso);
    if (at == null) return '';
    final mins = DateTime.now().difference(at).inMinutes;
    if (mins < 1) return 'just now';
    if (mins < 60) return '${mins}m ago';
    final hours = mins ~/ 60;
    if (hours < 24) return '${hours}h ago';
    final days = hours ~/ 24;
    if (days < 7) return '${days}d ago';
    return '${at.day}/${at.month}/${at.year}';
  }
}
