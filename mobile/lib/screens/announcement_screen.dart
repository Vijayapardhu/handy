import 'package:cached_network_image/cached_network_image.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../theme.dart';
import '../widgets/app_icon.dart';
import '../widgets/skeleton.dart';

/// One announcement, in full.
///
/// The notification carries a sentence; this carries what was actually posted
/// — the whole message, the photographs of the board, the file, the links.
/// That split is deliberate: a lock-screen preview should be readable at a
/// glance, and everything that cannot be is here.
class AnnouncementScreen extends StatelessWidget {
  const AnnouncementScreen({super.key, required this.announcementId});

  final String announcementId;

  Future<Map<String, dynamic>?> _load() async {
    final doc = await FirebaseFirestore.instance
        .doc('announcements/$announcementId')
        .get();
    return doc.data();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Announcement')),
      body: FutureBuilder<Map<String, dynamic>?>(
        future: _load(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const ListSkeleton(rows: 4, height: 90);
          }

          final data = snapshot.data;
          if (data == null) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Text(
                  // Covers both "deleted" and "not in that class" — the rules
                  // refuse the read either way, and the app has no business
                  // telling a student which.
                  'This announcement is no longer available to you.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            );
          }

          final media = (data['media'] as List<dynamic>? ?? [])
              .map((m) => Map<String, dynamic>.from(m as Map))
              .toList();
          final links = (data['links'] as List<dynamic>? ?? [])
              .map((l) => Map<String, dynamic>.from(l as Map))
              .toList();
          final body = data['body'] as String? ?? '';

          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
            children: [
              if (data['important'] == true) ...[
                _ImportantBanner(),
                const SizedBox(height: 14),
              ],

              Text(
                data['title'] as String? ?? '',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              _Byline(
                name: data['authorName'] as String? ?? 'Class rep',
                roll: data['authorRoll'] as String? ?? '',
                at: data['createdAt'] as String? ?? '',
              ),

              if (body.isNotEmpty) ...[
                const SizedBox(height: 20),
                SelectableText(
                  body,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.55),
                ),
              ],

              if (media.isNotEmpty) ...[
                const SizedBox(height: 24),
                Text('ATTACHED', style: Theme.of(context).textTheme.labelSmall),
                const SizedBox(height: 10),
                ...media.map((item) => _Attachment(item: item)),
              ],

              if (links.isNotEmpty) ...[
                const SizedBox(height: 24),
                Text('LINKS', style: Theme.of(context).textTheme.labelSmall),
                const SizedBox(height: 10),
                ...links.map((link) => _LinkRow(link: link)),
              ],

              const SizedBox(height: 24),
              Text(
                'Posted to your class by its representative. Handy passes it on '
                'unchanged and does not check it.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ImportantBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: HandyColors.bad.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: HandyColors.bad.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          AppIcon(HugeIcons.strokeRoundedAlert02, size: 16, color: HandyColors.bad),
          const SizedBox(width: 10),
          const Text(
            'Marked important',
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w800,
              color: HandyColors.bad,
            ),
          ),
        ],
      ),
    );
  }
}

class _Byline extends StatelessWidget {
  const _Byline({required this.name, required this.roll, required this.at});

  final String name;
  final String roll;
  final String at;

  @override
  Widget build(BuildContext context) {
    final when = DateTime.tryParse(at);
    return Text(
      [
        name,
        if (roll.isNotEmpty) roll,
        if (when != null) '${when.day}/${when.month} at '
            '${when.hour.toString().padLeft(2, '0')}:'
            '${when.minute.toString().padLeft(2, '0')}',
      ].join(' · '),
      style: Theme.of(context).textTheme.bodySmall,
    );
  }
}

/// An image, video or file that was uploaded with the announcement.
///
/// Images are shown inline because a photograph of the board is the message,
/// not an appendix to it. Anything else is a row that opens in whatever app
/// handles it — Handy does not try to be a document viewer.
class _Attachment extends StatelessWidget {
  const _Attachment({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final url = item['url'] as String?;
    final kind = item['kind'] as String? ?? 'file';
    final name = item['name'] as String? ?? 'Attachment';

    if (kind == 'image' && url != null) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: CachedNetworkImage(
            imageUrl: url,
            fit: BoxFit.cover,
            placeholder: (_, __) => Container(
              height: 180,
              color: Theme.of(context).colorScheme.surface,
            ),
            // A broken image is shown as a broken image rather than as nothing;
            // silently dropping it would leave the message missing its point.
            errorWidget: (_, __, ___) => Container(
              height: 120,
              alignment: Alignment.center,
              color: Theme.of(context).colorScheme.surface,
              child: Text(
                'Could not load this image',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: url == null ? null : () => _open(context, url),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                AppIcon(
                  kind == 'video'
                      ? HugeIcons.strokeRoundedPlayCircle
                      : HugeIcons.strokeRoundedPackageOpen,
                  size: 19,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                      Text(
                        _size(item['size']),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                AppIcon(HugeIcons.strokeRoundedLinkSquare01, size: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static String _size(dynamic bytes) {
    final n = (bytes as num?)?.toInt() ?? 0;
    if (n <= 0) return 'Tap to open';
    if (n < 1024 * 1024) return '${(n / 1024).round()} KB';
    return '${(n / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

class _LinkRow extends StatelessWidget {
  const _LinkRow({required this.link});

  final Map<String, dynamic> link;

  @override
  Widget build(BuildContext context) {
    final url = link['url'] as String? ?? '';
    final label = (link['label'] as String?)?.trim();

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => _open(context, url),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                AppIcon(
                  HugeIcons.strokeRoundedGlobe02,
                  size: 19,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (label != null && label.isNotEmpty)
                        Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
                      // The address is always shown, even when there is a
                      // label. A link whose destination is hidden behind
                      // friendly words is the shape of every phishing message
                      // ever sent.
                      Text(
                        url,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                AppIcon(HugeIcons.strokeRoundedLinkSquare01, size: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Opens in the browser, and says so plainly when it cannot.
Future<void> _open(BuildContext context, String url) async {
  final messenger = ScaffoldMessenger.of(context);
  try {
    final launched = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!launched) throw Exception('no handler');
  } catch (_) {
    messenger.showSnackBar(
      SnackBar(
        content: Text('Could not open $url'),
        action: SnackBarAction(
          label: 'Copy',
          onPressed: () => Clipboard.setData(ClipboardData(text: url)),
        ),
      ),
    );
  }
}
