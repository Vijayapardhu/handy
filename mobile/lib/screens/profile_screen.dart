import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../logic/attendance.dart';
import '../main.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/detail_row.dart';
import '../widgets/student_photo.dart';
import 'account_screens.dart';
import 'attendance_history_screen.dart';
import 'leave_planner_screen.dart';
import 'notifications_inbox_screen.dart';
import 'onboarding_screen.dart';
import 'settings_screen.dart';
import 'support_screens.dart';
import 'subjects_screen.dart';
import '../widgets/app_icon.dart';

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
      body: ListenableBuilder(
        listenable: settings,
        builder: (context, _) => CustomScrollView(
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
                    // Two decimals, matching the portal and every other
                    // percentage in the app. One decimal rounded 70.38 to
                    // 70.4, which reads as a different number from the one on
                    // the home screen and invites the question of which is
                    // right.
                    _Stat(
                      value: percent == null ? '—' : '${percent.toStringAsFixed(2)}%',
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

                const SizedBox(height: 26),
                const _Label('Account'),
                const SizedBox(height: 10),
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      _ActionRow(
                        icon: HugeIcons.strokeRoundedUser,
                        label: 'Personal Information',
                        detail: 'View and edit your details',
                        onTap: () => _push(context, const PersonalInformationScreen()),
                      ),
                      const _Rule(),
                      _ActionRow(
                        icon: HugeIcons.strokeRoundedMortarboard01,
                        label: 'Academic Information',
                        detail: 'Course, Year, Department',
                        onTap: () => _push(context, const AcademicInformationScreen()),
                      ),
                      const _Rule(),
                      _ActionRow(
                        icon: HugeIcons.strokeRoundedCalendar03,
                        label: 'Attendance History',
                        detail: 'Every class you have marked',
                        onTap: () => _push(context, const AttendanceHistoryScreen()),
                      ),
                      const _Rule(),
                      _ActionRow(
                        icon: HugeIcons.strokeRoundedCoffee02,
                        label: 'Leave Planner',
                        detail: 'What a day off would cost you',
                        onTap: () => _push(context, const LeavePlannerScreen()),
                      ),
                      const _Rule(),
                      _ActionRow(
                        icon: HugeIcons.strokeRoundedNotification01,
                        label: 'Notifications',
                        detail: state.unreadNotifications == 0
                            ? 'What Handy has told you, and what it may tell you'
                            : '${state.unreadNotifications} unread',
                        badge: state.unreadNotifications,
                        onTap: () => _push(context, const NotificationsInboxScreen()),
                      ),
                      const _Rule(),
                      _ActionRow(
                        icon: HugeIcons.strokeRoundedSquareLock01,
                        label: 'Change Password',
                        detail: 'Handy has no reset email — change it here',
                        onTap: () => _push(context, const ChangePasswordScreen()),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 22),
                const _Label('Preferences'),
                const SizedBox(height: 10),
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      // The switch is the control and the caption is the state,
                      // so a student can tell what "off" means here — with
                      // System selected it does not mean "light".
                      // Three states, not a switch.
                      //
                      // This was a Dark Mode toggle whose "off" meant System.
                      // On a phone already in dark mode that still renders
                      // dark, so turning it off changed nothing visible and
                      // the control looked broken — it could not reach Light
                      // at all. The setting has always had three values; the
                      // control now says so.
                      const _AppearancePicker(),
                      const _Rule(),
                      _ActionRow(
                        icon: HugeIcons.strokeRoundedSettings02,
                        label: 'All settings',
                        detail: 'Accent colour, theme, widgets',
                        onTap: () => _push(context, const SettingsScreen()),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 22),
                const _Label('Support & more'),
                const SizedBox(height: 10),
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      _ActionRow(
                        icon: HugeIcons.strokeRoundedPieChart,
                        label: 'How Handy works',
                        detail: 'The intro, including where the data comes from',
                        onTap: () => _push(context, const OnboardingScreen(asTour: true)),
                      ),
                      const _Rule(),
                      _ActionRow(
                        icon: HugeIcons.strokeRoundedHelpCircle,
                        label: 'Help & FAQ',
                        detail: 'Get help and find answers',
                        onTap: () => _push(context, const FaqScreen()),
                      ),
                      const _Rule(),
                      _ActionRow(
                        icon: HugeIcons.strokeRoundedMail01,
                        label: 'Feedback',
                        detail: 'Share your feedback with us',
                        onTap: () => _push(context, const FeedbackScreen()),
                      ),
                      const _Rule(),
                      _ActionRow(
                        icon: HugeIcons.strokeRoundedInformationCircle,
                        label: 'About Handy',
                        detail: 'Version $handyVersion',
                        onTap: () => _push(context, const AboutScreen()),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 22),
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: _ActionRow(
                    icon: HugeIcons.strokeRoundedLogout01,
                    label: 'Log Out',
                    colour: HandyColors.bad,
                    onTap: () => _confirmSignOut(context),
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

  static void _push(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
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
    this.badge = 0,
  });

  final AppIconData icon;
  final String label;
  final String? detail;
  final Color? colour;
  final VoidCallback onTap;

  /// A count worth interrupting for. Zero draws nothing.
  final int badge;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            AppIcon(icon, size: 19, color: colour),
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
            if (badge > 0) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  badge > 99 ? '99+' : '$badge',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: Theme.of(context).colorScheme.onPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 10),
            ],
            if (colour == null) AppIcon(HugeIcons.strokeRoundedArrowRight01, size: 20),
          ],
        ),
      ),
    );
  }
}

