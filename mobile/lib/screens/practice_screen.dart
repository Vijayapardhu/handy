import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/coding.dart';
import '../data/widget_publish.dart';
import '../logic/coding.dart';
import '../logic/mastery.dart';
import '../main.dart';
import '../models/coding.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/app_icon.dart';
import '../widgets/form_sheet.dart';
import '../widgets/skeleton.dart';

/// Coding practice on the phone — the Practice and Goals halves of the web's
/// Tasks screen (src/pages/Tasks/PracticeTab.tsx, GoalsTab.tsx).
///
/// One controller owns every call for both, because they read the same profile:
/// two widgets each fetching it would show two different totals for a second
/// after a refresh, which is exactly the kind of disagreement this app takes
/// pains to avoid.
class PracticeController extends ChangeNotifier {
  PracticeController({Coding? coding}) : _coding = coding ?? Coding();

  final Coding _coding;

  CodingProfileResult? result;
  List<CodingSolution> solutions = const [];
  DailyProblem? daily;
  List<ContestItem> contests = const [];
  List<LeaderboardEntry> leaderboard = const [];

  bool loading = true;
  bool refreshing = false;
  String? error;

  StreamSubscription<List<CodingSolution>>? _solutionsSub;

  CodingProfile get profile => result?.profile ?? CodingProfile.empty;
  bool get linked => result?.linked ?? false;

  Future<void> load({bool forceRefresh = false}) async {
    if (forceRefresh) {
      refreshing = true;
      notifyListeners();
    }
    try {
      result = await _coding.profile(forceRefresh: forceRefresh);
      error = null;
    } on CodingException catch (e) {
      error = e.message;
    } finally {
      loading = false;
      refreshing = false;
      notifyListeners();
    }

    // The solve log is live rather than fetched: it is the one thing on this
    // screen the student changes, and it should not need a pull to reappear.
    _solutionsSub ??= _coding.watchSolutions().listen((list) {
      solutions = list;
      notifyListeners();
      // The tile carries a streak and a weekly count, and both move the moment
      // something is logged — so it is republished here rather than only after
      // a profile refresh.
      unawaited(_publishWidget());
    });

    if (linked) unawaited(_loadExtras());
    unawaited(_publishWidget());
  }

  /// Hands the home-screen tile the figures it cannot fetch for itself.
  ///
  /// Never allowed to fail the load: a tile that could not be updated is a
  /// stale tile, which is a far smaller problem than a screen that would not
  /// open because of one.
  Future<void> _publishWidget() async {
    try {
      await publishPractice(
        profile: result?.profile,
        solutions: solutions,
        todayIso: _todayIso(),
      );
    } catch (_) {
      // Nothing to tell the student: they never asked for this.
    }
  }

  /// The three feeds that only make sense once something is connected. Each
  /// failure is swallowed on purpose — a contest list that could not be
  /// fetched should cost a section, never the screen.
  Future<void> _loadExtras() async {
    final results = await Future.wait([
      _coding.daily().catchError((_) => null),
      _coding.contests().catchError((_) => <ContestItem>[]),
      _coding.leaderboard().catchError((_) => <LeaderboardEntry>[]),
    ]);
    daily = results[0] as DailyProblem?;
    contests = results[1] as List<ContestItem>;
    leaderboard = results[2] as List<LeaderboardEntry>;
    notifyListeners();
  }

  Future<String?> link(Map<CodingPlatform, String> handles) async {
    refreshing = true;
    notifyListeners();
    try {
      result = await _coding.link(handles);
      unawaited(_loadExtras());
      return null;
    } on CodingException catch (e) {
      return e.message;
    } finally {
      refreshing = false;
      notifyListeners();
    }
  }

  Future<void> setTarget(int weeklyTarget) async {
    try {
      await _coding.settings(weeklyTarget: weeklyTarget);
      result = CodingProfileResult(
        linked: linked,
        profile: CodingProfile(
          handles: profile.handles,
          stats: profile.stats,
          recent: profile.recent,
          totalSolved: profile.totalSolved,
          weeklyTarget: weeklyTarget,
          shareToLeaderboard: profile.shareToLeaderboard,
          refreshedAt: profile.refreshedAt,
        ),
      );
      notifyListeners();
    } on CodingException catch (_) {
      // Nothing to say: the stepper still shows the old number, which is the
      // truth about what is stored.
    }
  }

  Future<void> setSharing(bool share) async {
    try {
      await _coding.settings(shareToLeaderboard: share);
      result = CodingProfileResult(
        linked: linked,
        profile: CodingProfile(
          handles: profile.handles,
          stats: profile.stats,
          recent: profile.recent,
          totalSolved: profile.totalSolved,
          weeklyTarget: profile.weeklyTarget,
          shareToLeaderboard: share,
          refreshedAt: profile.refreshedAt,
        ),
      );
      leaderboard = await _coding.leaderboard();
      notifyListeners();
    } on CodingException catch (_) {
      // As above — the toggle springs back to what the server still holds.
    }
  }

