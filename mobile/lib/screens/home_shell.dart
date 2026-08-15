import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/app_state.dart';
import '../logic/deadlines.dart';
import '../main.dart';
import 'profile_screen.dart';
import 'subjects_screen.dart';
import 'deadlines_screen.dart';
import 'timetable_screen.dart';
import 'today_screen.dart';

/// Bottom-nav shell, ordered by the questions a student actually asks:
/// what's happening now, where do I stand, what's on this week, what do I owe,
/// and who am I signed in as.
///
/// IndexedStack rather than swapping widgets, so scroll position and state
/// survive tab changes — switching away and back should feel like returning to
/// the same page, not reloading it.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  static const _tabs = [
    (icon: Icons.today_outlined, active: Icons.today, label: 'Today'),
    (icon: Icons.donut_small_outlined, active: Icons.donut_small, label: 'Subjects'),
    (icon: Icons.calendar_month_outlined, active: Icons.calendar_month, label: 'Timetable'),
    (icon: Icons.checklist_outlined, active: Icons.checklist, label: 'Deadlines'),
    (icon: Icons.person_outline, active: Icons.person, label: 'You'),
  ];

  @override
  void initState() {
    super.initState();
    // One load for the whole shell: every tab reads the same snapshot, and
    // reminders are rescheduled from it once it arrives.
    appState.load();
    // Registered here rather than at startup: the token is stored against
    // the student's uid, so there is nowhere to put it until they sign in.
    push.register();
  }

  @override
  Widget build(BuildContext context) {
    // The scope itself lives above the Navigator (see main.dart), so pushed
    // routes can read app state too.
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: const [
          TodayScreen(),
          SubjectsScreen(),
          TimetableScreen(),
          DeadlinesScreen(),
          ProfileScreen(),
        ],
      ),
      bottomNavigationBar: _HandyNavBar(
        index: _index,
        tabs: _tabs,
        onSelect: (i) {
          if (i == _index) return;
          // The bar is the one control a student hits dozens of times a day;
          // a tick under the thumb is what makes it feel like a device rather
          // than a page.
          HapticFeedback.selectionClick();
          setState(() => _index = i);
        },
      ),
    );
  }
}

/// Custom bar rather than Material's NavigationBar, with a snake indicator.
///
/// The default indicator fades in on the tab you land on, which tells you
/// nothing about where you came from. Here a single pill *travels*, and it
/// travels like a snake: the leading edge leaves first and the trailing edge
/// catches up, so the pill stretches across the gap in flight and contracts
/// when it lands. Two tabs apart stretches further than one, which is the
/// whole point — the motion carries both the direction and the distance.
///
/// Built here rather than pulled in: flutter_snake_navigationbar, the package
/// this is modelled on, was last published in 2021 and pins
/// `sdk: ">=2.12.0 <3.0.0"`, so it cannot resolve against Dart 3.
///
/// Tasks also carries a live count of what's overdue or due today, because a
/// nav bar that can tell you there's something waiting is worth more than one
/// that only routes.
class _HandyNavBar extends StatefulWidget {
  const _HandyNavBar({required this.index, required this.tabs, required this.onSelect});

  final int index;
  final List<({IconData icon, IconData active, String label})> tabs;
  final ValueChanged<int> onSelect;

  /// Index of the Tasks tab, which is the only one that carries a badge.
  static const tasksTab = 3;

  @override
  State<_HandyNavBar> createState() => _HandyNavBarState();
}

class _HandyNavBarState extends State<_HandyNavBar> with SingleTickerProviderStateMixin {
  static const _barHeight = 76.0;
  static const _pillWidth = 58.0;
  static const _pillHeight = 36.0;

