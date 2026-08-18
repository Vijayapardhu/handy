import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/app_state.dart';
import '../main.dart';
import '../logic/attendance.dart';
import '../logic/campus_features.dart';
import '../logic/deadlines.dart';
import '../logic/planning.dart';
import '../logic/timetable.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/class_sheet.dart';
import '../widgets/hub_card.dart';
import '../widgets/skeleton.dart';
import '../widgets/student_photo.dart';
import 'deadline_detail_screen.dart';
import 'notifications_inbox_screen.dart';
import 'subject_detail_screen.dart';
import 'subjects_screen.dart';
import '../widgets/app_icon.dart';

/// The screen that answers "what do I need to do today?".
///
/// Ordered by urgency rather than by category: the number that decides
/// everything, then the class that's about to start, then what's due, then the
/// day itself. A student should get the answer without scrolling or tapping.
class TodayScreen extends StatefulWidget {
  const TodayScreen({super.key});

  @override
  State<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends State<TodayScreen> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    // The countdown and the "done so far" line are both time-relative, so the
    // screen has to re-read the clock. Every 20s is well under the resolution
    // anyone notices, and costs nothing.
    _tick = Timer.periodic(const Duration(seconds: 20), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);

    if (state.loading) {
      return const Scaffold(body: SafeArea(bottom: false, child: TodaySkeleton()));
    }

    final now = DateTime.now();
    final nowHm =
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    final blocks = classBlocksForDay(state.entries, now.weekday % 7);
    final next = blocks
        // Strictly after, not on: a class ending at exactly this minute is
        // over. With >= it stayed selected for its final minute, and since the
        // running test is exclusive at the end, the card fell through to the
        // not-yet-started branch and announced that a class which had just
        // finished "starts in less than a minute".
        .where((b) => b.endTime.compareTo(nowHm) > 0)
        .firstOrNull;
    final done = blocks.where((b) => b.endTime.compareTo(nowHm) < 0).length;
    final free = freePeriods(state.entries, now.weekday % 7);
    final features = campusFeaturesFor(state.student?.rollNumber);

    final dueSoon =
        state.tasks
            .where(
              (t) =>
                  !t.done && getDeadline(t.dueDate, now).daysLeft <= soonDays,
            )
            .toList()
          ..sort((a, b) => a.dueDate.compareTo(b.dueDate));