  Future<ComplexityVerdict> analyse({
    required String code,
    required String language,
    String? title,
    CodingPlatform? platform,
  }) =>
      _coding.analyse(code: code, language: language, title: title, platform: platform);

  Future<void> saveSolution({
    required CodingPlatform platform,
    required String title,
    required String solvedAt,
    required String language,
    String url = '',
    ProblemDifficulty? difficulty,
    String code = '',
    String notes = '',
    ComplexityVerdict? complexity,
    List<String> topics = const [],
  }) =>
      _coding.createSolution(
        platform: platform,
        title: title,
        solvedAt: solvedAt,
        language: language,
        url: url,
        difficulty: difficulty,
        code: code,
        notes: notes,
        complexity: complexity,
        topics: topics,
      );

  Future<void> deleteSolution(String id) => _coding.deleteSolution(id);

  @override
  void dispose() {
    _solutionsSub?.cancel();
    super.dispose();
  }
}

String _todayIso() => DateFormat('yyyy-MM-dd').format(DateTime.now());

Future<void> _open(String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null) return;
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// What the five platforms say, and what the student wrote down themselves.
class PracticeView extends StatelessWidget {
  const PracticeView({super.key, required this.controller});

  final PracticeController controller;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        if (controller.loading) {
          return const ListSkeleton(rows: 3, height: 110);
        }

        if (!controller.linked) {
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
            children: [
              _ConnectCard(controller: controller),
              const SizedBox(height: 12),
              Text(
                'Handy reads only what those profiles already show the public. '
                'Nothing is posted, and no password is ever asked for.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          );
        }

        final profile = controller.profile;
        final activity = buildActivityMap(profile.stats, controller.solutions);
        final heatmap = buildHeatmap(activity, _todayIso());
        final streak = currentStreak(activity, _todayIso());
        final best = longestStreak(activity);
        final split = totalByDifficulty(profile.stats);
        final coverage = complexityCoverage(controller.solutions);
        final mastery = computeTopicMastery(controller.solutions, _todayIso());

        return RefreshIndicator(
          onRefresh: () => controller.load(forceRefresh: true),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
            children: [
              _SummaryCard(controller: controller, split: split),
              const SizedBox(height: 12),

              _PlatformGrid(stats: profile.stats),
              const SizedBox(height: 12),

              _HeatmapCard(days: heatmap, streak: streak, longest: best),
              const SizedBox(height: 12),

              if (mastery.isNotEmpty) ...[
                _TopicMasteryCard(mastery: mastery),
                const SizedBox(height: 12),
              ],

              if (controller.daily != null) ...[
                _DailyCard(daily: controller.daily!),
                const SizedBox(height: 12),
              ],

              if (profile.recent.isNotEmpty) ...[
                _RecentCard(controller: controller, recent: profile.recent.take(6).toList()),
                const SizedBox(height: 12),
              ],

              Row(
                children: [
                  Expanded(
                    child: Text('Solve log', style: Theme.of(context).textTheme.titleMedium),
                  ),
                  FilledButton.tonalIcon(
                    onPressed: () => openSolutionSheet(context, controller),
                    icon: AppIcon(HugeIcons.strokeRoundedAdd01, size: 16),
                    label: const Text('Log'),
                  ),
                ],
              ),
              if (coverage.total > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    '${coverage.analysed} of ${coverage.total} have a complexity recorded '
                    '(${coverage.percent}%).',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              const SizedBox(height: 8),

              if (controller.solutions.isEmpty)
                _Note(
                  'Nothing logged yet. Save a solution to keep the code, its time and space '
                  'complexity, and what you got wrong first.',
                )
              else
                for (final solution in controller.solutions)
                  _SolutionTile(solution: solution, controller: controller),
            ],
          ),
        );
      },
    );
  }
}

/// A weekly target, the class board, and what is on next.
class GoalsView extends StatelessWidget {
  const GoalsView({super.key, required this.controller});

  final PracticeController controller;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        if (controller.loading) return const ListSkeleton(rows: 2, height: 140);

        // Goals without a connected platform would be a target with nothing to
        // measure and a board with nobody on it.
        if (!controller.linked) {
          return _Note(
            'Connect a coding profile first. Goals, the class board and contest reminders all '
            'hang off your practice profiles — add one on the Practice tab.',
          );
        }

        final progress = weeklyProgress(
          controller.solutions,
          controller.profile.weeklyTarget,
          _todayIso(),
        );

        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
          children: [
            _GoalCard(controller: controller, progress: progress),
            const SizedBox(height: 12),
            _LeaderboardCard(controller: controller),
            if (controller.contests.isNotEmpty) ...[
              const SizedBox(height: 12),
              _ContestCard(contests: controller.contests),
            ],
          ],
        );
      },
    );
  }
}

