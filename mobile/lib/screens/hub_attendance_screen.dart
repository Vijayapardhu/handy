import 'package:flutter/material.dart';

import '../data/hub.dart';
import '../logic/hub_status.dart';
import '../models/hub_attendance.dart';
import '../theme.dart';
import '../widgets/app_icon.dart';
import '../widgets/code_forge_loading.dart';

/// CodeForge and skills-hour attendance, read from Maya.
///
/// A port of the web's HubAttendancePage and HubPortalCard, joined into one
/// screen. The web splits them because it has room to: connecting lives on
/// Profile and the breakdown at /hub-attendance. On a phone that would be two
/// rows in the same menu, one of which is always the wrong one to tap — so
/// this screen is whichever of the two the student currently needs, and the
/// menu has one entry.
///
/// This is a second, unrelated college system, not part of Handy's own
/// attendance. It is kept visibly separate for that reason: a Hub percentage
/// has nothing to do with the 75% a degree depends on, and mixing the two
/// would be the single most expensive confusion this app could cause.
class HubAttendanceScreen extends StatefulWidget {
  const HubAttendanceScreen({super.key});

  @override
  State<HubAttendanceScreen> createState() => _HubAttendanceScreenState();
}

class _HubAttendanceScreenState extends State<HubAttendanceScreen> {
  final _hub = Hub();

  HubAttendanceResult? _result;
  String? _error;
  bool _loading = true;

  /// Which course accordions are open, and which have had their not-started
  /// modules revealed. Keyed by course rather than by index so the list can be
  /// re-sorted under them without a card silently changing what it opened.
  final _openCourses = <String>{};
  final _openUpcoming = <String>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await _hub.attendance();
      if (!mounted) return;
      setState(() {
        _result = result;
        _loading = false;
      });
    } on HubException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      // Anything else means CodeForge sent back a shape we could not read.
      // Nothing the student can do about it, but a screen stuck on "checking"
      // forever is worse than one that says so and offers a retry.
      if (!mounted) return;
      setState(() {
        _error = 'CodeForge sent back something Handy could not read.';
        _loading = false;
      });
    }
  }

  Future<void> _disconnect() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Disconnect CodeForge?'),
        content: const Text(
          'Handy will forget your CodeForge roll number and password. '
          'You can reconnect any time.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: FilledButton.styleFrom(backgroundColor: HandyColors.bad),
            child: const Text('Disconnect'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await _hub.disconnect();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e is HubException ? e.message : 'Could not disconnect CodeForge.'),
        ),
      );
      return;
    }
    if (!mounted) return;
    setState(() {
      _openCourses.clear();
      _openUpcoming.clear();
    });
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final linked = _result?.linked ?? false;
    final snapshot = _result?.snapshot;

    return Scaffold(
      appBar: AppBar(
        title: const Text('CodeForge Attendance'),
        actions: [
          if (linked)
            IconButton(
              tooltip: 'Disconnect CodeForge',
              onPressed: _disconnect,
              icon: AppIcon(HugeIcons.strokeRoundedLogout01, size: 20),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            if (_loading)
              // The shape of what is coming, not a sentence about waiting. This
              // request signs in to Maya and walks every enrolled course, so it
              // is the longest wait in the app and the one most worth dressing
              // properly. See code_forge_loading.dart.
              const CodeForgeScreenSkeleton()
            else if (_error case final message?)
              _Retry(message: message, onRetry: _load)
            else if (!linked)
              _ConnectForm(hub: _hub, onConnected: _load)
            else if (snapshot == null)
              const _Quiet('CodeForge returned nothing this time. Pull to try again.')
            else ...[
              _Summary(snapshot: snapshot),
              const SizedBox(height: 14),
              if (snapshot.courses.isEmpty)
                const _Quiet("CodeForge hasn't reported any sessions for your courses yet.")
              else ...[
                // CodeForge first — the courses the headline percentage is
                // built from — then the ability courses under their own
                // heading, so it is clear at a glance which are which and why
                // the number counts some and not others.
                for (final course in _sorted(snapshot.codeForgeCourses)) ...[
                  _courseCard(course),
                  const SizedBox(height: 8),
                ],
                if (snapshot.otherCourses.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  const _SectionLabel('Also on your Maya login'),
                  const SizedBox(height: 8),
                  for (final course in _sorted(snapshot.otherCourses)) ...[
                    _courseCard(course),
                    const SizedBox(height: 8),
                  ],
                ],
              ],
            ],
          ],
        ),
      ),
    );
  }

  static void _toggle(Set<String> set, String key) {
    if (!set.remove(key)) set.add(key);
  }

  Widget _courseCard(HubCourse course) => _CourseCard(
        course: course,
        open: _openCourses.contains(course.key),
        upcomingOpen: _openUpcoming.contains(course.key),
        onToggle: () => setState(() => _toggle(_openCourses, course.key)),
        onToggleUpcoming: () => setState(() => _toggle(_openUpcoming, course.key)),
      );

  /// Worst first among those that have run, the rest by name — the same order
  /// HubAttendanceSnapshot.sortedCourses uses, applied within each section.
  static List<HubCourse> _sorted(List<HubCourse> courses) {
    final list = [...courses];
    list.sort((a, b) {
      final aRun = a.percentage != null, bRun = b.percentage != null;
      if (aRun != bRun) return aRun ? -1 : 1;
      if (aRun && bRun) return a.percentage!.compareTo(b.percentage!);
      return a.technologyName.compareTo(b.technologyName);
    });
    return list;
  }
}

