import 'package:flutter/material.dart';

import '../theme.dart';

/// What CodeForge looks like while it is being fetched.
///
/// The rest of the app uses the grey [Shimmer] for this, and that is right for
/// the rest of the app: a subject list is data arriving, and grey placeholders
/// say so without making a performance of it. CodeForge is a different wait.
/// It is the one figure in Handy that comes from another college system
/// entirely, over a login the student had to set up themselves, and it takes
/// noticeably longer than anything else here — the server signs in to Maya and
/// walks every enrolled course before it can answer. A wait that long, for
/// something that separate, is worth acknowledging rather than disguising as an
/// ordinary one.
///
/// So the sweep runs hot instead of grey — a forge, which is what the thing is
/// called — and a caret blinks beside the status line so the card reads as
/// working rather than stuck. Everything else about it is ordinary skeleton
/// discipline: the placeholders are the exact shape of the real content, so
/// nothing moves when the figures land.
///
/// Honest about motion, too. A student who has asked their phone to stop
/// animating gets the same layout without the sweep or the blink — the wait is
/// still legible, it just does not move.
class ForgeShimmer extends StatefulWidget {
  const ForgeShimmer({super.key, required this.child});

  final Widget child;

  @override
  State<ForgeShimmer> createState() => _ForgeShimmerState();
}

class _ForgeShimmerState extends State<ForgeShimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    // Slower than the grey shimmer's 1400ms. This wait is longer, and a fast
    // sweep on a long wait reads as impatience.
    duration: const Duration(milliseconds: 1900),
  );

  @override
  void initState() {
    super.initState();
    _controller.repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final accent = Theme.of(context).colorScheme.primary;

    // Cool metal, then the heat passing through it. Kept low-saturation at the
    // base so the card does not glow orange for the whole wait — the accent
    // only ever appears in the moving band.
    final base = dark ? const Color(0xFF1A2233) : const Color(0xFFE7EBF1);
    final warm = Color.alphaBlend(accent.withValues(alpha: dark ? 0.55 : 0.38), base);

    if (MediaQuery.disableAnimationsOf(context)) {
      return _Tinted(colour: base, child: widget.child);
    }

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) => ShaderMask(
        blendMode: BlendMode.srcATop,
        shaderCallback: (bounds) => LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [base, base, warm, base, base],
          // A narrow band rather than a broad wash: the heat should look like
          // it is travelling through the metal, not like the metal changed
          // colour.
          stops: const [0.0, 0.34, 0.5, 0.66, 1.0],
          transform: _Sweep(_controller.value * 2 - 1),
        ).createShader(bounds),
        child: child,
      ),
      child: widget.child,
    );
  }
}

/// The still version, for a phone with animations turned off.
class _Tinted extends StatelessWidget {
  const _Tinted({required this.colour, required this.child});

  final Color colour;
  final Widget child;

  @override
  Widget build(BuildContext context) => ShaderMask(
        blendMode: BlendMode.srcATop,
        shaderCallback: (bounds) => LinearGradient(colors: [colour, colour]).createShader(bounds),
        child: child,
      );
}

class _Sweep extends GradientTransform {
  const _Sweep(this.slide);

  final double slide;

  @override
  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) =>
      Matrix4.translationValues(bounds.width * slide, 0, 0);
}

/// A block that blinks, the way a cursor waiting for output does.
///
/// Sits beside the status line so the wait has a heartbeat. Drawn rather than
/// typed: a "▌" depends on whichever font the platform substitutes, and a
/// missing glyph in a loading state is a tofu box on the one screen a student
/// is already staring at.
class ForgeCaret extends StatefulWidget {
  const ForgeCaret({super.key, this.height = 13});

  final double height;

  @override
  State<ForgeCaret> createState() => _ForgeCaretState();
}

class _ForgeCaretState extends State<ForgeCaret> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  );

  @override
  void initState() {
    super.initState();
    _controller.repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colour = Theme.of(context).colorScheme.primary;
    if (MediaQuery.disableAnimationsOf(context)) {
      return _caret(colour.withValues(alpha: 0.5));
    }
    return AnimatedBuilder(
      animation: _controller,
      // Squared off rather than a smooth fade: a cursor is on or off, and the
      // sharpness is what makes it read as a cursor.
      builder: (context, _) => _caret(colour.withValues(alpha: _controller.value < 0.5 ? 1 : 0.15)),
    );
  }

  Widget _caret(Color colour) => Container(
        width: 2.5,
        height: widget.height,
        decoration: BoxDecoration(color: colour, borderRadius: BorderRadius.circular(1)),
      );
}

/// The CodeForge card, in placeholder form.
///
/// Deliberately the same shape as the loaded card — label, big figure, bar,
/// footnote — because the point of a skeleton is that nothing moves when the
/// real thing arrives. The status line is the one part that is not a
/// placeholder: it says what is actually happening, since "signing in to Maya"
/// is a wait a student can understand and forgive, where an unexplained ten
/// seconds is one they conclude is broken.
class CodeForgeCardSkeleton extends StatelessWidget {
  const CodeForgeCardSkeleton({super.key, this.fill = false});

  /// Whether the caller has given this a height to fill.
  ///
  /// True on the Today screen, where the card is one face of a fixed-height
  /// pair and has to reach the bottom of it. False everywhere the card sizes
  /// itself — and it matters more than a flag usually does: the Spacer that
  /// pushes the bar down needs a bounded height, and inside a scrolling list
  /// there is none, so getting this wrong is a thrown exception rather than a
  /// cosmetic slip.
  final bool fill;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('CODEFORGE ATTENDANCE', style: Theme.of(context).textTheme.labelSmall),
            if (fill) const Spacer() else const SizedBox(height: 14),
            ForgeShimmer(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Where the percentage lands.
                  _Bone(width: 150, height: 44),
                  SizedBox(height: 18),
                  _Bone(width: double.infinity, height: 7, radius: 999),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                const ForgeCaret(),
                const SizedBox(width: 8),
                Text(
                  'Signing in to Maya…',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// The full-screen version, for the breakdown while it loads.
class CodeForgeScreenSkeleton extends StatelessWidget {
  const CodeForgeScreenSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const CodeForgeCardSkeleton(),
        const SizedBox(height: 14),
        // Two course rows, so the list below has somewhere to arrive into
        // rather than appearing under an otherwise empty screen.
        for (var i = 0; i < 2; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
                child: ForgeShimmer(
                  child: Row(
                    children: [
                      Expanded(child: _Bone(width: double.infinity, height: 13)),
                      const SizedBox(width: 24),
                      _Bone(width: 38, height: 13),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// One placeholder shape. Its colour comes from the shimmer above it, so this
/// only has to be opaque.
class _Bone extends StatelessWidget {
  const _Bone({required this.width, required this.height, this.radius = 8});

  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: HandyColors.lightMuted,
          borderRadius: BorderRadius.circular(radius),
        ),
      );
}