// ── Practice pieces ─────────────────────────────────────────────────────────

class _ConnectCard extends StatefulWidget {
  const _ConnectCard({required this.controller});

  final PracticeController controller;

  @override
  State<_ConnectCard> createState() => _ConnectCardState();
}

class _ConnectCardState extends State<_ConnectCard> {
  late final Map<CodingPlatform, TextEditingController> _fields = {
    for (final platform in codingPlatforms)
      platform: TextEditingController(text: widget.controller.profile.handles[platform] ?? ''),
  };
  String? _error;

  @override
  void dispose() {
    for (final field in _fields.values) {
      field.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _error = null);
    final handles = {
      for (final entry in _fields.entries)
        if (entry.value.text.trim().isNotEmpty) entry.key: entry.value.text.trim(),
    };
    final error = await widget.controller.link(handles);
    if (mounted) setState(() => _error = error);
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Connect your coding profiles', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(
              'Public usernames only — never a password. Leave a row blank to skip it.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            for (final platform in codingPlatforms)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: TextField(
                  controller: _fields[platform],
                  autocorrect: false,
                  enableSuggestions: false,
                  textCapitalization: TextCapitalization.none,
                  decoration: InputDecoration(
                    labelText: platform.label,
                    hintText: platform.handleHint,
                    isDense: true,
                  ),
                ),
              ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12.5),
                ),
              ),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: widget.controller.refreshing ? null : _save,
                child: Text(widget.controller.refreshing ? 'Reading your profiles…' : 'Save'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.controller, required this.split});

  final PracticeController controller;
  final DifficultySplit? split;

  @override
  Widget build(BuildContext context) {
    final profile = controller.profile;
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
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
                      Text(
                        '${profile.totalSolved}',
                        style: theme.textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      Text('problems solved, all platforms', style: theme.textTheme.bodySmall),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Edit connected profiles',
                  onPressed: () => _openConnectSheet(context, controller),
                  icon: AppIcon(HugeIcons.strokeRoundedSettings01, size: 18),
                ),
                IconButton(
                  tooltip: 'Refresh from the platforms',
                  onPressed:
                      controller.refreshing ? null : () => controller.load(forceRefresh: true),
                  icon: AppIcon(HugeIcons.strokeRoundedRefresh, size: 18),
                ),
              ],
            ),
            if (split != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Wrap(
                  spacing: 12,
                  children: [
                    _Chip('${split!.easy} easy', HandyColors.good),
                    _Chip('${split!.medium} medium', HandyColors.warn),
                    _Chip('${split!.hard} hard', HandyColors.bad),
                  ],
                ),
              ),
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                [
                  profile.refreshedAt == null
                      ? 'Not read yet'
                      : 'Updated ${DateFormat('d MMM').format(profile.refreshedAt!)}',
                  if (controller.result?.rateLimited == true)
                    'refresh limit reached, showing the last snapshot',
                ].join(' · '),
                style: theme.textTheme.labelSmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(this.label, this.color);

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Text(
        label,
        style: TextStyle(color: color, fontSize: 11.5, fontWeight: FontWeight.w700),
      );
}

class _PlatformGrid extends StatelessWidget {
  const _PlatformGrid({required this.stats});

  final List<PlatformStats> stats;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (final entry in stats)
          SizedBox(
            width: (MediaQuery.sizeOf(context).width - 42) / 2,
            child: _PlatformTile(stats: entry),
          ),
      ],
    );
  }
}

/// One platform's numbers.
///
/// Only the fields that came back are drawn: the five sites publish genuinely
/// different things, and a grid of dashes would say a site is broken when it is
/// simply a different site. A platform that failed keeps its tile and says so,
/// because a tile that vanished would read as a solved count of zero.
class _PlatformTile extends StatelessWidget {
  const _PlatformTile({required this.stats});

  final PlatformStats stats;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final failed = stats.error != null;

    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: () => _open(stats.profileUrl),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      stats.platform.label,
                      style: theme.textTheme.labelLarge,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (failed)
                    AppIcon(HugeIcons.strokeRoundedAlert02, size: 14, color: HandyColors.warn),
                ],
              ),
              const SizedBox(height: 4),
              if (failed)
                Text(
                  stats.error == 'not_found'
                      ? 'No profile at that username.'
                      : "Couldn't read this profile just now.",
                  style: theme.textTheme.bodySmall,
                )
              else ...[
                Text(
                  '${stats.solved ?? '—'}',
                  style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                Text('solved', style: theme.textTheme.labelSmall),
                if (stats.rank != null || stats.rating != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      [
                        if (stats.rating != null) '${stats.rating} rating',
                        if (stats.rank != null) stats.rank!,
                      ].join(' · '),
                      style: theme.textTheme.bodySmall,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              const SizedBox(height: 4),
              Text(stats.handle, style: theme.textTheme.labelSmall, overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      ),
    );
  }
}

