import 'package:flutter/material.dart';

/// Shimmering placeholders instead of a spinner.
///
/// A spinner says "wait" and nothing else. A skeleton in the shape of the
/// content says what is coming, keeps the layout from jumping when it lands,
/// and makes the wait feel shorter because the screen already looks like
/// itself.
///
/// Hand-rolled rather than pulling in a shimmer package: it's one animated
/// gradient, and a dependency for that would be more code to keep than this.
class Shimmer extends StatefulWidget {
  const Shimmer({super.key, required this.child});

  final Widget child;

  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final base = dark ? const Color(0xFF1A2233) : const Color(0xFFE7EBF1);
    final highlight = dark ? const Color(0xFF243044) : const Color(0xFFF3F6FA);

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) => ShaderMask(
        blendMode: BlendMode.srcATop,
        shaderCallback: (bounds) => LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [base, highlight, base],
          stops: const [0.1, 0.5, 0.9],
          // Sweeps well past both edges so the highlight enters and leaves
          // rather than appearing mid-widget.
          transform: _SlideGradient(_controller.value * 2 - 1),
        ).createShader(bounds),
        child: child,
      ),
      child: widget.child,
    );
  }
}

class _SlideGradient extends GradientTransform {
  const _SlideGradient(this.slide);
  final double slide;

  @override
  Matrix4 transform(Rect bounds, {TextDirection? textDirection}) =>
      Matrix4.translationValues(bounds.width * slide, 0, 0);
}

/// One grey block. Colour comes from the Shimmer above it, so this only needs
/// to describe the shape.
class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height = 14,
    this.radius = 8,
  });

  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

/// Placeholder shaped like a class row or a subject row — the two list shapes
/// the app repeats.
class SkeletonCard extends StatelessWidget {
  const SkeletonCard({super.key, this.height = 92});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SkeletonBox(width: 44, height: 34, radius: 8),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SkeletonBox(width: 150, height: 13),
                const SizedBox(height: 8),
                SkeletonBox(width: MediaQuery.of(context).size.width * 0.4, height: 10),
                const SizedBox(height: 8),
                const SkeletonBox(width: 90, height: 10),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The Today screen while it loads: hero, next class, then a few rows — the
/// same rhythm the real screen has.
class TodaySkeleton extends StatelessWidget {
  const TodaySkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final surface = Theme.of(context).colorScheme.surface;
    final border = Theme.of(context).dividerColor;

    return Shimmer(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          const SkeletonBox(width: 120, height: 11),
          const SizedBox(height: 10),
          const SkeletonBox(width: 220, height: 28, radius: 10),
          const SizedBox(height: 22),
          Container(
            height: 168,
            decoration: BoxDecoration(
              color: surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: border),
            ),
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SkeletonBox(width: 130, height: 10),
                const SizedBox(height: 16),
                const SkeletonBox(width: 190, height: 46, radius: 10),
                const SizedBox(height: 18),
                const SkeletonBox(height: 7, radius: 4),
                const SizedBox(height: 14),
                const SkeletonBox(width: 210, height: 11),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const SkeletonCard(height: 104),
          const SizedBox(height: 20),
          const SkeletonBox(width: 80, height: 10),
          const SizedBox(height: 10),
          const SkeletonCard(),
          const SizedBox(height: 10),
          const SkeletonCard(),
        ],
      ),
    );
  }
}

/// A plain list of placeholder rows, for Subjects, Timetable and Tasks.
class ListSkeleton extends StatelessWidget {
  const ListSkeleton({super.key, this.rows = 5, this.height = 92});

  final int rows;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        itemCount: rows,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, __) => SkeletonCard(height: height),
      ),
    );
  }
}
