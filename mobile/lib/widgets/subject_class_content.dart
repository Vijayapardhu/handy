import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/repository.dart';
import '../main.dart';
import '../models/class_content.dart';
import '../screens/announcement_screen.dart';
import '../theme.dart';
import 'app_icon.dart';

/// What this subject's class rep has put up — the shelf, then the noticeboard.
///
/// Both are read-only on the phone. Posting lives on the web, where a rep is
/// likely to have the slides and scans to hand in the first place; a student
/// reading them is on a phone, which is why this is here at all.
///
/// One request loads the memberships and both lists, because the three are
/// useless apart: without knowing which room this student sits in there is
/// nothing to query for.
class SubjectClassContent extends StatefulWidget {
  const SubjectClassContent({
    super.key,
    required this.subjectCode,
    required this.facultyId,
  });

  final String subjectCode;
  final String facultyId;

  @override
  State<SubjectClassContent> createState() => _SubjectClassContentState();
}

class _ClassContent {
  const _ClassContent({required this.notes, required this.announcements});
  final List<ClassNote> notes;
  final List<AnnouncementSummary> announcements;
}

class _SubjectClassContentState extends State<SubjectClassContent> {
  late Future<_ClassContent?> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_ClassContent?> _load() async {
    final keys = await repository.classGroupKeys();
    final groupKey = Repository.matchGroupKey(keys, widget.subjectCode, widget.facultyId);
    // Null means this subject predates class groups, or the student has not
    // synced since. Showing an empty shelf would claim the rep posted nothing,
    // which is a different thing from "we cannot tell which room is yours".
    if (groupKey == null) return null;

    final results = await Future.wait([
      repository.classNotes(groupKey),
      repository.groupAnnouncements(groupKey),
    ]);

    return _ClassContent(
      notes: results[0] as List<ClassNote>,
      announcements: results[1] as List<AnnouncementSummary>,
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_ClassContent?>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const SizedBox.shrink();
        }
        final content = snapshot.data;
        if (content == null) return const SizedBox.shrink();
        if (content.notes.isEmpty && content.announcements.isEmpty) {
          return const SizedBox.shrink();
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (content.notes.isNotEmpty) ...[
              const SizedBox(height: 16),
              _SectionHeading(
                icon: HugeIcons.strokeRoundedBookOpen01,
                label: 'Notes & materials',
                count: content.notes.length,
              ),
              const SizedBox(height: 8),
              ...content.notes.map((note) => _NoteCard(note: note)),
            ],
            if (content.announcements.isNotEmpty) ...[
              const SizedBox(height: 16),
              _SectionHeading(
                icon: HugeIcons.strokeRoundedNote01,
                label: 'From your class rep',
                count: content.announcements.length,
              ),
              const SizedBox(height: 8),
              ...content.announcements
                  .take(5)
                  .map((item) => _AnnouncementRow(item: item)),
            ],
          ],
        );
      },
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({required this.icon, required this.label, required this.count});

  final List<List<dynamic>> icon;
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        AppIcon(icon, size: 15, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 8),
        Text(label, style: Theme.of(context).textTheme.labelSmall),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            '$count',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
        ),
      ],
    );
  }
}

class _NoteCard extends StatelessWidget {
  const _NoteCard({required this.note});

  final ClassNote note;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(note.title, style: const TextStyle(fontWeight: FontWeight.w700)),
              if (note.description.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(note.description, style: Theme.of(context).textTheme.bodySmall),
              ],
              if (note.media.isNotEmpty || note.links.isNotEmpty) ...[
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ...note.media.map((m) => _Chip(
                          icon: m.kind == 'video'
                              ? HugeIcons.strokeRoundedPlayCircle
                              : m.isImage
                                  ? HugeIcons.strokeRoundedImage01
                                  : HugeIcons.strokeRoundedFile01,
                          label: m.name,
                          trailing: m.readableSize,
                          url: m.url,
                        )),
                    ...note.links.map((l) => _Chip(
                          icon: HugeIcons.strokeRoundedGlobe02,
                          label: l.label.isEmpty ? l.url : l.label,
                          url: l.url,
                        )),
                  ],
                ),
              ],
              const SizedBox(height: 10),
              Text(
                '${note.authorName} · ${_relative(note.createdAt)}',
                style: TextStyle(fontSize: 11, color: Theme.of(context).textTheme.bodySmall?.color),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label, this.trailing, this.url});

  final List<List<dynamic>> icon;
  final String label;
  final String? trailing;
  final String? url;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final enabled = url != null;

    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: enabled ? () => _open(context, url!) : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          border: Border.all(color: scheme.outlineVariant),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppIcon(icon, size: 13, color: enabled ? scheme.primary : scheme.outline),
            const SizedBox(width: 7),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 150),
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
              ),
            ),
            if (trailing != null && trailing!.isNotEmpty) ...[
              const SizedBox(width: 6),
              Text(
                trailing!,
                style: TextStyle(fontSize: 11, color: Theme.of(context).textTheme.bodySmall?.color),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AnnouncementRow extends StatelessWidget {
  const _AnnouncementRow({required this.item});

  final AnnouncementSummary item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => AnnouncementScreen(announcementId: item.id),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                if (item.important) ...[
                  AppIcon(HugeIcons.strokeRoundedAlert02, size: 15, color: HandyColors.bad),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        [
                          _relative(item.createdAt),
                          if (item.attachmentCount > 0)
                            '${item.attachmentCount} attachment${item.attachmentCount == 1 ? '' : 's'}',
                        ].join(' · '),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                AppIcon(HugeIcons.strokeRoundedArrowRight01, size: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Opens in whatever app handles it, and says so plainly when it cannot —
/// with the address on the clipboard, so a dead handler is not a dead end.
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

String _relative(String iso) {
  final at = DateTime.tryParse(iso);
  if (at == null) return '';
  final days = DateTime.now().difference(at).inDays;
  if (days < 1) return 'today';
  if (days == 1) return 'yesterday';
  if (days < 7) return '$days days ago';
  return '${at.day}/${at.month}/${at.year}';
}