/// Twelve weeks of practice, one square per day.
///
/// The gaps are the point — this is the one view that shows the weeks nothing
/// happened, which a "247 solved" total hides completely.
class _HeatmapCard extends StatelessWidget {
  const _HeatmapCard({required this.days, required this.streak, required this.longest});

  final List<ActivityDay> days;
  final int streak;
  final int longest;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final active = days.where((day) => day.count > 0).length;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                AppIcon(
                  HugeIcons.strokeRoundedFire,
                  size: 16,
                  color: streak > 0 ? HandyColors.orange : theme.textTheme.labelSmall?.color,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    streak > 0 ? '$streak-day streak' : 'No streak yet',
                    style: theme.textTheme.titleSmall,
                  ),
                ),
                Text(
                  '$active active ${active == 1 ? 'day' : 'days'}'
                  '${longest > 0 ? ' · best $longest' : ''}',
                  style: theme.textTheme.labelSmall,
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Column-major: each column is a week, so the rows read as
            // weekdays — the shape of every practice heatmap a student has
            // already seen.
            SizedBox(
              height: 7 * 14,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                reverse: true,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (var week = 0; week * 7 < days.length; week += 1)
                      Column(
                        children: [
                          for (var row = 0; row < 7; row += 1)
                            if (week * 7 + row < days.length)
                              _Cell(level: days[week * 7 + row].level),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({required this.level});

  final int level;

  @override
  Widget build(BuildContext context) {
    final base = HandyColors.orange;
    final color = switch (level) {
      1 => base.withValues(alpha: 0.25),
      2 => base.withValues(alpha: 0.45),
      3 => base.withValues(alpha: 0.7),
      4 => base,
      _ => Theme.of(context).colorScheme.surfaceContainerHighest,
    };
    return Container(
      width: 11,
      height: 11,
      margin: const EdgeInsets.all(1.5),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3)),
    );
  }
}

/// Which DSA topics a student has actually practised, and how deep.
///
/// Built entirely from the solve log's own topic tags — see
/// logic/mastery.dart for exactly what the score does and does not claim to
/// measure. Nothing here is an AI opinion; every number is a plain function
/// of what was logged, which is also why an untagged solve (most platforms
/// don't publish topics, so most solves start untagged) simply doesn't
/// appear here rather than being guessed into some topic.
class _TopicMasteryCard extends StatelessWidget {
  const _TopicMasteryCard({required this.mastery});

  final List<TopicMastery> mastery;

  static const _visibleTopics = 8;

  Color _bandColor(MasteryBand band) => switch (band) {
        MasteryBand.starting => HandyColors.lightMuted,
        MasteryBand.learning => HandyColors.info,
        MasteryBand.practicing => HandyColors.warn,
        MasteryBand.strong => HandyColors.orange,
        MasteryBand.advanced => HandyColors.good,
        MasteryBand.mastered => HandyColors.excellent,
      };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final visible = mastery.take(_visibleTopics).toList();
    final next = nextFocusTopic(mastery);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                AppIcon(HugeIcons.strokeRoundedTarget02, size: 16),
                const SizedBox(width: 6),
                Text('Topic mastery', style: theme.textTheme.titleSmall),
              ],
            ),
            const SizedBox(height: 10),
            for (final entry in visible)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(entry.topic.label, style: theme.textTheme.bodyMedium),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                          decoration: BoxDecoration(
                            color: _bandColor(entry.band).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            entry.band.label,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: _bandColor(entry.band),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        value: entry.percent / 100,
                        minHeight: 6,
                        backgroundColor: theme.colorScheme.surfaceContainerHighest,
                        color: _bandColor(entry.band),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${entry.solved} solved · ${entry.easy}E ${entry.medium}M ${entry.hard}H',
                      style: theme.textTheme.labelSmall,
                    ),
                  ],
                ),
              ),
            if (next != null)
              Container(
                margin: const EdgeInsets.only(top: 4),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    AppIcon(HugeIcons.strokeRoundedCompass01, size: 14),
                    const SizedBox(width: 6),
                    Text.rich(
                      TextSpan(
                        style: theme.textTheme.bodySmall,
                        children: [
                          const TextSpan(text: 'Focus next: '),
                          TextSpan(
                            text: next.label,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 6),
            Text(
              "Only counts solves tagged with a topic — tag one when you log it to have it count here.",
              style: theme.textTheme.labelSmall,
            ),
          ],
        ),
      ),
    );
  }
}

/// LeetCode's problem of the day — the cheapest possible answer to "what
/// should I practise". Adding it to the deadline list is what turns an
/// intention into something the reminder path already knows about.
class _DailyCard extends StatefulWidget {
  const _DailyCard({required this.daily});

