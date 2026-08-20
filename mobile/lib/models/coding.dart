/// Competitive-programming practice — the phone's half of src/types/coding.ts.
///
/// A student's practice lives on five sites, none of which talk to each other.
/// Handy reads all five from one place using nothing but a public handle, never
/// a password: unlike CodeForge (see hub_attendance.dart) these profiles are
/// public, so there is no credential to hold and none is asked for.
///
/// Field names are the wire's, not Dart's, wherever the two disagree — these
/// documents are written by api/coding.js and read by both clients, and a
/// rename on one side is a field the other silently reads as null.
library;

enum CodingPlatform { leetcode, codeforces, codechef, gfg, hackerrank }

/// Display order, matching the web's CODING_PLATFORMS.
const codingPlatforms = <CodingPlatform>[
  CodingPlatform.leetcode,
  CodingPlatform.codeforces,
  CodingPlatform.codechef,
  CodingPlatform.gfg,
  CodingPlatform.hackerrank,
];

extension CodingPlatformMeta on CodingPlatform {
  /// The id on the wire. `gfg` and the rest already match, but this is written
  /// out rather than derived from `name` so a future rename cannot break the
  /// contract by accident.
  String get id => switch (this) {
        CodingPlatform.leetcode => 'leetcode',
        CodingPlatform.codeforces => 'codeforces',
        CodingPlatform.codechef => 'codechef',
        CodingPlatform.gfg => 'gfg',
        CodingPlatform.hackerrank => 'hackerrank',
      };

  String get label => switch (this) {
        CodingPlatform.leetcode => 'LeetCode',
        CodingPlatform.codeforces => 'Codeforces',
        CodingPlatform.codechef => 'CodeChef',
        CodingPlatform.gfg => 'GeeksforGeeks',
        CodingPlatform.hackerrank => 'HackerRank',
      };

  /// Kept word for word with PLATFORM_META's handleHint on the web.
  String get handleHint => switch (this) {
        CodingPlatform.leetcode => 'the name in leetcode.com/u/___',
        CodingPlatform.codeforces => 'the name in codeforces.com/profile/___',
        CodingPlatform.codechef => 'the name in codechef.com/users/___',
        CodingPlatform.gfg => 'the name in geeksforgeeks.org/user/___',
        CodingPlatform.hackerrank => 'the name in hackerrank.com/profile/___',
      };

  String profileUrl(String handle) {
    final encoded = Uri.encodeComponent(handle);
    return switch (this) {
      CodingPlatform.leetcode => 'https://leetcode.com/u/$encoded/',
      CodingPlatform.codeforces => 'https://codeforces.com/profile/$encoded',
      CodingPlatform.codechef => 'https://www.codechef.com/users/$encoded',
      CodingPlatform.gfg => 'https://www.geeksforgeeks.org/user/$encoded/',
      CodingPlatform.hackerrank => 'https://www.hackerrank.com/profile/$encoded',
    };
  }
}

/// Unknown ids read as null rather than throwing: a platform added on the
/// server should not crash a phone that has not been updated yet.
CodingPlatform? codingPlatformFromId(Object? id) {
  for (final platform in CodingPlatform.values) {
    if (platform.id == id) return platform;
  }
  return null;
}

enum ProblemDifficulty { easy, medium, hard }

ProblemDifficulty? difficultyFromId(Object? id) {
  return switch (id) {
    'easy' => ProblemDifficulty.easy,
    'medium' => ProblemDifficulty.medium,
    'hard' => ProblemDifficulty.hard,
    _ => null,
  };
}

class DifficultySplit {
  const DifficultySplit({required this.easy, required this.medium, required this.hard});

  final int easy;
  final int medium;
  final int hard;

  static DifficultySplit? fromMap(Object? raw) {
    if (raw is! Map) return null;
    return DifficultySplit(
      easy: _int(raw['easy']) ?? 0,
      medium: _int(raw['medium']) ?? 0,
      hard: _int(raw['hard']) ?? 0,
    );
  }
}

