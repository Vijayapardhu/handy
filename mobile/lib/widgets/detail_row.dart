import 'package:flutter/material.dart';

/// One label/value line in a details card.
///
/// A fixed label column, so every value in a card starts at the same x. These
/// were right-aligned once, which is fine until a value wraps: a two-line
/// right-aligned block has a ragged *left* edge, and between single-line rows
/// it reads as broken rather than as one value on two lines. Faculty names and
/// building names both wrap here routinely, so that is the common case.
///
/// Shared between the class sheet and the subject page so the two describe the
/// same subject in the same shape.
class DetailRow extends StatelessWidget {
  const DetailRow({super.key, required this.label, required this.value, this.last = false});

  final String label;
  final String? value;

  /// Suppresses the divider — the card's own edge is the last boundary.
  final bool last;

  @override
  Widget build(BuildContext context) {
    // Rows with nothing to show are dropped rather than printed as "—": an
    // empty field is noise in a list this dense.
    if (value == null || value!.isEmpty) return const SizedBox.shrink();

    // Scales with the reader's text size so long labels aren't clipped when
    // the system font is turned up.
    final labelWidth = (118 * MediaQuery.textScalerOf(context).scale(1)).clamp(118.0, 200.0);

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 13),
      decoration: last
          ? null
          : BoxDecoration(
              border: Border(bottom: BorderSide(color: Theme.of(context).dividerColor)),
            ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: labelWidth,
            child: Text(label, style: Theme.of(context).textTheme.bodySmall),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              value!,
              // Wrapped values need the extra leading — two lines set solid
              // look like two separate rows.
              style: Theme.of(context).textTheme.titleMedium?.copyWith(height: 1.3),
            ),
          ),
        ],
      ),
    );
  }
}