  final DailyProblem daily;

  @override
  State<_DailyCard> createState() => _DailyCardState();
}

class _DailyCardState extends State<_DailyCard> {
  bool _added = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text("TODAY'S PROBLEM", style: theme.textTheme.labelSmall)),
                if (widget.daily.difficulty != null)
                  Text(
                    widget.daily.difficulty!.name,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: switch (widget.daily.difficulty!) {
                        ProblemDifficulty.easy => HandyColors.good,
                        ProblemDifficulty.medium => HandyColors.warn,
                        ProblemDifficulty.hard => HandyColors.bad,
                      },
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            InkWell(
              onTap: () => _open(widget.daily.url),
              child: Text(widget.daily.title, style: theme.textTheme.titleMedium),
            ),
            if (widget.daily.tags.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(widget.daily.tags.take(4).join(' · '), style: theme.textTheme.bodySmall),
              ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _added
                  ? null
                  : () async {
                      await repository.addTask(
                        title: 'Daily problem: ${widget.daily.title}',
                        notes: widget.daily.url,
                        kind: TaskKind.other,
                        dueDate: DateTime.now(),
                      );
                      if (mounted) setState(() => _added = true);
                    },
              icon: AppIcon(
                _added ? HugeIcons.strokeRoundedTick01 : HugeIcons.strokeRoundedAdd01,
                size: 15,
              ),
              label: Text(_added ? 'On your list' : 'Add to deadlines'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Platform-reported solves, with the one action that turns one into a logged
/// one — the platform will never tell you what the solution cost.
class _RecentCard extends StatelessWidget {
  const _RecentCard({required this.controller, required this.recent});

  final PracticeController controller;
  final List<RecentSolve> recent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 8, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Text('Recently accepted', style: theme.textTheme.titleSmall),
            ),
            for (final solve in recent)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(solve.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(
                  '${solve.platform.label}'
                  '${solve.language == null ? '' : ' · ${solve.language}'}'
                  ' · ${DateFormat('d MMM').format(solve.solvedAt)}',
                ),
                trailing: TextButton(
                  onPressed: () => openSolutionSheet(context, controller, from: solve),
                  child: const Text('Log'),
                ),
                onTap: () => _open(solve.url),
              ),
          ],
        ),
      ),
    );
  }
}

/// One logged solve. The two complexity badges are the loudest thing on the
/// tile, because they are the only part of a solve log anyone re-reads.
class _SolutionTile extends StatelessWidget {
  const _SolutionTile({required this.solution, required this.controller});

  final CodingSolution solution;
  final PracticeController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final complexity = solution.complexity;

    return Card(
      child: ExpansionTile(
        shape: const Border(),
        collapsedShape: const Border(),
        title: Text(solution.title, style: theme.textTheme.titleSmall),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${solution.platform.label}'
              '${solution.difficulty == null ? '' : ' · ${solution.difficulty!.name}'}'
              ' · ${solution.language} · ${solution.solvedAt}',
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: 4),
            if (complexity == null)
              Text('No complexity recorded', style: theme.textTheme.labelSmall)
            else
              Wrap(
                spacing: 6,
                children: [
                  _Badge('Time ${complexity.time}'),
                  _Badge('Space ${complexity.space}'),
                  // Says out loud that a machine wrote this, every time it is
                  // read, for as long as the student has not corrected it.
                  if (complexity.isEstimate) _Badge('estimate', muted: true),
                ],
              ),
          ],
        ),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (complexity != null && complexity.explanation.isNotEmpty)
                  Text(complexity.explanation, style: theme.textTheme.bodySmall),
                if (complexity?.bottleneck != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text('Bottleneck: ${complexity!.bottleneck}',
                        style: theme.textTheme.bodySmall),
                  ),
                if (complexity?.betterApproach != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text('Could be faster: ${complexity!.betterApproach}',
                        style: theme.textTheme.bodySmall),
                  ),
                if (solution.notes.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(solution.notes, style: theme.textTheme.bodySmall),
                  ),
                if (solution.code.isNotEmpty)
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(top: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Text(
                        solution.code,
                        style: const TextStyle(fontFamily: 'monospace', fontSize: 11.5),
                      ),
                    ),
                  ),
                Row(
                  children: [
                    if (solution.url.isNotEmpty)
                      TextButton(
                        onPressed: () => _open(solution.url),
                        child: const Text('Open problem'),
                      ),
                    const Spacer(),
                    TextButton(
                      onPressed: () => controller.deleteSolution(solution.id),
                      child: Text('Delete', style: TextStyle(color: theme.colorScheme.error)),
                    ),
                  ],
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
  const _Badge(this.label, {this.muted = false});

  final String label;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: muted
            ? theme.colorScheme.surfaceContainerHighest
            : HandyColors.orange.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: muted ? theme.textTheme.labelSmall?.color : HandyColors.orangeDeep,
        ),
      ),
    );
  }
}

