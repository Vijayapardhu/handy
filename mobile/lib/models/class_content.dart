/// What a class rep puts in front of their class.
///
/// Two shapes, and the difference between them is the whole design. An
/// announcement is a moment — it pushes to every phone and is read once. A note
/// is a shelf: silent, kept, and what a student comes back to in week nine
/// looking for the slide deck. See api/notes.js.
///
/// Both are read-only here. Posting lives on the web, where a rep is likely to
/// have the files to hand in the first place.
library;

/// A file uploaded with a note or an announcement.
class Attachment {
  const Attachment({
    required this.key,
    required this.kind,
    required this.name,
    required this.size,
    required this.url,
  });

  /// The R2 object key — the durable identifier, unlike the URL.
  final String key;

  /// `image`, `video` or `file`. Decided by the server from the extension, so
  /// a poster cannot label an arbitrary file as an image and have it rendered.
  final String kind;
  final String name;
  final int size;

  /// Computed server-side from the key. Null only if storage was misconfigured
  /// when this was posted.
  final String? url;

  bool get isImage => kind == 'image' && url != null;

  factory Attachment.fromMap(Map<String, dynamic> d) => Attachment(
        key: d['key'] as String? ?? '',
        kind: d['kind'] as String? ?? 'file',
        name: d['name'] as String? ?? 'Attachment',
        size: (d['size'] as num?)?.toInt() ?? 0,
        url: d['url'] as String?,
      );

  String get readableSize {
    if (size <= 0) return '';
    if (size < 1024 * 1024) return '${(size / 1024).round()} KB';
    return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

class LinkRef {
  const LinkRef({required this.url, required this.label});

  final String url;
  final String label;

  factory LinkRef.fromMap(Map<String, dynamic> d) => LinkRef(
        url: d['url'] as String? ?? '',
        label: d['label'] as String? ?? '',
      );
}

List<Attachment> _attachments(dynamic raw) => (raw as List<dynamic>? ?? [])
    .map((m) => Attachment.fromMap(Map<String, dynamic>.from(m as Map)))
    .toList();

List<LinkRef> _links(dynamic raw) => (raw as List<dynamic>? ?? [])
    .map((l) => LinkRef.fromMap(Map<String, dynamic>.from(l as Map)))
    .toList();

/// Course material filed under a subject. Silent by design — no notification
/// was ever sent for this, which is why it has to be findable by subject.
class ClassNote {
  const ClassNote({
    required this.id,
    required this.groupKey,
    required this.title,
    required this.description,
    required this.authorName,
    required this.createdAt,
    required this.media,
    required this.links,
  });

  final String id;
  final String groupKey;
  final String title;
  final String description;
  final String authorName;
  final String createdAt;
  final List<Attachment> media;
  final List<LinkRef> links;

  factory ClassNote.fromMap(String id, Map<String, dynamic> d) => ClassNote(
        id: id,
        groupKey: d['groupKey'] as String? ?? '',
        title: d['title'] as String? ?? '',
        description: d['description'] as String? ?? '',
        authorName: d['authorName'] as String? ?? 'Class rep',
        createdAt: d['createdAt'] as String? ?? '',
        media: _attachments(d['media']),
        links: _links(d['links']),
      );
}

/// Enough of an announcement to list it. The full thing is loaded by
/// AnnouncementScreen when one is opened.
class AnnouncementSummary {
  const AnnouncementSummary({
    required this.id,
    required this.title,
    required this.important,
    required this.createdAt,
    required this.attachmentCount,
  });

  final String id;
  final String title;
  final bool important;
  final String createdAt;
  final int attachmentCount;

  factory AnnouncementSummary.fromMap(String id, Map<String, dynamic> d) => AnnouncementSummary(
        id: id,
        title: d['title'] as String? ?? '',
        important: d['important'] as bool? ?? false,
        createdAt: d['createdAt'] as String? ?? '',
        attachmentCount: (d['media'] as List<dynamic>? ?? []).length,
      );
}
