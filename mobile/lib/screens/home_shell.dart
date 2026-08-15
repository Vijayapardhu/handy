import 'dart:async';
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:home_widget/home_widget.dart';

import '../data/app_state.dart';
import '../logic/deadlines.dart';
import '../main.dart';
import '../widgets/form_sheet.dart';
import '../widgets/update_sheet.dart';
import 'profile_screen.dart';
import 'subjects_screen.dart';
import 'deadlines_screen.dart';
import 'timetable_screen.dart';
import 'today_screen.dart';
import '../widgets/app_icon.dart';

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
  final _pages = PageController();

  static final _tabs = [
    (icon: HugeIcons.strokeRoundedCalendar03, active: HugeIcons.strokeRoundedCalendar03, label: 'Today'),
    (icon: HugeIcons.strokeRoundedPieChart, active: HugeIcons.strokeRoundedPieChart, label: 'Subjects'),
    (icon: HugeIcons.strokeRoundedCalendar01, active: HugeIcons.strokeRoundedCalendar01, label: 'Timetable'),
    (icon: HugeIcons.strokeRoundedTaskDone01, active: HugeIcons.strokeRoundedTaskDone01, label: 'Deadlines'),
    (icon: HugeIcons.strokeRoundedUser, active: HugeIcons.strokeRoundedUserCircle, label: 'You'),
  ];

  StreamSubscription<Uri?>? _widgetTaps;

  @override
  void initState() {
    super.initState();
    // One load for the whole shell: every tab reads the same snapshot, and
    // reminders are rescheduled from it once it arrives.
    appState.load();
    // Registered here rather than at startup: the token is stored against
    // the student's uid, so there is nowhere to put it until they sign in.
    push.register();

    // Handy is not on the Play Store, so nothing updates it on a student's
    // behalf. Checked after the first frame so a slow network cannot delay the
    // app opening, and never in a way that can throw — an update check is the
    // least important thing happening at launch.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final update = await updates.check();
      if (update == null || !mounted) return;
      showUpdateSheet(context, update);
    });

    // AEC/ACET students have no extension syncing for them on a laptop, so the
    // phone is the only thing that can refresh their attendance. Runs with the
    // credential held in the device keystore, silently: someone who opened
    // Handy to check a percentage did not ask to be told the network is slow.
    // A success reloads, because the numbers on screen just went stale.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!await portalAuth.hasSavedCredential) return;
      if (await portalAuth.resync() && mounted) appState.load();
    });

    // Taps on a widget arrive as a URI. Handled here rather than in main()
    // because acting on one means changing tab and pushing a sheet, and this
    // is the first place with a tab to change.
    _widgetTaps = HomeWidget.widgetClicked.listen(_handleWidgetTap);
    // The launch that *started* the app isn't in that stream — it happened
    // before anything was listening — so it's asked for separately.
    HomeWidget.initiallyLaunchedFromHomeWidget().then(_handleWidgetTap);
  }

  @override
  void dispose() {
    _widgetTaps?.cancel();
    _pages.dispose();
    super.dispose();
  }

  void _handleWidgetTap(Uri? uri) {
    if (uri == null || !mounted) return;
    if (uri.host != 'deadline' || uri.path != '/new') return;

    setState(() => _index = _HandyNavBar.tasksTab);
    _pages.jumpToPage(_HandyNavBar.tasksTab);

    // After the frame, so the Deadlines tab exists to host the sheet.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      showFormSheet<void>(
        context: context,
        builder: (_) => TaskForm(subjects: appState.subjects),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    // The scope itself lives above the Navigator (see main.dart), so pushed
    // routes can read app state too.
    return Scaffold(
      // A PageView rather than an IndexedStack: switching tabs used to be an
      // instant cut, which is the one transition that always feels abrupt
      // because nothing tells you which way you moved. Pages slide now, and
      // they can be swiped between, which is faster than aiming at the bar.
      // Each is kept alive so scroll position survives the trip.
      body: PageView(
        controller: _pages,
        onPageChanged: (i) => setState(() => _index = i),
        children: const [
          _KeepAlive(child: TodayScreen()),
          _KeepAlive(child: SubjectsScreen()),
          _KeepAlive(child: TimetableScreen()),
          _KeepAlive(child: DeadlinesScreen()),
          _KeepAlive(child: ProfileScreen()),
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
          // Neighbouring tabs slide; distant ones would tear through three
          // screens at speed, so they jump and let the bar's own indicator
          // carry the movement.
          if ((i - _index).abs() == 1) {
            _pages.animateToPage(
              i,
              duration: const Duration(milliseconds: 280),
              curve: Curves.easeOutCubic,
            );
          } else {
            _pages.jumpToPage(i);
          }
        },
      ),
    );
  }
}