  late final AnimationController _travel = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 430),
  );

  /// Where the pill is coming from and going to. Equal when it's at rest.
  late int _from = widget.index;
  late int _to = widget.index;

  /// The two edges move on different schedules — that gap *is* the stretch.
  static const _lead = Interval(0, 0.72, curve: Curves.easeOutCubic);
  static const _tail = Interval(0.26, 1, curve: Curves.easeInOutCubic);

  @override
  void didUpdateWidget(covariant _HandyNavBar old) {
    super.didUpdateWidget(old);
    if (old.index != widget.index) {
      _from = old.index;
      _to = widget.index;
      _travel.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _travel.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final muted = Theme.of(context).textTheme.bodySmall?.color;
    final state = AppStateScope.of(context);

    final now = DateTime.now();
    final pending = state.tasks
        .where((t) => !t.done)
        .where((t) {
          final u = getDeadline(t.dueDate, now).urgency;
          return u == Urgency.overdue || u == Urgency.today;
        })
        .length;

    return Container(
      decoration: BoxDecoration(
        color: scheme.surface,
        border: Border(top: BorderSide(color: Theme.of(context).dividerColor)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: _barHeight,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final slot = constraints.maxWidth / widget.tabs.length;

              return Stack(
                children: [
                  AnimatedBuilder(
                    animation: _travel,
                    builder: (context, _) {
                      final (left, width) = _pill(slot);
                      return Positioned(
                        left: left,
                        top: 8,
                        width: width,
                        height: _pillHeight,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: scheme.primary,
                            borderRadius: BorderRadius.circular(999),
                            boxShadow: [
                              BoxShadow(
                                color: scheme.primary.withValues(alpha: 0.35),
                                blurRadius: 14,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                  Row(
                    children: List.generate(widget.tabs.length, (i) {
                      return Expanded(
                        child: _NavTab(
                          tab: widget.tabs[i],
                          selected: i == widget.index,
                          onTap: () => widget.onSelect(i),
                          muted: muted,
                          onPill: scheme.onPrimary,
                          badge: i == _HandyNavBar.tasksTab ? pending : 0,
                        ),
                      );
                    }),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  /// Left edge and width of the pill for the current frame.
  ///
  /// Each edge interpolates on its own curve, and which one leads depends on
  /// the direction of travel — the edge nearest the destination always goes
  /// first, or the pill would appear to walk backwards before setting off.
  (double, double) _pill(double slot) {
    final t = _travel.value;
    final fromCentre = slot * _from + slot / 2;
    final toCentre = slot * _to + slot / 2;
    const half = _pillWidth / 2;

    final lead = _lead.transform(t);
    final tail = _tail.transform(t);
    final forward = _to >= _from;

    final left = lerpDouble(fromCentre - half, toCentre - half, forward ? tail : lead)!;
    final right = lerpDouble(fromCentre + half, toCentre + half, forward ? lead : tail)!;
    return (left, right - left);
  }
}

class _NavTab extends StatelessWidget {
  const _NavTab({
    required this.tab,
    required this.selected,
    required this.onTap,
    required this.muted,
    required this.onPill,
    required this.badge,
  });

  final ({IconData icon, IconData active, String label}) tab;
  final bool selected;
  final VoidCallback onTap;
  final Color? muted;
  final Color onPill;
  final int badge;

  /// Vertical band the pill occupies, so the icon can be centred inside it.
  /// Matches _HandyNavBarState's pill top (8) + height (36).
  static const pillBand = 44.0;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return InkResponse(
      onTap: onTap,
      radius: 46,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: selected ? 1 : 0),
        // easeOutBack overshoots past 1, which is where the settle comes
        // from. Colours clamp it; only the scale gets to overshoot.
        duration: const Duration(milliseconds: 340),
        curve: Curves.easeOutBack,
        builder: (context, t, _) {
          final clamped = t.clamp(0.0, 1.0);
          // Laid out from the top so the icon sits centred on the pill, which
          // is positioned from the top too — centring both independently
          // leaves the icon riding a few pixels low.
          return Column(
            mainAxisAlignment: MainAxisAlignment.start,
            children: [
              SizedBox(
                height: _NavTab.pillBand,
                child: Center(
                  child: Transform.scale(
                    scale: 1 + 0.12 * t,
                    child: _iconWithBadge(
                      icon: Icon(
                        selected ? tab.active : tab.icon,
                        size: 23,
                        color: Color.lerp(muted, onPill, clamped),
                      ),
                      scheme: scheme,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                tab.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.lerp(FontWeight.w500, FontWeight.w700, clamped),
                  color: Color.lerp(muted, scheme.primary, clamped),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  /// The count sits on the icon rather than beside the label, so it survives
  /// the pill sliding underneath and reads at a glance without being counted.
  Widget _iconWithBadge({required Icon icon, required ColorScheme scheme}) {
    if (badge == 0) return icon;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        icon,
        Positioned(
          right: -6,
          top: -4,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            constraints: const BoxConstraints(minWidth: 16),
            decoration: BoxDecoration(
              color: scheme.error,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: scheme.surface, width: 1.5),
            ),
            child: Text(
              badge > 9 ? '9+' : '$badge',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 9,
                height: 1.25,
                fontWeight: FontWeight.w800,
                color: scheme.onError,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