/// Three miniatures of the app, rather than three words.
///
/// A segmented button made the reader translate "Light" into what the screen
/// would look like. Showing it is both faster and honest about the one that is
/// hard to name: System has no single appearance, so it is drawn as both,
/// split down the middle.
class _AppearancePicker extends StatelessWidget {
  const _AppearancePicker();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AppIcon(HugeIcons.strokeRoundedMoon02, size: 19),
              const SizedBox(width: 14),
              Expanded(
                child: Text('Appearance',
                    style: Theme.of(context).textTheme.titleMedium),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              for (final mode in ThemeMode.values) ...[
                if (mode != ThemeMode.values.first) const SizedBox(width: 10),
                Expanded(
                  child: _ThemeSwatch(
                    mode: mode,
                    selected: settings.themeMode == mode,
                    onTap: () => settings.setThemeMode(mode),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _ThemeSwatch extends StatelessWidget {
  const _ThemeSwatch({
    required this.mode,
    required this.selected,
    required this.onTap,
  });

  final ThemeMode mode;
  final bool selected;
  final VoidCallback onTap;

  static const _darkBg = Color(0xFF0F172A);
  static const _darkCard = Color(0xFF1E293B);
  static const _lightBg = Color(0xFFF8FAFC);
  static const _lightCard = Color(0xFFFFFFFF);

  String get _label => switch (mode) {
        ThemeMode.system => 'System',
        ThemeMode.light => 'Light',
        ThemeMode.dark => 'Dark',
      };

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;

    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Column(
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            height: 74,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: selected ? accent : Theme.of(context).dividerColor,
                width: selected ? 2 : 1,
              ),
            ),
            // Clipped so the halves of the System swatch meet the rounded
            // corner cleanly instead of squaring it off.
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: switch (mode) {
                ThemeMode.light => _Mock(bg: _lightBg, card: _lightCard, accent: accent),
                ThemeMode.dark => _Mock(bg: _darkBg, card: _darkCard, accent: accent),
                // Both, because that is what "system" means — and a single
                // neutral square would say nothing at all.
                ThemeMode.system => Row(
                    children: [
                      Expanded(
                        child: _Mock(bg: _lightBg, card: _lightCard, accent: accent),
                      ),
                      Expanded(
                        child: _Mock(bg: _darkBg, card: _darkCard, accent: accent),
                      ),
                    ],
                  ),
              },
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (selected) ...[
                AppIcon(HugeIcons.strokeRoundedTick02, size: 13, color: accent),
                const SizedBox(width: 4),
              ],
              Flexible(
                child: Text(
                  _label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    color: selected ? accent : Theme.of(context).textTheme.bodySmall?.color,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// A tiny Handy: a heading, a card, and an accent bar. Enough shape to be
/// recognisable as this app rather than as a generic light/dark square.
class _Mock extends StatelessWidget {
  const _Mock({required this.bg, required this.card, required this.accent});

  final Color bg;
  final Color card;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final ink = bg.computeLuminance() > 0.5 ? Colors.black : Colors.white;

    return Container(
      color: bg,
      padding: const EdgeInsets.all(7),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 22,
            height: 4,
            decoration: BoxDecoration(
              color: ink.withValues(alpha: 0.55),
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          const SizedBox(height: 6),
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: card,
                borderRadius: BorderRadius.circular(5),
              ),
              padding: const EdgeInsets.all(5),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 26,
                    height: 6,
                    decoration: BoxDecoration(
                      color: accent,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    height: 3,
                    decoration: BoxDecoration(
                      color: ink.withValues(alpha: 0.22),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A hairline between rows in a grouped card.
class _Rule extends StatelessWidget {
  const _Rule();

  @override
  Widget build(BuildContext context) =>
      Divider(height: 1, color: Theme.of(context).dividerColor);
}

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;

  @override
  Widget build(BuildContext context) =>
      Text(text.toUpperCase(), style: Theme.of(context).textTheme.labelSmall);
}