/// Keeps a tab's state — and its scroll position — while another is on screen.
class _KeepAlive extends StatefulWidget {
  const _KeepAlive({required this.child});
  final Widget child;

  @override
  State<_KeepAlive> createState() => _KeepAliveState();
}

class _KeepAliveState extends State<_KeepAlive> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return widget.child;
  }
}

/// Minimal bottom nav: icons and a hairline that slides.
///
/// This carried a filled pill with a glow behind the selected icon, which is a
/// lot of furniture for a control that is only ever answering "which tab". At
/// the bottom of every screen it competed with the content above it. The
/// indicator is now a short rule along the top edge — enough to say where you
/// are and to move when you move, and nothing else. The labels are gone too:
/// five words across the bottom of every screen is a caption on icons that
/// already say what they are, and it is the same five words every time.
/// They survive as tooltips and as semantic labels, so a long-press still
/// names a tab and a screen reader still reads one.
///
/// It still travels rather than fading, and still stretches while travelling:
/// the leading edge leaves before the trailing edge catches up, so two tabs
/// apart stretches further than one and the motion carries the distance. That
/// part was never the problem; the pill was.
///
/// Deadlines carries a live count of what's overdue or due today, because a
/// nav bar that can tell you something is waiting is worth more than one that
/// only routes.
class _HandyNavBar extends StatefulWidget {
  const _HandyNavBar({required this.index, required this.tabs, required this.onSelect});

  final int index;
  final List<({AppIconData icon, AppIconData active, String label})> tabs;
  final ValueChanged<int> onSelect;

  /// Index of the Tasks tab, which is the only one that carries a badge.
  static const tasksTab = 3;

  /// Where the notifications inbox lives. Badged too, because an inbox you
  /// only find by going looking is one nobody looks in.
  static const youTab = 4;

  @override
  State<_HandyNavBar> createState() => _HandyNavBarState();
}

class _HandyNavBarState extends State<_HandyNavBar> with SingleTickerProviderStateMixin {
  static const _barHeight = 58.0;
  static const _markWidth = 26.0;
  static const _markHeight = 3.0;

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
                      final (left, width) = _mark(slot);
                      return Positioned(
                        left: left,
                        top: 0,
                        width: width,
                        height: _markHeight,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: scheme.primary,
                            borderRadius: BorderRadius.circular(999),
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
                          onPill: scheme.primary,
                          badge: switch (i) {
                            _HandyNavBar.tasksTab => pending,
                            _HandyNavBar.youTab => state.unreadNotifications,
                            _ => 0,
                          },
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

  /// Left edge and width of the indicator for the current frame.
  ///
  /// Each edge interpolates on its own curve, and which one leads depends on
  /// the direction of travel — the edge nearest the destination always goes
  /// first, or the pill would appear to walk backwards before setting off.
  (double, double) _mark(double slot) {
    final t = _travel.value;
    final fromCentre = slot * _from + slot / 2;
    final toCentre = slot * _to + slot / 2;
    const half = _markWidth / 2;

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

  final ({AppIconData icon, AppIconData active, String label}) tab;
  final bool selected;
  final VoidCallback onTap;
  final Color? muted;
  final Color onPill;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Tooltip(
      message: tab.label,
      child: Semantics(
        label: tab.label,
        selected: selected,
        button: true,
        child: InkResponse(
          onTap: onTap,
          radius: 42,
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
              // The icon is the whole tab now, so it grows a little and centres
              // in the bar rather than sitting above a caption.
              return Center(
                child: Transform.scale(
                  scale: 1 + 0.1 * t,
                  child: _iconWithBadge(
                    icon: AppIcon(
                      selected ? tab.active : tab.icon,
                      size: 25,
                      color: Color.lerp(muted, onPill, clamped),
                    ),
                    scheme: scheme,
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  /// The count sits on the icon rather than beside the label, so it survives
  /// the pill sliding underneath and reads at a glance without being counted.
  Widget _iconWithBadge({required Widget icon, required ColorScheme scheme}) {
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
