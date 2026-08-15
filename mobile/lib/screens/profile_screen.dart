import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../logic/attendance.dart';
import '../main.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/detail_row.dart';
import '../widgets/student_photo.dart';
import 'settings_screen.dart';
import 'subjects_screen.dart';

/// Identity and account.
///
/// Almost nothing here is editable — it is the college's record of a student,
/// not a profile they filled in — so the page is built to be *read*: who you
/// are at the top, where the semester stands underneath, then the record
/// itself, then the few controls that do exist. The one thing they own is the
/// name they'd rather be called, and that lives in Settings next to the other
/// preferences rather than pretending this page is a form.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final student = state.student;

    final attended = state.summaries.fold<int>(0, (sum, s) => sum + s.attended);
    final held = state.summaries.fold<int>(0, (sum, s) => sum + s.held);
    final percent = roundPercentage(calculateAttendance(attended, held));
    final weekly = state.entries.where((e) => e.active).length;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar.large(title: const Text('Profile'), expandedHeight: 120),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 36),
            sliver: SliverList.list(
              children: [
                _IdentityCard(student: student),
                const SizedBox(height: 12),

                // The semester in three numbers. This is the only place in the
                // app that totals attendance across every subject, and it is
                // the number a student quotes when someone asks how they're
                // doing.
                Row(
                  children: [
                    _Stat(
                      value: percent == null ? '—' : '${percent.toStringAsFixed(1)}%',
                      label: 'Attendance',
                      colour: statusColour(percent),
                    ),
                    const SizedBox(width: 10),
                    _Stat(value: '${state.subjects.length}', label: 'Subjects'),
                    const SizedBox(width: 10),
                    _Stat(value: '$weekly', label: 'Periods a week'),
                  ],
                ),

                const SizedBox(height: 22),
                const _Label('Academic record'),
                const SizedBox(height: 10),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    child: Column(
                      children: [
                        DetailRow(label: 'Course', value: student?.course),
                        DetailRow(label: 'Branch', value: student?.department),
                        DetailRow(
                          label: 'Year',
                          value: student?.year == null ? null : 'Year ${student!.year}',
                        ),
                        DetailRow(label: 'Section', value: student?.section),
                        DetailRow(
                          label: 'Classes held',
                          value: held == 0 ? null : '$attended of $held attended',
                        ),
                        DetailRow(
                          label: 'Below ${SubjectsScreen.target.toInt()}%',
                          value: _atRisk(state),
                          last: true,
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 22),
                const _Label('Where this comes from'),
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
                            Expanded(
                              child: Text(
                                'Campus Connect',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Your attendance and timetable are captured from the college '
                          'portal by the Handy extension on your laptop. Nothing here is '
                          'typed in by hand, and nothing you do in this app changes the '
                          'college record. Open your profile on the portal to refresh it.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 22),
                // One card, two rows: these are the only controls on the page,
                // and separate cards made two buttons look like two sections.
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      _ActionRow(
                        icon: Icons.tune,
                        label: 'Settings',
                        detail: 'Theme, accent, name, widgets, password',
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(builder: (_) => const SettingsScreen()),
                        ),
                      ),
                      Divider(height: 1, color: Theme.of(context).dividerColor),
                      _ActionRow(
                        icon: Icons.logout,
                        label: 'Sign out',
                        colour: HandyColors.bad,
                        onTap: () => _confirmSignOut(context),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),
                Center(
                  child: Text(
                    // No password here: it may have been changed in Settings,
                    // and printing a stale one is worse than printing none.
                    'Signed in as ${student?.rollNumber ?? ''}',
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

  /// How many subjects are below target, phrased as a fact rather than a count
  /// when there are none — "0" reads as missing data.
  static String _atRisk(AppState state) {
    final summaryBySubject = {for (final s in state.summaries) s.subjectId: s};
    final below = state.subjects.where((subject) {
      final summary = summaryBySubject[subject.id];
      final percent = roundPercentage(
        calculateAttendance(summary?.attended ?? 0, summary?.held ?? 0),
      );
      return percent != null && percent < SubjectsScreen.target;
    }).length;

    if (below == 0) return 'None';
    return '$below subject${below == 1 ? '' : 's'}';
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

/// Photo, name, roll number. Tinted with the accent so the page opens with
/// something that belongs to this student rather than another grey card.
class _IdentityCard extends StatelessWidget {
  const _IdentityCard({required this.student});
  final Student? student;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final official = student?.name.isNotEmpty == true ? student!.name : 'Student';
    final preferred = settings.preferredName;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: scheme.primary.withValues(alpha: 0.35)),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            scheme.primary.withValues(alpha: 0.18),
            scheme.primary.withValues(alpha: 0.04),
          ],
        ),
      ),
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          StudentPhoto(
            rollNumber: student?.rollNumber,
            name: student?.name,
            size: 84,
            circle: true,
            ring: true,
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  preferred.isNotEmpty ? preferred : official,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 3),
                Text(
                  student?.rollNumber ?? '',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                    color: scheme.primary,
                  ),
                ),
                // The college's spelling still shows when it differs from the
                // chosen name — this page is the official record, and hiding
                // it would make the two disagree with no way to tell.
                if (preferred.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(official, style: Theme.of(context).textTheme.bodySmall),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label, this.colour});

  final String value;
  final String label;
  final Color? colour;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Theme.of(context).dividerColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                value,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.8,
                  height: 1,
                  color: colour,
                ),
              ),
            ),
            const SizedBox(height: 5),
            Text(
              label,
              maxLines: 2,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.detail,
    this.colour,
  });

  final IconData icon;
  final String label;
  final String? detail;
  final Color? colour;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            Icon(icon, size: 19, color: colour),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(fontWeight: FontWeight.w600, color: colour),
                  ),
                  if (detail != null) ...[
                    const SizedBox(height: 2),
                    Text(detail!, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ],
              ),
            ),
            if (colour == null) const Icon(Icons.chevron_right, size: 20),
          ],
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;

  @override
  Widget build(BuildContext context) =>
      Text(text.toUpperCase(), style: Theme.of(context).textTheme.labelSmall);
}