// ── Goals pieces ────────────────────────────────────────────────────────────

class _GoalCard extends StatefulWidget {
  const _GoalCard({required this.controller, required this.progress});

  final PracticeController controller;
  final WeeklyProgress progress;

  @override
  State<_GoalCard> createState() => _GoalCardState();
}

class _GoalCardState extends State<_GoalCard> {
  int? _draft;

  int get _value => _draft ?? widget.progress.target;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final progress = widget.progress;
    final dirty = _value != progress.target;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Weekly practice goal', style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            if (progress.target > 0) ...[
              Text(
                '${progress.solved} / ${progress.target} logged this week',
                style: theme.textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: progress.percent / 100,
                  minHeight: 8,
                  color: progress.met ? HandyColors.good : HandyColors.orange,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                progress.met
                    ? 'Goal met — anything else this week is a bonus.'
                    : '${progress.remaining} to go, ${progress.daysLeft} '
                        '${progress.daysLeft == 1 ? 'day' : 'days'} left.',
                style: theme.textTheme.bodySmall,
              ),
            ] else
              Text(
                "No goal yet. Pick a number you'd actually hit in a normal week — three is a real "
                "goal, twenty is a New Year's resolution.",
                style: theme.textTheme.bodySmall,
              ),
            const SizedBox(height: 12),
            Row(
              children: [
                IconButton.outlined(
                  onPressed: () => setState(() => _draft = (_value - 1).clamp(0, 50)),
                  icon: AppIcon(HugeIcons.strokeRoundedMinusSign, size: 16),
                ),
                SizedBox(
                  width: 64,
                  child: Text(
                    _value == 0 ? 'None' : '$_value',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleMedium,
                  ),
                ),
                IconButton.outlined(
                  onPressed: () => setState(() => _draft = (_value + 1).clamp(0, 50)),
                  icon: AppIcon(HugeIcons.strokeRoundedAdd01, size: 16),
                ),
                const Spacer(),
                if (dirty)
                  FilledButton(
                    onPressed: () async {
                      await widget.controller.setTarget(_value);
                      if (mounted) setState(() => _draft = null);
                    },
                    child: const Text('Save'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// How the class is doing, by problems solved.
///
/// Names and totals only: the server never sends a classmate's handles, streak
/// or solve log, so there is no version of this screen that leaks them.
class _LeaderboardCard extends StatelessWidget {
  const _LeaderboardCard({required this.controller});

  final PracticeController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sharing = controller.profile.shareToLeaderboard;
    final entries = controller.leaderboard;

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text('Class board', style: theme.textTheme.titleSmall)),
                Text('Show me', style: theme.textTheme.labelSmall),
                Switch(
                  value: sharing,
                  onChanged: (value) => controller.setSharing(value),
                ),
              ],
            ),
            if (entries.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  sharing
                      ? 'Nobody in your class has connected a coding profile yet. Be the first.'
                      : "You're hidden from the board. Turn “Show me” on to join it.",
                  style: theme.textTheme.bodySmall,
                ),
              )
            else
              for (final (index, entry) in entries.indexed)
                Container(
                  margin: const EdgeInsets.only(top: 2),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: entry.isMe
                        ? HandyColors.orange.withValues(alpha: 0.12)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 22,
                        child: Text('${index + 1}', style: theme.textTheme.labelSmall),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(entry.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.bodyMedium),
                            Text(entry.rollNumber, style: theme.textTheme.labelSmall),
                          ],
                        ),
                      ),
                      Text(
                        '${entry.totalSolved}',
                        style: theme.textTheme.titleSmall,
                      ),
                    ],
                  ),
                ),
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Totals only — nobody can see your usernames, your streak or your solutions.',
                style: theme.textTheme.labelSmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// What is coming up. Each row can become a deadline, because a contest
/// remembered on Sunday evening is a contest missed.
class _ContestCard extends StatefulWidget {
  const _ContestCard({required this.contests});

  final List<ContestItem> contests;

  @override
  State<_ContestCard> createState() => _ContestCardState();
}

class _ContestCardState extends State<_ContestCard> {
  final _added = <String>{};

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 8, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Text('Upcoming contests', style: theme.textTheme.titleSmall),
            ),
            for (final contest in widget.contests)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(contest.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(
                  '${contest.platform.label} · '
                  '${DateFormat('EEE d MMM, h:mm a').format(contest.startsAt)}',
                ),
                trailing: IconButton(
                  onPressed: _added.contains(contest.url)
                      ? null
                      : () async {
                          await repository.addTask(
                            title: contest.name,
                            notes: '${contest.platform.label} contest\n${contest.url}',
                            kind: TaskKind.other,
                            dueDate: contest.startsAt,
                            dueTime: DateFormat('HH:mm').format(contest.startsAt),
                            // A day's notice is what makes a contest reminder
                            // useful; less arrives while it is starting.
                            leadDays: 1,
                          );
                          if (mounted) setState(() => _added.add(contest.url));
                        },
                  icon: AppIcon(
                    _added.contains(contest.url)
                        ? HugeIcons.strokeRoundedTick01
                        : HugeIcons.strokeRoundedAdd01,
                    size: 18,
                  ),
                ),
                onTap: () => _open(contest.url),
              ),
          ],
        ),
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 28),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      );
}