    return Scaffold(
      body: SafeArea(
        // bottom: false because the nav bar draws its own inset. Without this
        // the greeting scrolls up under the status bar.
        bottom: false,
        child: RefreshIndicator(
          onRefresh: state.refresh,
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  // Deliberate, generous header rather than an AppBar: the
                  // greeting is content, not chrome, and the old bar left it
                  // cramped against the status bar.
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 18),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _dateLine(now),
                              style: Theme.of(context).textTheme.labelSmall,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              _greeting(settings.greetingName(state.student?.name)),
                              style: Theme.of(context).textTheme.headlineMedium,
                            ),
                          ],
                        ),
                      ),
                      // What's new, one tap from the screen everyone opens
                      // first. It lived three taps deep under Profile, which
                      // is too far for something worth checking daily — and a
                      // feed nobody finds is a feed nobody reads.
                      _Bell(unread: state.unreadNotifications),
                      const SizedBox(width: 6),
                      // Their own face next to their own name. Small, but it's
                      // the difference between an app and *their* app.
                      StudentPhoto(
                        rollNumber: state.student?.rollNumber,
                        name: state.student?.name,
                        size: 46,
                        circle: true,
                        ring: true,
                      ),
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
                sliver: SliverList.list(
                  children: [
                    _AttendanceCards(state: state),
                    const SizedBox(height: 12),

                    if (next != null) ...[
                      _NextClassCard(
                        block: next,
                        subject: state.subjectsById[next.first.subjectId],
                        // What follows, so a student sitting in a lecture can
                        // see whether they are free when it ends — which is
                        // the question they are actually asking at the time.
                        after: blocks
                            .where((b) => b.startTime.compareTo(next.endTime) >= 0)
                            .firstOrNull,
                        afterSubject: state.subjectsById[blocks
                            .where((b) => b.startTime.compareTo(next.endTime) >= 0)
                            .firstOrNull
                            ?.first
                            .subjectId],
                      ),
                      const SizedBox(height: 12),
                    ],

                    if (blocks.isNotEmpty) ...[
                      _DayProgress(
                        done: done,
                        total: blocks.length,
                        free: free.length,
                        due: dueSoon.length,
                      ),
                      const SizedBox(height: 20),
                    ],

                    if (nextExam(state.tasks, now) case final exam?) ...[
                      _ExamCountdown(exam: exam, state: state),
                      const SizedBox(height: 20),
                    ],

                    if (dueSoon.isNotEmpty) ...[
                      const _Label('Due soon'),
                      const SizedBox(height: 8),
                      ...dueSoon.map((t) => _DueRow(task: t, state: state)),
                      const SizedBox(height: 20),
                    ],

                    _AtRiskStrip(state: state),

                    // The day's timeline is read off the timetable, which a
                    // portal-login college does not publish. Left in, it would
                    // say "No classes scheduled today" — which is a claim
                    // about this student's week rather than about what Handy
                    // can see for their college. See campus_features.dart, and
                    // HomePage.tsx, which drops the same two cards.
                    if (features.hasTimetable) ...[
                      const _Label('Today'),
                      const SizedBox(height: 10),
                      if (blocks.isEmpty)
                        _Quiet(
                          'No classes scheduled today.'
                          '${free.isEmpty ? '' : ' The whole day is yours.'}',
                        )
                      else
                        _DayTimeline(blocks: blocks, state: state, nowHm: nowHm),

                      if (free.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        _FreeTimeNote(free: free),
                      ],
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _greeting(String name) {
    final hour = DateTime.now().hour;
    final part = hour < 12
        ? 'Good morning'
        : (hour < 17 ? 'Good afternoon' : 'Good evening');
    return name.isEmpty ? part : '$part, $name';
  }

  static const _days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  static const _months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  static String _dateLine(DateTime now) =>
      '${_days[now.weekday % 7]}, ${now.day} ${_months[now.month - 1]}';
}

/// The way into the feed, with a count on it.
///
/// A bell is the one icon nobody has to be taught, and the count is the only
/// reason to press it — so an empty one is drawn quietly and does not shout
/// for attention it has not earned.
class _Bell extends StatelessWidget {
  const _Bell({required this.unread});

  final int unread;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return IconButton(
      tooltip: unread == 0 ? "What's new" : '$unread unread',
      onPressed: () => Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => const NotificationsInboxScreen()),
      ),
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          AppIcon(
            HugeIcons.strokeRoundedNotification01,
            size: 23,
            color: unread > 0 ? scheme.primary : null,
          ),
          if (unread > 0)
            Positioned(
              right: -5,
              top: -4,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                constraints: const BoxConstraints(minWidth: 15),
                decoration: BoxDecoration(
                  color: scheme.primary,
                  borderRadius: BorderRadius.circular(999),
                  // Rings the badge in the page colour so it stays legible
                  // against whatever it happens to overlap.
                  border: Border.all(color: Theme.of(context).scaffoldBackgroundColor, width: 1.5),
                ),
                child: Text(
                  unread > 9 ? '9+' : '$unread',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 9,
                    height: 1.3,
                    fontWeight: FontWeight.w800,
                    color: scheme.onPrimary,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// The number that decides everything, at the size that says so.
/// The attendance card, and — for a student whose timetable has a Technical
/// Hour — CodeForge behind it, swiped to from the left.
///
/// Two figures that answer different questions and must never be mistaken for
/// one another: the first is the percentage a degree depends on, the second is
/// a separate system's session count. Stacking them as two faces of one card
/// is the web's arrangement (see CardSwiper), and it works for the same reason
/// here — they occupy one slot, so neither implies the other is a component of
/// it, and the second costs no room on a screen most students never need it on.
///
/// The dots are not decoration. A single card with something hidden behind it
/// is a card with nothing behind it as far as anyone can tell.
class _AttendanceCards extends StatefulWidget {
  const _AttendanceCards({required this.state});

  final AppState state;

  @override
  State<_AttendanceCards> createState() => _AttendanceCardsState();
}

class _AttendanceCardsState extends State<_AttendanceCards> {
  final _pages = PageController();
  int _index = 0;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    // Same gate as the web: no Technical Hour, no CodeForge, and then there is
    // only one card and nothing to swipe.
    final hasCodeForge = state.entries.any((e) => e.type == 'technical');
    if (!hasCodeForge) return _AttendanceHero(state: state);

    final faces = [
      _AttendanceHero(state: state),
      CodeForgeCard(state: state),
    ];

    return Column(
      children: [
        // A PageView is a viewport and has no height of its own to be
        // measured — IntrinsicHeight around one throws rather than fitting it.
        // So the height is stated, and stated once for both faces so neither
        // resizes the row as it scrolls past. The two are built to the same
        // structure precisely so one number suits both.
        //
        // Scaled by the reader's text size, because a fixed height is a
        // guarantee of clipping for anyone who has turned font size up. Capped,
        // because past a point the card would push everything else off screen.
        SizedBox(
          height: 208 * MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 1.5),
          child: PageView(
            controller: _pages,
            onPageChanged: (i) => setState(() => _index = i),
            children: faces,
          ),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < faces.length; i++)
              GestureDetector(
                onTap: () => _pages.animateToPage(
                  i,
                  duration: const Duration(milliseconds: 260),
                  curve: Curves.easeOutCubic,
                ),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _index ? 18 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: i == _index
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context).dividerColor,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _AttendanceHero extends StatelessWidget {
  const _AttendanceHero({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    // The projection, not the raw import: between syncs the portal's figure is
    // simply out of date, and a student who has been marking their classes
    // knows more about their own attendance than it does. Falls back to the
    // portal's own number when nothing has been marked.
    final projected = state.overallProjected;
    final percent = projected.percent;
    final colour = statusColour(percent);
    final attended = projected.attended;
    final held = projected.held;
    final canSkip = classesCanSkip(attended, held, SubjectsScreen.target);
    final needed = classesNeededForTarget(
      attended,
      held,
      SubjectsScreen.target,
    );

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'OVERALL ATTENDANCE',
              style: Theme.of(context).textTheme.labelSmall,
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  percent == null ? '—' : percent.toStringAsFixed(2),
                  style: TextStyle(
                    fontSize: 60,
                    fontWeight: FontWeight.w800,
                    // Tight tracking and tabular figures: the number shouldn't
                    // shuffle sideways as it changes.
                    letterSpacing: -3,
                    height: 1,
                    fontFeatures: const [FontFeature.tabularFigures()],
                    color: colour,
                  ),
                ),
                if (percent != null)
                  Padding(
                    padding: const EdgeInsets.only(left: 3),
                    child: Text(
                      '%',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: colour,
                      ),
                    ),
                  ),
                const Spacer(),
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '$attended / $held',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      // Said plainly whenever the number is no longer the
                      // college's. Handy must never let an estimate pass for
                      // the record.
                      if (projected.isProjected)
                        Text(
                          'estimated',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            // A Spacer rather than a gap: this card is one face of a fixed-height
            // pair (see _AttendanceCards), and whichever face is shorter would
            // otherwise leave its slack in a heap at the bottom. Putting it
            // above the bar keeps the bar and its footnote on the same line on
            // both faces, so swiping moves the number and nothing else.
            const Spacer(),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: (percent ?? 0) / 100,
                minHeight: 7,
                backgroundColor: Theme.of(context).dividerColor,
                valueColor: AlwaysStoppedAnimation(colour),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                AppIcon(
                  held == 0
                      ? HugeIcons.strokeRoundedInformationCircle
                      : (canSkip > 0
                            ? HugeIcons.strokeRoundedCheckmarkCircle01
                            : HugeIcons.strokeRoundedAlert02),
                  size: 16,
                  color: held == 0
                      ? Theme.of(context).textTheme.bodySmall?.color
                      : colour,
                ),
                const SizedBox(width: 8),
                Expanded(
                  // The actionable translation of the number: what it lets you
                  // do, or what it will take to fix.
                  child: Text(
                    held == 0
                        ? 'No classes held yet'
                        : (canSkip > 0
                              ? 'You can miss $canSkip more and stay above ${SubjectsScreen.target.toInt()}%'
                              : 'Attend the next $needed to reach ${SubjectsScreen.target.toInt()}%'),
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: held == 0
                          ? Theme.of(context).textTheme.bodySmall?.color
                          : colour,
                    ),
                  ),
                ),
              ],
            ),
            // The same figure as a date. "Attend the next 34" is arithmetic
            // nobody can act on; "17 days, by 12 May" is a plan — and it is
            // counted off the whole timetable rather than guessed from an
            // average, so it is a date the student can actually hold Handy to.
            // See daysToAttend.
            if (needed > 0 && held > 0)
              if (daysToAttend(
                    classes: needed,
                    entries: state.entries,
                    from: DateTime.now(),
                  )
                  case final plan?) ...[
                const SizedBox(height: 5),
                Padding(
                  padding: const EdgeInsets.only(left: 24),
                  child: Text(
                    '${plan.days} day${plan.days == 1 ? '' : 's'} of classes, '
                    'by ${shortWhen(plan.on)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
          ],
        ),
      ),
    );
  }
}

/// Next class with a live countdown — the one thing on this screen that
/// changes while you're looking at it.
class _NextClassCard extends StatelessWidget {
  const _NextClassCard({
    required this.block,
    this.subject,
    this.after,
    this.afterSubject,
  });

  final ClassBlock block;
  final Subject? subject;

  /// The class after this one, shown only while this one is running.
  final ClassBlock? after;
  final Subject? afterSubject;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final start = _todayAt(block.startTime);
    final end = _todayAt(block.endTime);
    final running = now.isAfter(start) && now.isBefore(end);
    final minutes = start.difference(now).inMinutes;

    final label = running
        ? 'Ongoing · ends in ${_relative(end.difference(now))}'
        : 'Starts in ${_relative(start.difference(now))}';

    final place = [
      block.first.room,
      block.first.block,
    ].whereType<String>().where((p) => p.isNotEmpty).join(' · ');

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: running
              ? [HandyColors.orange, HandyColors.orangeDeep]
              : [
                  Theme.of(context).colorScheme.surface,
                  Theme.of(context).colorScheme.surface,
                ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: running || minutes <= 30
              ? HandyColors.orange
              : Theme.of(context).dividerColor,
          width: running || minutes <= 30 ? 1.6 : 1,
        ),
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AppIcon(
                running ? HugeIcons.strokeRoundedPlayCircle : HugeIcons.strokeRoundedClock01,
                size: 15,
                color: running ? Colors.white : HandyColors.orange,
              ),
              const SizedBox(width: 7),
              Text(
                label.toUpperCase(),
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                  color: running ? Colors.white : HandyColors.orange,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            subject?.name ?? 'Class',
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.3,
              color: running ? Colors.white : null,
            ),
          ),
          const SizedBox(height: 6),
          // Wrap rather than Row: the room and building together run past the
          // width of the card ("AGBI-2.1 · Aditya Global Business Incubator"),
          // and a building truncated to "Incubat…" is not a place you can find.
          // Short venues still sit beside the time; long ones drop to their own
          // line and wrap there.
          Wrap(
            spacing: 10,
            runSpacing: 3,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                '${block.startTime} – ${block.endTime}',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: running
                      ? Colors.white70
                      : Theme.of(context).textTheme.bodySmall?.color,
                ),
              ),
              if (place.isNotEmpty)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    AppIcon(
                      HugeIcons.strokeRoundedLocation01,
                      size: 13,
                      color: running
                          ? Colors.white70
                          : Theme.of(context).textTheme.bodySmall?.color,
                    ),
                    const SizedBox(width: 3),
                    Flexible(
                      child: Text(
                        place,
                        style: TextStyle(
                          fontSize: 13,
                          height: 1.3,
                          color: running
                              ? Colors.white70
                              : Theme.of(context).textTheme.bodySmall?.color,
                        ),
                      ),
                    ),
                  ],
                ),
            ],
          ),
          // What follows, while this one is still going. A student in a
          // lecture is deciding what to do at the end of it, and "then ADSAA
          // at 13:00" answers that without opening the timetable.
          if (running && after != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                AppIcon(
                  HugeIcons.strokeRoundedArrowRight01,
                  size: 13,
                  color: Colors.white70,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Then ${_shortName(afterSubject)} at ${after!.startTime}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.white70,
                    ),
                  ),
                ),
              ],
            ),
          ],

          // While a class is running, how much of it is left is the live fact.
          // A countdown to the end says it in words; the bar says it without
          // reading.
          if (running) ...[
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: now.difference(start).inSeconds /
                    end.difference(start).inSeconds.clamp(1, 1 << 30),
                minHeight: 5,
                backgroundColor: Colors.white24,
                valueColor: const AlwaysStoppedAnimation(Colors.white),
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// The short name when the portal gave one — this line is squeezed beside a
  /// time, and "ADSAA" says as much here as the full title.
  static String _shortName(Subject? subject) {
    if (subject == null) return 'your next class';
    return subject.shortName.isNotEmpty ? subject.shortName : subject.name;
  }

  static DateTime _todayAt(String hhmm) {
    final now = DateTime.now();
    final parts = hhmm.split(':');
    return DateTime(
      now.year,
      now.month,
      now.day,
      int.parse(parts[0]),
      int.parse(parts[1]),
    );
  }

  /// "45 min" / "1 h 20 min" — minutes matter up close, hours further out.
  static String _relative(Duration d) {
    final minutes = d.inMinutes;
    if (minutes < 1) return 'less than a minute';
    if (minutes < 60) return '$minutes min';
    final hours = minutes ~/ 60;
    final rest = minutes % 60;
    return rest == 0 ? '$hours h' : '$hours h $rest min';
  }
}

