import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

/// The student's photo from the college portal, falling back to their initials.
///
/// The portal serves these at a predictable path keyed by roll number, so no
/// capture is needed — but only over **https**; the http form 404s. Cached, so
/// it isn't refetched on every rebuild, and the initials show while it loads
/// as well as when there is no photo at all.
class StudentPhoto extends StatelessWidget {
  const StudentPhoto({
    super.key,
    required this.rollNumber,
    required this.name,
    this.size = 58,
    this.circle = false,
    this.ring = false,
  });

  final String? rollNumber;
  final String? name;
  final double size;

  /// Fully round rather than a rounded square. Used where the photo is the
  /// subject of the card rather than a marker beside a name.
  final bool circle;

  /// An accent ring around the photo, which also stops it dissolving into a
  /// tinted card behind it.
  final bool ring;

  static String? urlFor(String? rollNumber) {
    if (rollNumber == null || rollNumber.isEmpty) return null;
    return 'https://info.aec.edu.in/aus/studentPhotos_Original/${rollNumber.toUpperCase()}.jpg';
  }

  @override
  Widget build(BuildContext context) {
    final url = urlFor(rollNumber);
    final radius = circle ? size / 2 : size * 0.32;

    final photo = ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        width: size,
        height: size,
        child: url == null
            ? _Initials(name: name, size: size)
            : CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                fadeInDuration: const Duration(milliseconds: 200),
                placeholder: (_, __) => _Initials(name: name, size: size),
                errorWidget: (_, __, ___) => _Initials(name: name, size: size),
              ),
      ),
    );

    if (!ring) return photo;

    final accent = Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        shape: circle ? BoxShape.circle : BoxShape.rectangle,
        borderRadius: circle ? null : BorderRadius.circular(radius + 3),
        border: Border.all(color: accent.withValues(alpha: 0.55), width: 2),
      ),
      child: photo,
    );
  }
}

class _Initials extends StatelessWidget {
  const _Initials({required this.name, required this.size});

  final String? name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;
    final parts = (name ?? '').trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    final initials = parts.isEmpty ? 'H' : parts.take(2).map((p) => p[0].toUpperCase()).join();

    return Container(
      color: accent.withValues(alpha: 0.15),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: TextStyle(
          fontSize: size * 0.34,
          fontWeight: FontWeight.w800,
          color: accent,
        ),
      ),
    );
  }
}
