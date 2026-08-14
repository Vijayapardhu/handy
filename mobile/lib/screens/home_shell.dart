import 'package:flutter/material.dart';

import '../main.dart';
import 'profile_screen.dart';
import 'subjects_screen.dart';
import 'tasks_screen.dart';
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
    (icon: Icons.checklist_outlined, active: Icons.checklist, label: 'Tasks'),
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
          TasksScreen(),
          ProfileScreen(),
        ],
      ),
      bottomNavigationBar: _HandyNavBar(
        index: _index,
        tabs: _tabs,
        onSelect: (i) => setState(() => _index = i),
      ),
    );
  }
}

/// Custom bar rather than NavigationBar: the selected tab gets a filled pill
/// that animates, and unselected tabs stay quiet. Material's default indicator
/// is a flat lozenge that reads the same whether you're on the tab or not.
class _HandyNavBar extends StatelessWidget {
  const _HandyNavBar({required this.index, required this.tabs, required this.onSelect});

  final int index;
  final List<({IconData icon, IconData active, String label})> tabs;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final muted = Theme.of(context).textTheme.bodySmall?.color;

    return Container(
      decoration: BoxDecoration(
        color: scheme.surface,
        border: Border(top: BorderSide(color: Theme.of(context).dividerColor)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 62,
          child: Row(
            children: List.generate(tabs.length, (i) {
              final tab = tabs[i];
              final selected = i == index;

              return Expanded(
                child: InkResponse(
                  onTap: () => onSelect(i),
                  radius: 42,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 220),
                        curve: Curves.easeOutCubic,
                        padding: EdgeInsets.symmetric(
                          horizontal: selected ? 18 : 12,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: selected
                              ? scheme.primary.withValues(alpha: 0.16)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Icon(
                          selected ? tab.active : tab.icon,
                          size: 22,
                          color: selected ? scheme.primary : muted,
                        ),
                      ),
                      const SizedBox(height: 3),
                      AnimatedDefaultTextStyle(
                        duration: const Duration(milliseconds: 220),
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                          color: selected ? scheme.primary : muted,
                        ),
                        child: Text(tab.label),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}