/// Present, missed, or cancelled — for one class, on one day.
///
/// This is the half the college portal cannot give: it publishes running
/// totals and republishes them irregularly, so between syncs a student's real
/// position drifts away from the one Handy can show. Marking a class closes
/// that gap immediately, and it is the only attendance figure in Handy the
/// student writes themselves.
///
/// Tapping the state a class is already in clears it. The fastest way to undo
/// a mistap should be to repeat it, not to hunt for a third control.
class _MarkRow extends StatelessWidget {
  const _MarkRow({required this.block, required this.state});

  final ClassBlock block;
  final AppState state;

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final current = state.markFor(block.first.subjectId, today, block.startTime);

    void mark(MarkStatus status) {
      HapticFeedback.selectionClick();
      repository.setMark(
        subjectId: block.first.subjectId,
        date: today,
        startTime: block.startTime,
        periods: block.periods,
        status: current?.status == status ? null : status,
      );
    }

    return Row(
      children: [
        _MarkChip(
          label: 'Present',
          icon: HugeIcons.strokeRoundedTick02,
          colour: HandyColors.good,
          selected: current?.status == MarkStatus.present,
          onTap: () => mark(MarkStatus.present),
        ),
        const SizedBox(width: 6),
        _MarkChip(
          label: 'Missed',
          icon: HugeIcons.strokeRoundedCancel01,
          colour: HandyColors.bad,
          selected: current?.status == MarkStatus.absent,
          onTap: () => mark(MarkStatus.absent),
        ),
        const SizedBox(width: 6),
        _MarkChip(
          label: 'Cancelled',
          icon: HugeIcons.strokeRoundedMinusSign,
          colour: Theme.of(context).textTheme.bodySmall?.color ?? Colors.grey,
          selected: current?.status == MarkStatus.cancelled,
          onTap: () => mark(MarkStatus.cancelled),
        ),
      ],
    );
  }
}