/// A quiet divider between the CodeForge courses and the rest.
class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(left: 4),
        child: Text(text.toUpperCase(), style: Theme.of(context).textTheme.labelSmall),
      );
}

/// Where a student links their Maya account.
class _ConnectForm extends StatefulWidget {
  const _ConnectForm({required this.hub, required this.onConnected});

  final Hub hub;
  final Future<void> Function() onConnected;

  @override
  State<_ConnectForm> createState() => _ConnectFormState();
}

class _ConnectFormState extends State<_ConnectForm> {
  final _roll = TextEditingController();
  final _password = TextEditingController();
  bool _show = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _roll.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _connect() async {
    if (_roll.text.trim().isEmpty || _password.text.isEmpty) {
      setState(() => _error = 'Enter both your CodeForge roll number and password.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.hub.connect(rollNumber: _roll.text, password: _password.text);
    } on HubException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
      return;
    }
    if (!mounted) return;
    _roll.clear();
    _password.clear();
    await widget.onConnected();
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                AppIcon(
                  HugeIcons.strokeRoundedCode,
                  size: 19,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 10),
                Text('Connect CodeForge', style: Theme.of(context).textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              'CodeForge and skills-hour attendance from Maya, alongside your regular '
              'attendance. This is your CodeForge login, separate from your Handy account — '
              "saved so you won't need to sign in again.",
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 18),

            TextField(
              controller: _roll,
              enabled: !_busy,
              textCapitalization: TextCapitalization.characters,
              autocorrect: false,
              decoration: const InputDecoration(
                labelText: 'CodeForge roll number',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              enabled: !_busy,
              obscureText: !_show,
              autocorrect: false,
              enableSuggestions: false,
              onSubmitted: (_) => _busy ? null : _connect(),
              decoration: InputDecoration(
                labelText: 'CodeForge password',
                suffixIcon: IconButton(
                  onPressed: () => setState(() => _show = !_show),
                  tooltip: _show ? 'Hide password' : 'Show password',
                  icon: AppIcon(
                    _show ? HugeIcons.strokeRoundedViewOff : HugeIcons.strokeRoundedView,
                    size: 18,
                  ),
                ),
              ),
            ),

            if (_error case final message?) ...[
              const SizedBox(height: 10),
              Text(
                message,
                style: const TextStyle(
                  color: HandyColors.bad,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],

            const SizedBox(height: 16),
            FilledButton(
              onPressed: _busy ? null : _connect,
              child: _busy
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Connect CodeForge'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.snapshot});
  final HubAttendanceSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    // The headline is CodeForge only; the list further down still shows every
    // course Maya returned, ability ones included, because a student does want
    // to see those — they just do not belong in the CodeForge percentage.
    final percent = snapshot.codeForgePercentage;
    final status = hubStatus(percent);
    final courses = snapshot.codeForgeCourses.length;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Overall CodeForge attendance',
                          style: Theme.of(context).textTheme.labelSmall),
                      const SizedBox(height: 4),
                      Text(
                        percent == null ? '—' : '${percent.toStringAsFixed(2)}%',
                        style: TextStyle(
                          fontSize: 34,
                          fontWeight: FontWeight.w800,
                          height: 1.1,
                          letterSpacing: -1,
                          color: status.colour,
                        ),
                      ),
                    ],
                  ),
                ),
                _Badge(status: status),
              ],
            ),
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: (percent ?? 0) / 100,
                minHeight: 8,
                backgroundColor: Theme.of(context).dividerColor,
                valueColor: AlwaysStoppedAnimation(status.colour),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              '${snapshot.codeForgeAttended}/${snapshot.codeForgeTotal} sessions across '
              '$courses CodeForge course${courses == 1 ? '' : 's'}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (snapshot.studentName case final name? when name.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(name, style: Theme.of(context).textTheme.bodySmall),
            ],
          ],
        ),
      ),
    );
  }
}