/// One platform's numbers at one moment.
///
/// Everything but the platform and the handle is nullable, and that is the
/// point: the five sites publish genuinely different things, and a zero where
/// a site simply does not publish a number would be a lie.
class PlatformStats {
  const PlatformStats({
    required this.platform,
    required this.handle,
    required this.displayName,
    required this.avatarUrl,
    required this.profileUrl,
    required this.solved,
    required this.byDifficulty,
    required this.rating,
    required this.maxRating,
    required this.rank,
    required this.globalRank,
    required this.contestsAttended,
    required this.currentStreak,
    required this.calendar,
    required this.error,
  });

  final CodingPlatform platform;
  final String handle;
  final String? displayName;
  final String? avatarUrl;
  final String profileUrl;
  final int? solved;
  final DifficultySplit? byDifficulty;
  final int? rating;
  final int? maxRating;
  final String? rank;
  final int? globalRank;
  final int? contestsAttended;
  final int? currentStreak;

  /// yyyy-MM-dd -> submissions that day. Only LeetCode publishes one.
  final Map<String, int>? calendar;

  /// Set when *this* platform failed while the others succeeded. Carried
  /// rather than thrown, so one dead site never blanks the whole screen.
  final String? error;

  static PlatformStats? fromMap(Map<String, dynamic> map) {
    final platform = codingPlatformFromId(map['platform']);
    if (platform == null) return null;

    final rawCalendar = map['calendar'];
    Map<String, int>? calendar;
    if (rawCalendar is Map) {
      calendar = {
        for (final entry in rawCalendar.entries)
          if (_int(entry.value) != null) '${entry.key}': _int(entry.value)!,
      };
    }

    final handle = '${map['handle'] ?? ''}';
    return PlatformStats(
      platform: platform,
      handle: handle,
      displayName: map['displayName'] as String?,
      avatarUrl: map['avatarUrl'] as String?,
      profileUrl: (map['profileUrl'] as String?) ?? platform.profileUrl(handle),
      solved: _int(map['solved']),
      byDifficulty: DifficultySplit.fromMap(map['byDifficulty']),
      rating: _int(map['rating']),
      maxRating: _int(map['maxRating']),
      rank: map['rank'] as String?,
      globalRank: _int(map['globalRank']),
      contestsAttended: _int(map['contestsAttended']),
      currentStreak: _int(map['currentStreak']),
      calendar: calendar,
      error: map['error'] as String?,
    );
  }
}

/// An accepted submission read back off a platform.
class RecentSolve {
  const RecentSolve({
    required this.platform,
    required this.title,
    required this.url,
    required this.difficulty,
    required this.language,
    required this.solvedAt,
    required this.tags,
  });

  final CodingPlatform platform;
  final String title;
  final String url;
  final ProblemDifficulty? difficulty;
  final String? language;
  final DateTime solvedAt;
  final List<String> tags;

  static RecentSolve? fromMap(Map<String, dynamic> map) {
    final platform = codingPlatformFromId(map['platform']);
    final solvedAt = DateTime.tryParse('${map['solvedAt']}');
    if (platform == null || solvedAt == null) return null;
    return RecentSolve(
      platform: platform,
      title: '${map['title'] ?? ''}',
      url: '${map['url'] ?? ''}',
      difficulty: difficultyFromId(map['difficulty']),
      language: map['language'] as String?,
      // Stored as UTC on the wire; a solve is shown against the student's own
      // day, so it is converted once here rather than at each call site.
      solvedAt: solvedAt.toLocal(),
      tags: [for (final tag in (map['tags'] as List? ?? [])) '$tag'],
    );
  }
}

/// A student's practice setup and their latest snapshot — `codingProfiles/{uid}`.
///
/// Read-only to the phone. Everything here is written by api/coding.js with the
/// Admin SDK, because `totalSolved` decides a leaderboard position and a client
/// that could write its own solved count could win.
class CodingProfile {
  const CodingProfile({
    required this.handles,
    required this.stats,
    required this.recent,
    required this.totalSolved,
    required this.weeklyTarget,
    required this.shareToLeaderboard,
    required this.refreshedAt,
  });

  final Map<CodingPlatform, String> handles;
  final List<PlatformStats> stats;
  final List<RecentSolve> recent;
  final int totalSolved;
  final int weeklyTarget;
  final bool shareToLeaderboard;
  final DateTime? refreshedAt;

