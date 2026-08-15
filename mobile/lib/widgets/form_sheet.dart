import 'package:flutter/material.dart';

/// A bottom sheet you can actually type in.
///
/// The obvious spelling of this — `showModalBottomSheet` with
/// `EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom)` — reads
/// the *calling* screen's context, which the sheet route does not depend on.
/// The sheet is built once, before the keyboard exists, and never rebuilt when
/// it appears: the form sits under the keyboard with its submit button
/// unreachable, and the only way out is to dismiss the keyboard first.
///
/// Two things fix it, and both are needed. The inset has to come from the
/// sheet's own context so the sheet rebuilds when the keyboard opens, and the
/// content has to scroll, because on a short screen the form is taller than
/// what's left above the keyboard however it's padded.
Future<T?> showFormSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (sheetContext) {
      // Deliberately sheetContext, not the captured outer one.
      final insets = MediaQuery.viewInsetsOf(sheetContext).bottom;
      return AnimatedPadding(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOut,
        padding: EdgeInsets.only(bottom: insets),
        child: SingleChildScrollView(
          // Keeps the field you're typing in above the keyboard as the form
          // grows, rather than pinning the top and letting the bottom vanish.
          reverse: true,
          child: builder(sheetContext),
        ),
      );
    },
  );
}
