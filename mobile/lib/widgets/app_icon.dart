import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';

export 'package:hugeicons/hugeicons.dart' show HugeIcons;

/// A Hugeicons glyph, drawn the way Material's `Icon` behaves.
///
/// Hugeicons are not `IconData` — each is a `List<List<dynamic>>` of SVG path
/// data rendered by `HugeIcon`, which means they cannot be dropped into the
/// places `Icon` goes and they do not inherit colour from an enclosing
/// `IconTheme`. Every call site would otherwise have to name a colour, and the
/// ones that forgot would come out black on a dark background.
///
/// So this exists: same call shape as `Icon`, same default behaviour. Colour
/// falls back to the ambient `IconTheme` exactly as Material's does, so
/// `IconButton`, `ListTile.leading` and friends keep tinting their icons
/// without being told to.
class AppIcon extends StatelessWidget {
  const AppIcon(this.icon, {super.key, this.size = 22, this.color});

  /// One of the `HugeIcons.strokeRounded*` constants.
  final List<List<dynamic>> icon;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final theme = IconTheme.of(context);
    return HugeIcon(
      icon: icon,
      size: size,
      color: color ?? theme.color ?? Theme.of(context).colorScheme.onSurface,
    );
  }
}

/// The type of a Hugeicons constant, so widgets can take one as a field.
///
/// Named rather than written out because `List<List<dynamic>>` in a parameter
/// list says nothing about what it holds.
typedef AppIconData = List<List<dynamic>>;