  static const empty = CodingProfile(
    handles: {},
    stats: [],
    recent: [],
    totalSolved: 0,
    weeklyTarget: 0,
    shareToLeaderboard: true,
    refreshedAt: null,
  );

  bool get isLinked => handles.isNotEmpty;

  factory CodingProfile.fromMap(Map<String, dynamic> map) {
    final rawHandles = map['handles'];
    final handles = <CodingPlatform, String>{};
    if (rawHandles is Map) {
      for (final entry in rawHandles.entries) {
        final platform = codingPlatformFromId(entry.key);
        final handle = '${entry.value ?? ''}'.trim();
        if (platform != null && handle.isNotEmpty) handles[platform] = handle;
      }
    }

    return CodingProfile(
      handles: handles,
      stats: [
        for (final raw in (map['stats'] as List? ?? []))
          if (raw is Map) PlatformStats.fromMap(raw.cast<String, dynamic>()),
      ].whereType<PlatformStats>().toList(),
      recent: [
        for (final raw in (map['recent'] as List? ?? []))
          if (raw is Map) RecentSolve.fromMap(raw.cast<String, dynamic>()),
      ].whereType<RecentSolve>().toList(),
      totalSolved: _int(map['totalSolved']) ?? 0,
      weeklyTarget: _int(map['weeklyTarget']) ?? 0,
      shareToLeaderboard: map['shareToLeaderboard'] != false,
      refreshedAt: DateTime.tryParse('${map['refreshedAt']}')?.toLocal(),
    );
  }
}

class CodingProfileResult {
  const CodingProfileResult({
    required this.linked,
    required this.profile,
    this.rateLimited = false,
  });

  final bool linked;
  final CodingProfile profile;

  /// True when a refresh was asked for but the hourly budget was already spent
  /// — the snapshot is real, just not new.
  final bool rateLimited;
}

enum ComplexitySource { ai, manual }

enum ComplexityConfidence { high, medium, low }

/// What a solution costs, in time and space.
///
/// No platform publishes this — LeetCode's "beats 84%" is one machine on one
/// day, not a bound — so it is read off the code itself. [source] records
/// whether the stored answer is the model's or the student's, and the UI never
/// presents an estimate as fact.
class ComplexityVerdict {
  const ComplexityVerdict({
    required this.time,
    required this.space,
    required this.confidence,
    required this.explanation,
    required this.bottleneck,
    required this.betterApproach,
    required this.source,
    required this.model,
    required this.analyzedAt,
  });

  final String time;
  final String space;
  final ComplexityConfidence confidence;
  final String explanation;
  final String? bottleneck;
  final String? betterApproach;
  final ComplexitySource source;
  final String? model;
  final String analyzedAt;

  bool get isEstimate => source == ComplexitySource.ai;

  ComplexityVerdict copyWith({String? time, String? space}) => ComplexityVerdict(
        time: time ?? this.time,
        space: space ?? this.space,
        confidence: confidence,
        explanation: explanation,
        bottleneck: bottleneck,
        betterApproach: betterApproach,
        // Editing either bound makes the verdict the student's own — the same
        // rule SolutionForm.tsx applies, and the reason the badge can be
        // trusted to mean what it says.
        source: ComplexitySource.manual,
        model: (time == null && space == null) ? model : null,
        analyzedAt: analyzedAt,
      );

  static ComplexityVerdict? fromMap(Object? raw) {
    if (raw is! Map) return null;
    final map = raw.cast<String, dynamic>();
    final time = '${map['time'] ?? ''}'.trim();
    final space = '${map['space'] ?? ''}'.trim();
    if (time.isEmpty || space.isEmpty) return null;

    return ComplexityVerdict(
      time: time,
      space: space,
      confidence: switch (map['confidence']) {
        'high' => ComplexityConfidence.high,
        'low' => ComplexityConfidence.low,
        _ => ComplexityConfidence.medium,
      },
      explanation: '${map['explanation'] ?? ''}',
      bottleneck: map['bottleneck'] as String?,
      betterApproach: map['betterApproach'] as String?,
      source: map['source'] == 'manual' ? ComplexitySource.manual : ComplexitySource.ai,
      model: map['model'] as String?,
      analyzedAt: '${map['analyzedAt'] ?? ''}',
    );
  }