// ── Sheets ──────────────────────────────────────────────────────────────────

Future<void> _openConnectSheet(BuildContext context, PracticeController controller) {
  return showFormSheet<void>(
    context: context,
    builder: (_) => Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: _ConnectCard(controller: controller),
    ),
  );
}

/// Logging a solved problem, and working out what it cost.
///
/// The complexity step is a button rather than something that runs on save: it
/// calls a model, it costs money, and a student who only wants to write down
/// that they solved something should not trigger it by accident. Whatever comes
/// back is editable before it is saved.
Future<void> openSolutionSheet(
  BuildContext context,
  PracticeController controller, {
  RecentSolve? from,
}) {
  return showFormSheet<void>(
    context: context,
    builder: (_) => _SolutionSheet(controller: controller, from: from),
  );
}

class _SolutionSheet extends StatefulWidget {
  const _SolutionSheet({required this.controller, this.from});

  final PracticeController controller;
  final RecentSolve? from;

  @override
  State<_SolutionSheet> createState() => _SolutionSheetState();
}

class _SolutionSheetState extends State<_SolutionSheet> {
  static const _languages = ['Python', 'C++', 'Java', 'C', 'JavaScript', 'Go', 'Other'];

  late CodingPlatform _platform = widget.from?.platform ?? CodingPlatform.leetcode;
  late final TextEditingController _title = TextEditingController(text: widget.from?.title ?? '');
  late final TextEditingController _url = TextEditingController(text: widget.from?.url ?? '');
  late final TextEditingController _code = TextEditingController();
  late final TextEditingController _notes = TextEditingController();
  late final TextEditingController _time = TextEditingController();
  late final TextEditingController _space = TextEditingController();

  late ProblemDifficulty? _difficulty = widget.from?.difficulty;
  late String _language = _languages.contains(widget.from?.language)
      ? widget.from!.language!
      : 'Python';
  late String _solvedAt = widget.from == null
      ? _todayIso()
      : DateFormat('yyyy-MM-dd').format(widget.from!.solvedAt);

  // Real tags only — Codeforces publishes them per solve, so this pre-fills;
  // every other platform's recent list carries none, so this starts empty
  // and the student tags it themselves.
  late final Set<DsaTopic> _topics = widget.from == null
      ? {}
      : topicsFromTags(widget.from!.platform, widget.from!.tags)
          .map((id) => dsaTopics.firstWhere((t) => t.id == id))
          .toSet();