/// One course, collapsed to a name and a percentage until tapped.
///
/// A course can carry a couple of dozen modules the student has not reached
/// yet. Listed flat they read as noise before they read as data, so modules
/// that have not started hide behind their own toggle inside an opened course
/// rather than padding out the list somebody came here to read.
class _CourseCard extends StatelessWidget {
  const _CourseCard({
    required this.course,
    required this.open,
    required this.upcomingOpen,
    required this.onToggle,
    required this.onToggleUpcoming,
  });

  final HubCourse course;
  final bool open;
  final bool upcomingOpen;
  final VoidCallback onToggle;
  final VoidCallback onToggleUpcoming;

  @override
  Widget build(BuildContext context) {
    final status = hubStatus(course.percentage);
    final started = course.started;
    final upcoming = course.upcoming;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: onToggle,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          course.title,
                          style: const TextStyle(fontWeight: FontWeight.w700, height: 1.25),
                        ),
                        if (course.subtitle case final sub?) ...[
                          const SizedBox(height: 2),
                          Text(sub, style: Theme.of(context).textTheme.bodySmall),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    course.percentage == null
                        ? '—'
                        : '${course.percentage!.toStringAsFixed(0)}%',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: status.colour,
                    ),
                  ),
                  const SizedBox(width: 4),
                  AnimatedRotation(
                    turns: open ? 0.5 : 0,
                    duration: const Duration(milliseconds: 180),
                    child: AppIcon(HugeIcons.strokeRoundedArrowDown01, size: 18),
                  ),
                ],
              ),
            ),
          ),
          if (open)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Divider(height: 1),
                  const SizedBox(height: 12),
                  if (started.isEmpty)
                    Text(
                      'No sessions held yet for this course.',
                      style: Theme.of(context).textTheme.bodySmall,
                    )
                  else
                    for (final module in started) _ModuleRow(module: module),
                  if (upcoming.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    InkWell(
                      onTap: onToggleUpcoming,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Row(
                          children: [
                            Text(
                              '${upcomingOpen ? 'Hide' : 'Show'} ${upcoming.length} '
                              'module${upcoming.length == 1 ? '' : 's'} not started yet',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            const SizedBox(width: 4),
                            AnimatedRotation(
                              turns: upcomingOpen ? 0.5 : 0,
                              duration: const Duration(milliseconds: 180),
                              child: AppIcon(HugeIcons.strokeRoundedArrowDown01, size: 14),
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (upcomingOpen)
                      for (final module in upcoming)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Text(
                            module.moduleName,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _ModuleRow extends StatelessWidget {
  const _ModuleRow({required this.module});
  final HubModule module;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  module.moduleName,
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                '${module.attendedSessions}/${module.totalSessions}',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
            ],
          ),
          if (module.hasDistinctTopics)
            for (final topic in module.topics)
              Padding(
                padding: const EdgeInsets.only(top: 4, left: 2),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        topic.topicName,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                    Text(
                      '${topic.attendedCount}/${topic.totalSessions}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.status});
  final HubStatus status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: status.colour.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status.label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: status.colour),
      ),
    );
  }
}

class _Quiet extends StatelessWidget {
  const _Quiet(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 26, horizontal: 4),
        child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
      );
}

class _Retry extends StatelessWidget {
  const _Retry({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 26, horizontal: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(message, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
          ],
        ),
      );
}