  Map<String, Object?> toMap() => {
        'time': time,
        'space': space,
        'confidence': confidence.name,
        'explanation': explanation,
        'bottleneck': bottleneck,
        'betterApproach': betterApproach,
        'source': source.name,
        'model': model,
        'analyzedAt': analyzedAt,
      };
}

/// One solved problem the student kept — `codingSolutions/{id}`.
///
/// Student-owned, exactly like tasks: a platform will tell you *that*
/// something was solved, never *how*.
class CodingSolution {
  const CodingSolution({
    required this.id,
    required this.platform,
    required this.title,
    required this.url,
    required this.difficulty,
    required this.language,
    required this.code,
    required this.notes,
    required this.complexity,
    required this.solvedAt,
  });

  final String id;
  final CodingPlatform platform;
  final String title;
  final String url;
  final ProblemDifficulty? difficulty;
  final String language;
  final String code;
  final String notes;
  final ComplexityVerdict? complexity;

  /// The calendar day, which is what the streak and the heatmap count.
  final String solvedAt;

  factory CodingSolution.fromMap(String id, Map<String, dynamic> map) => CodingSolution(
        id: id,
        platform: codingPlatformFromId(map['platform']) ?? CodingPlatform.leetcode,
        title: '${map['title'] ?? ''}',
        url: '${map['url'] ?? ''}',
        difficulty: difficultyFromId(map['difficulty']),
        language: '${map['language'] ?? ''}',
        code: '${map['code'] ?? ''}',
        notes: '${map['notes'] ?? ''}',
        complexity: ComplexityVerdict.fromMap(map['complexity']),
        solvedAt: '${map['solvedAt'] ?? ''}',
      );
}

class ContestItem {
  const ContestItem({
    required this.platform,
    required this.name,
    required this.url,
    required this.startsAt,
    required this.durationMinutes,
  });

  final CodingPlatform platform;
  final String name;
  final String url;
  final DateTime startsAt;
  final int? durationMinutes;

  static ContestItem? fromMap(Map<String, dynamic> map) {
    final platform = codingPlatformFromId(map['platform']);
    final startsAt = DateTime.tryParse('${map['startsAt']}');
    if (platform == null || startsAt == null) return null;
    return ContestItem(
      platform: platform,
      name: '${map['name'] ?? ''}',
      url: '${map['url'] ?? ''}',
      startsAt: startsAt.toLocal(),
      durationMinutes: _int(map['durationMinutes']),
    );
  }
}

class DailyProblem {
  const DailyProblem({
    required this.title,
    required this.url,
    required this.difficulty,
    required this.tags,
    required this.date,
  });

  final String title;
  final String url;
  final ProblemDifficulty? difficulty;
  final List<String> tags;
  final String date;

  static DailyProblem? fromMap(Object? raw) {
    if (raw is! Map) return null;
    final map = raw.cast<String, dynamic>();
    final title = '${map['title'] ?? ''}';
    if (title.isEmpty) return null;
    return DailyProblem(
      title: title,
      url: '${map['url'] ?? ''}',
      difficulty: difficultyFromId(map['difficulty']),
      tags: [for (final tag in (map['tags'] as List? ?? [])) '$tag'],
      date: '${map['date'] ?? ''}',
    );
  }
}

class LeaderboardEntry {
  const LeaderboardEntry({
    required this.rollNumber,
    required this.name,
    required this.totalSolved,
    required this.isMe,
  });

  final String rollNumber;
  final String name;
  final int totalSolved;
  final bool isMe;

  factory LeaderboardEntry.fromMap(Map<String, dynamic> map) => LeaderboardEntry(
        rollNumber: '${map['rollNumber'] ?? ''}',
        name: '${map['name'] ?? ''}',
        totalSolved: _int(map['totalSolved']) ?? 0,
        isMe: map['isMe'] == true,
      );
}

/// JSON numbers arrive as int or double depending on the platform and the
/// encoder; both are counts here.
int? _int(Object? value) {
  if (value is int) return value;
  if (value is double) return value.round();
  if (value is String) return int.tryParse(value);
  return null;
}
