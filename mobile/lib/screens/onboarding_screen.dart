import 'package:flutter/material.dart';

import '../main.dart';
import '../widgets/app_icon.dart';
import 'sign_in_screen.dart';

/// What Handy is, before it asks anyone to sign in.
///
/// This exists mostly for one screen: the second. Handy is unusual in that the
/// phone is not where the data comes from — a browser extension on a laptop
/// reads Campus Connect, and until that has run once there is no account to
/// sign into at all. Without saying so, the first thing a new student meets is
/// a sign-in form rejecting their own roll number, which reads as "this app is
/// broken" rather than "there is a step before this one".
///
/// Four screens, skippable, shown once. It is also reachable afterwards from
/// Profile, because the person who needs the extension explanation most is
/// often the one who skipped past it.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, this.asTour = false});

  /// Opened from Profile rather than on first run: finishing goes back instead
  /// of forward to sign-in, and there is nothing to record.
  final bool asTour;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _Page {
  const _Page({
    required this.icon,
    required this.title,
    required this.body,
    this.footnote,
  });

  final List<List<dynamic>> icon;
  final String title;
  final String body;
  final String? footnote;
}

const _pages = <_Page>[
  _Page(
    icon: HugeIcons.strokeRoundedPieChart,
    title: 'Your attendance,\nactually answered',
    body:
        'Not just a percentage. How many classes you can still miss, and — if you '
        'have already slipped — how many you would have to attend in a row to get '
        'back above the line.',
  ),
  _Page(
    icon: HugeIcons.strokeRoundedGlobe02,
    title: 'The syncing happens\non a laptop',
    body:
        'Handy reads your attendance from Campus Connect through a browser '
        'extension you install once, on a computer. After that this app keeps '
        'itself current — you never open the portal again.',
    footnote:
        'Your Handy account is created by that first sync. If sign-in says it '
        'cannot find your roll number, the extension has not run yet.',
  ),
  _Page(
    icon: HugeIcons.strokeRoundedCalendar01,
    title: 'Plan around it',
    body:
        'Your timetable on the home screen, a reminder before each class, '
        'deadlines shown against the days they actually collide with, and notes '
        'your class rep posts for the subject.',
  ),
  _Page(
    icon: HugeIcons.strokeRoundedNote01,
    title: 'It never sees\nyour college password',
    body:
        'The extension reads pages after you have signed in yourself. Your '
        'attendance is never shown to another student — classmates see only that '
        'a shared timetable changed.',
  ),
];

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    if (!widget.asTour) await settings.setOnboarded(true);
    if (!mounted) return;

    if (widget.asTour) {
      Navigator.of(context).pop();
      return;
    }
    // Replaced rather than pushed: there is no back to an introduction.
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => const SignInScreen()),
    );
  }

  void _next() {
    if (_index >= _pages.length - 1) {
      _finish();
      return;
    }
    _controller.nextPage(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final last = _index == _pages.length - 1;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(0, 8, 8, 0),
                child: TextButton(
                  onPressed: _finish,
                  child: Text(widget.asTour ? 'Close' : 'Skip'),
                ),
              ),
            ),

            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _pages.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (context, i) => _PageView(page: _pages[i]),
              ),
            ),

            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(_pages.length, (i) {
                      final active = i == _index;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 220),
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        height: 6,
                        // The current page is a bar rather than a bigger dot:
                        // position in a sequence is length, not size.
                        width: active ? 22 : 6,
                        decoration: BoxDecoration(
                          color: active
                              ? scheme.primary
                              : scheme.onSurface.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _next,
                      child: Text(
                        last
                            ? (widget.asTour ? 'Done' : 'Get started')
                            : 'Next',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PageView extends StatelessWidget {
  const _PageView({required this.page});

  final _Page page;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 24),
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: scheme.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(24),
            ),
            child: Center(child: AppIcon(page.icon, size: 32, color: scheme.primary)),
          ),
          const SizedBox(height: 28),
          Text(
            page.title,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(height: 1.15),
          ),
          const SizedBox(height: 14),
          Text(
            page.body,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.55),
          ),
          if (page.footnote != null) ...[
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: scheme.primary.withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: scheme.primary.withValues(alpha: 0.25)),
              ),
              child: Text(
                page.footnote!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.5),
              ),
            ),
          ],
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
