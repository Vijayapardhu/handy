import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../data/repository.dart';
import '../main.dart';
import '../theme.dart';

/// Identity and account. Deliberately short: everything here comes from the
/// college's own record, so there is almost nothing for a student to change.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final student = state.student;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar.large(title: const Text('Profile'), expandedHeight: 120),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
            sliver: SliverList.list(
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Row(
                      children: [
                        Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            color: HandyColors.orange.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(18),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            _initials(student?.name),
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: HandyColors.orange,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                student?.name.isNotEmpty == true ? student!.name : 'Student',
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                              const SizedBox(height: 2),
                              Text(student?.rollNumber ?? '',
                                  style: Theme.of(context).textTheme.bodySmall),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Text('ACADEMIC', style: Theme.of(context).textTheme.labelSmall),
                const SizedBox(height: 10),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    child: Column(
                      children: [
                        _Row(label: 'Course', value: student?.course),
                        _Row(label: 'Branch', value: student?.department),
                        _Row(label: 'Year', value: student?.year == null ? null : 'Year ${student!.year}'),
                        _Row(label: 'Section', value: student?.section),
                        _Row(label: 'Subjects', value: '${state.subjects.length}'),
                        _Row(
                          label: 'Classes a week',
                          value: '${state.entries.where((e) => e.active).length}',
                          last: true,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Text('DATA', style: Theme.of(context).textTheme.labelSmall),
                const SizedBox(height: 10),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.sync, size: 18, color: HandyColors.orange),
                            const SizedBox(width: 10),
                            Text('Synced from Campus Connect',
                                style: Theme.of(context).textTheme.titleMedium),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Attendance and your timetable come from the college portal, captured by '
                          'the Handy College Sync extension on your laptop. Open your profile there '
                          'to refresh them.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Card(
                  child: InkWell(
                    borderRadius: BorderRadius.circular(20),
                    onTap: () => _confirmSignOut(context),
                    child: const Padding(
                      padding: EdgeInsets.all(18),
                      child: Row(
                        children: [
                          Icon(Icons.logout, size: 19, color: HandyColors.bad),
                          SizedBox(width: 12),
                          Text('Sign out',
                              style: TextStyle(
                                  fontWeight: FontWeight.w600, color: HandyColors.bad)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Center(
                  child: Text(
                    'Signed in with ${student?.rollNumber ?? ''} · password ${Repository.defaultPassword}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _initials(String? name) {
    final parts = (name ?? '').trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return 'H';
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }

  void _confirmSignOut(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text('Your data stays synced — you can sign back in with your roll number.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: HandyColors.bad,
              minimumSize: const Size(100, 44),
            ),
            onPressed: () {
              Navigator.of(dialogContext).pop();
              repository.signOut();
            },
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.last = false});

  final String label;
  final String? value;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final shown = (value == null || value!.isEmpty) ? '—' : value!;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 15),
      decoration: last
          ? null
          : BoxDecoration(
              border: Border(bottom: BorderSide(color: Theme.of(context).dividerColor)),
            ),
      child: Row(
        children: [
          Expanded(child: Text(label, style: Theme.of(context).textTheme.bodySmall)),
          Text(shown, style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}