  ComplexityVerdict? _verdict;
  bool _analysing = false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final field in [_title, _url, _code, _notes, _time, _space]) {
      field.dispose();
    }
    super.dispose();
  }

  Future<void> _analyse() async {
    if (_code.text.trim().isEmpty) {
      setState(() => _error = "Paste your solution first — there's nothing to read yet.");
      return;
    }
    setState(() {
      _analysing = true;
      _error = null;
    });
    try {
      final verdict = await widget.controller.analyse(
        code: _code.text,
        language: _language,
        title: _title.text,
        platform: _platform,
      );
      if (!mounted) return;
      setState(() {
        _verdict = verdict;
        _time.text = verdict.time;
        _space.text = verdict.space;
      });
    } on CodingException catch (e) {
      if (!mounted) return;
      // A failed analysis still leaves a way forward: empty fields the student
      // can fill in by hand, which is the whole reason this is not fatal.
      setState(() {
        _error = e.message;
        _verdict = null;
      });
    } finally {
      if (mounted) setState(() => _analysing = false);
    }
  }

  Future<void> _save() async {
    if (_title.text.trim().isEmpty) {
      setState(() => _error = 'Give the problem a name.');
      return;
    }
    setState(() => _saving = true);

    final time = _time.text.trim();
    final space = _space.text.trim();
    ComplexityVerdict? complexity;
    if (time.isNotEmpty && space.isNotEmpty) {
      final base = _verdict;
      // Editing either bound makes the verdict the student's own rather than
      // the model's — copyWith is what flips `source`.
      complexity = base == null
          ? ComplexityVerdict(
              time: time,
              space: space,
              confidence: ComplexityConfidence.medium,
              explanation: '',
              bottleneck: null,
              betterApproach: null,
              source: ComplexitySource.manual,
              model: null,
              analyzedAt: DateTime.now().toIso8601String(),
            )
          : (base.time == time && base.space == space
              ? base
              : base.copyWith(time: time, space: space));
    }

    await widget.controller.saveSolution(
      platform: _platform,
      title: _title.text,
      solvedAt: _solvedAt,
      language: _language,
      url: _url.text,
      difficulty: _difficulty,
      code: _code.text,
      notes: _notes.text,
      complexity: complexity,
      topics: [for (final topic in _topics) topic.id],
    );
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Log a solved problem', style: theme.textTheme.titleMedium),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<CodingPlatform>(
                  value: _platform,
                  decoration: const InputDecoration(labelText: 'Platform', isDense: true),
                  items: [
                    for (final platform in codingPlatforms)
                      DropdownMenuItem(value: platform, child: Text(platform.label)),
                  ],
                  onChanged: (value) => setState(() => _platform = value ?? _platform),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: InkWell(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: DateTime.tryParse(_solvedAt) ?? DateTime.now(),
                      firstDate: DateTime.now().subtract(const Duration(days: 365)),
                      lastDate: DateTime.now(),
                    );
                    if (picked != null) {
                      setState(() => _solvedAt = DateFormat('yyyy-MM-dd').format(picked));
                    }
                  },
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Solved on', isDense: true),
                    child: Text(_solvedAt),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _title,
            decoration: const InputDecoration(labelText: 'Problem', isDense: true),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<ProblemDifficulty?>(
                  value: _difficulty,
                  decoration: const InputDecoration(labelText: 'Difficulty', isDense: true),
                  items: const [
                    DropdownMenuItem(value: null, child: Text('Not set')),
                    DropdownMenuItem(value: ProblemDifficulty.easy, child: Text('Easy')),
                    DropdownMenuItem(value: ProblemDifficulty.medium, child: Text('Medium')),
                    DropdownMenuItem(value: ProblemDifficulty.hard, child: Text('Hard')),
                  ],
                  onChanged: (value) => setState(() => _difficulty = value),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _language,
                  decoration: const InputDecoration(labelText: 'Language', isDense: true),
                  items: [
                    for (final language in _languages)
                      DropdownMenuItem(value: language, child: Text(language)),
                  ],
                  onChanged: (value) => setState(() => _language = value ?? _language),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text('Topics — optional, counts toward topic mastery', style: theme.textTheme.labelSmall),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final topic in dsaTopics)
                FilterChip(
                  label: Text(topic.label),
                  labelStyle: const TextStyle(fontSize: 11.5),
                  visualDensity: VisualDensity.compact,
                  selected: _topics.contains(topic),
                  onSelected: (selected) => setState(() {
                    if (selected) {
                      _topics.add(topic);
                    } else {
                      _topics.remove(topic);
                    }
                  }),
                ),
            ],
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _url,
            decoration: const InputDecoration(labelText: 'Link (optional)', isDense: true),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _code,
            maxLines: 7,
            minLines: 4,
            style: const TextStyle(fontFamily: 'monospace', fontSize: 12.5),
            decoration: const InputDecoration(
              labelText: 'Your solution',
              hintText: 'Paste the accepted submission here',
              isDense: true,
            ),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _analysing ? null : _analyse,
            icon: AppIcon(HugeIcons.strokeRoundedSparkles, size: 16),
            label: Text(_analysing ? 'Reading your code…' : 'Work out the complexity'),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _time,
                  decoration: const InputDecoration(
                    labelText: 'Time',
                    hintText: 'O(n log n)',
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _space,
                  decoration: const InputDecoration(
                    labelText: 'Space',
                    hintText: 'O(n)',
                    isDense: true,
                  ),
                ),
              ),
            ],
          ),
          if (_verdict != null) ...[
            const SizedBox(height: 8),
            if (_verdict!.explanation.isNotEmpty)
              Text(_verdict!.explanation, style: theme.textTheme.bodySmall),
            if (_verdict!.bottleneck != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child:
                    Text('Bottleneck: ${_verdict!.bottleneck}', style: theme.textTheme.bodySmall),
              ),
            if (_verdict!.betterApproach != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text('Could be faster: ${_verdict!.betterApproach}',
                    style: theme.textTheme.bodySmall),
              ),
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Estimated from your code'
                '${_verdict!.model == null ? '' : ' by ${_verdict!.model}'}'
                " — check it, and correct it if it's wrong.",
                style: theme.textTheme.labelSmall,
              ),
            ),
          ],
          const SizedBox(height: 10),
          TextField(
            controller: _notes,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Notes (optional)',
              hintText: 'What the trick was, what you got wrong first',
              isDense: true,
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(
                _error!,
                style: TextStyle(color: theme.colorScheme.error, fontSize: 12.5),
              ),
            ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _save,
              child: const Text('Save to solve log'),
            ),
          ),
        ],
      ),
    );
  }
}