class _MarkChip extends StatelessWidget {
  const _MarkChip({
    required this.label,
    required this.icon,
    required this.colour,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final AppIconData icon;
  final Color colour;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(vertical: 7),
          decoration: BoxDecoration(
            color: selected ? colour.withValues(alpha: 0.16) : Colors.transparent,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected ? colour : Theme.of(context).dividerColor,
              width: selected ? 1.4 : 1,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AppIcon(
                icon,
                size: 13,
                color: selected ? colour : Theme.of(context).textTheme.bodySmall?.color,
              ),
              const SizedBox(width: 5),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    color: selected ? colour : Theme.of(context).textTheme.bodySmall?.color,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The nearest exam, counted down.
///
/// Exams are the one deadline where the number of days *is* the useful thing —
/// nobody needs reminding what an exam is, they need to know how long is left.
/// So it gets promoted out of the list rather than sitting in it as one more
/// row that reads like an assignment.
class _ExamCountdown extends StatelessWidget {
  const _ExamCountdown({required this.exam, required this.state});

  final Task exam;
  final AppState state;

  @override
  Widget build(BuildContext context) {
    final deadline = getDeadline(exam.dueDate, DateTime.now());
    final days = deadline.daysLeft;
    final subject = exam.subjectId == null ? null : state.subjectsById[exam.subjectId];
    // Under a week is the point at which it stops being a date and starts
    // being a countdown.
    final urgent = days <= 7;
    final colour = urgent ? HandyColors.bad : Theme.of(context).colorScheme.primary;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colour.withValues(alpha: 0.5), width: 1.4),
        color: colour.withValues(alpha: 0.07),
      ),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                days == 0 ? 'TODAY' : '$days',
                style: TextStyle(
                  fontSize: days == 0 ? 22 : 38,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -1.5,
                  height: 1,
                  color: colour,
                ),
              ),
              if (days > 0)
                Text(
                  days == 1 ? 'day' : 'days',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
            ],
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('EXAM', style: Theme.of(context).textTheme.labelSmall),
                const SizedBox(height: 4),
                Text(
                  exam.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (subject != null)
                  Text(subject.name, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// How far through the day you are, and what's left of it — context the class
/// list can't give at a glance.
class _DayProgress extends StatelessWidget {
  const _DayProgress({
    required this.done,
    required this.total,
    required this.free,
    required this.due,
  });

  final int done;
  final int total;
  final int free;
  final int due;

  @override
  Widget build(BuildContext context) {
    final left = total - done;

    return Column(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: total == 0 ? 0 : done / total,
            minHeight: 5,
            backgroundColor: Theme.of(context).dividerColor,
            valueColor: const AlwaysStoppedAnimation(HandyColors.orange),
          ),
        ),
        const SizedBox(height: 12),
        // Three counts rather than one sentence: the eye picks a number out of
        // a row faster than it reads a clause out of a line.
        Row(
          children: [
            _Chip(
              icon: HugeIcons.strokeRoundedClock01,
              value: left == 0 ? 'Done' : '$left',
              label: left == 0 ? 'for today' : 'left today',
            ),
            const SizedBox(width: 8),
            _Chip(icon: HugeIcons.strokeRoundedCoffee02, value: '$free', label: 'free'),
            const SizedBox(width: 8),
            _Chip(icon: HugeIcons.strokeRoundedFlag02, value: '$due', label: 'due soon'),
          ],
        ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.value, required this.label});

  final AppIconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).textTheme.bodySmall?.color;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Theme.of(context).dividerColor),
        ),
        child: Row(
          children: [
            AppIcon(icon, size: 14, color: muted),
            const SizedBox(width: 7),
            Flexible(
              child: RichText(
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                text: TextSpan(
                  children: [
                    TextSpan(
                      text: value,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                    TextSpan(text: ' $label', style: TextStyle(fontSize: 11.5, color: muted)),
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

/// The day as a timeline rather than a stack of cards.
///
/// A list of class cards is a set of facts; a timeline is the shape of the
/// day. The rail makes the gaps between classes visible — which is where free
/// periods actually live — and a marker sits at the current time so "where am
/// I in this" needs no arithmetic.
class _DayTimeline extends StatelessWidget {
  const _DayTimeline({required this.blocks, required this.state, required this.nowHm});

  final List<ClassBlock> blocks;
  final AppState state;
  final String nowHm;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    var markerPlaced = false;

    for (var i = 0; i < blocks.length; i++) {
      final block = blocks[i];
      final finished = block.endTime.compareTo(nowHm) < 0;
      final running = !finished && block.startTime.compareTo(nowHm) <= 0;

      // The marker goes in the gap before the first class still to come. Not
      // drawn during a class — the card itself is already showing progress,
      // and a second "now" would be saying it twice.
      if (!markerPlaced && !finished && !running) {
        rows.add(_NowMarker(time: nowHm));
        markerPlaced = true;
      }

      rows.add(
        _TimelineRow(
          block: block,
          subject: state.subjectsById[block.first.subjectId],
          finished: finished,
          running: running,
          last: i == blocks.length - 1,
          state: state,
        ),
      );

      if (running) markerPlaced = true;
    }

    return Column(children: rows);
  }
}

class _NowMarker extends StatelessWidget {
  const _NowMarker({required this.time});
  final String time;

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(
            width: 46,
            child: Text(
              time,
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: accent),
            ),
          ),
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
          ),
          Expanded(
            child: Container(height: 1.5, color: accent.withValues(alpha: 0.45)),
          ),
        ],
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({
    required this.block,
    required this.subject,
    required this.finished,
    required this.running,
    required this.last,
    required this.state,
  });

  /// Neither started nor over: nothing to record yet.
  bool get upcoming => !finished && !running;

  final ClassBlock block;
  final Subject? subject;
  final bool finished;
  final bool running;
  final bool last;
  final AppState state;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final muted = Theme.of(context).textTheme.bodySmall?.color;
    final entry = block.first;
    final place = [entry.room, entry.block]
        .whereType<String>()
        .where((p) => p.isNotEmpty)
        .join(' · ');

    final dotColour = running
        ? scheme.primary
        : finished
            ? Theme.of(context).dividerColor
            : scheme.primary.withValues(alpha: 0.4);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 46,
            child: Padding(
              padding: const EdgeInsets.only(top: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    block.startTime,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                      color: finished ? muted : null,
                    ),
                  ),
                  Text(block.endTime, style: TextStyle(fontSize: 11, color: muted)),
                ],
              ),
            ),
          ),
          // The rail. Its segment below the dot is what makes a gap between
          // classes read as a gap rather than as card spacing.
          SizedBox(
            width: 9,
            child: Column(
              children: [
                const SizedBox(height: 17),
                Container(
                  width: 9,
                  height: 9,
                  decoration: BoxDecoration(
                    color: running ? dotColour : Colors.transparent,
                    shape: BoxShape.circle,
                    border: Border.all(color: dotColour, width: 2),
                  ),
                ),
                if (!last)
                  Expanded(
                    child: Container(width: 1.5, color: Theme.of(context).dividerColor),
                  ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(left: 12, bottom: 10),
              child: Opacity(
                // Classes already finished fade back — they're context, not
                // something to act on.
                opacity: finished ? 0.45 : 1,
                child: Card(
                  margin: EdgeInsets.zero,
                  shape: running
                      ? RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                          side: BorderSide(color: scheme.primary, width: 1.6),
                        )
                      : null,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(20),
                    onTap: () => showClassSheet(
                      context,
                      block: block,
                      subject: subject,
                      state: state,
                      date: DateTime.now(),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  subject?.name ?? 'Class',
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.titleMedium,
                                ),
                              ),
                              if (block.isMerged)
                                Text(
                                  '${block.periods}p',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: muted,
                                  ),
                                ),
                            ],
                          ),
                          // Room, building and a faculty name never fit on one
                          // line, and the faculty name is the half that gets
                          // cut — so they go on separate lines rather than
                          // being joined into one that has to be truncated.
                          if (place.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              place,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(height: 1.3),
                            ),
                          ],
                          if (entry.facultyName.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              entry.facultyName,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(height: 1.3),
                            ),
                          ],
                          // Only once the class has started. Marking yourself
                          // present at a lecture that begins in three hours is
                          // a promise, not a record.
                          if (!upcoming) ...[
                            const SizedBox(height: 10),
                            _MarkRow(block: block, state: state),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The two or three subjects nearest the line, as a horizontal strip. Anything
/// comfortably above target isn't worth home-screen space.
class _AtRiskStrip extends StatelessWidget {
  const _AtRiskStrip({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final summaryBySubject = {for (final s in state.summaries) s.subjectId: s};

    final risky =
        state.subjects
            .map((subject) {
              final summary = summaryBySubject[subject.id];
              final percent = roundPercentage(
                calculateAttendance(summary?.attended ?? 0, summary?.held ?? 0),
              );
              return (subject: subject, summary: summary, percent: percent);
            })
            .where(
              (r) => r.percent != null && r.percent! < SubjectsScreen.target,
            )
            .toList()
          ..sort((a, b) => a.percent!.compareTo(b.percent!));

    if (risky.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Label('Needs attention · ${risky.length}'),
        const SizedBox(height: 8),
        SizedBox(
          // Sized to the tallest content this card can hold: a two-line
          // shortName plus the percentage plus the "need N more" line. 96 was
          // too tight and clipped by 17px on a real device.
          height: 122,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: risky.take(5).length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (context, i) {
              final row = risky[i];
              final colour = statusColour(row.percent);
              return GestureDetector(
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => SubjectDetailScreen(
                      subject: row.subject,
                      summary: row.summary,
                    ),
                  ),
                ),
                child: Container(
                  width: 148,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surface,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: colour.withValues(alpha: 0.45)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        row.subject.shortName.isEmpty
                            ? row.subject.name
                            : row.subject.shortName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        '${row.percent!.toStringAsFixed(2)}%',
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -1,
                          height: 1.1,
                          color: colour,
                        ),
                      ),
                      Text(
                        'need ${classesNeededForTarget(row.summary?.attended ?? 0, row.summary?.held ?? 0, SubjectsScreen.target)} more',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 20),
      ],
    );
  }
}

class _FreeTimeNote extends StatelessWidget {
  const _FreeTimeNote({required this.free});

  final List<FreePeriod> free;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Row(
        children: [
          AppIcon(
            HugeIcons.strokeRoundedCoffee02,
            size: 16,
            color: Theme.of(context).textTheme.bodySmall?.color,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '${free.length} free period${free.length == 1 ? '' : 's'} today · '
              '${free.map((f) => f.startTime).join(', ')}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}

class _DueRow extends StatelessWidget {
  const _DueRow({required this.task, required this.state});

  final Task task;
  final AppState state;

  @override
  Widget build(BuildContext context) {
    final deadline = getDeadline(task.dueDate, DateTime.now(), done: task.done);
    final urgent =
        deadline.urgency == Urgency.overdue ||
        deadline.urgency == Urgency.today;
    final colour = urgent ? HandyColors.bad : HandyColors.warn;
    final subject = task.subjectId == null
        ? null
        : state.subjectsById[task.subjectId];

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        // Opens the deadline. These were inert, which is the worst state for
        // something that looks exactly like the tappable rows on every other
        // screen — a card that ignores a tap reads as a broken app.
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => DeadlineDetailScreen(taskId: task.id),
            ),
          ),
          child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(width: 3, height: 32, color: colour),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      task.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    Text(
                      [taskKindLabels[task.kind], subject?.shortName]
                          .whereType<String>()
                          .where((s) => s.isNotEmpty)
                          .join(' · '),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                deadline.label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: colour,
                ),
              ),
            ],
          ),
        ),
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

class _Quiet extends StatelessWidget {
  const _Quiet(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 10),
    child: Text(text, style: Theme.of(context).textTheme.bodySmall),
  );
}
