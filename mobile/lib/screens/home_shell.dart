import 'package:flutter/material.dart';

import '../data/app_state.dart';
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
  final _state = AppState();

  @override
  void initState() {
    super.initState();
    // One load for the whole shell: every tab reads the same snapshot, and
    // reminders are rescheduled from it once it arrives.
    _state.load();
  }

  @override
  void dispose() {
    _state.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppStateScope(
      state: _state,
      child: Scaffold(
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
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (i) => setState(() => _index = i),
          destinations: const [
            NavigationDestination(
                icon: Icon(Icons.today_outlined), selectedIcon: Icon(Icons.today), label: 'Today'),
            NavigationDestination(
                icon: Icon(Icons.donut_small_outlined),
                selectedIcon: Icon(Icons.donut_small),
                label: 'Subjects'),
            NavigationDestination(
                icon: Icon(Icons.calendar_month_outlined),
                selectedIcon: Icon(Icons.calendar_month),
                label: 'Timetable'),
            NavigationDestination(
                icon: Icon(Icons.checklist_outlined),
                selectedIcon: Icon(Icons.checklist),
                label: 'Tasks'),
            NavigationDestination(
                icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'You'),
          ],
        ),
      ),
    );
  }
}
