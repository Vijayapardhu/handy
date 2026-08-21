/// Topic mastery — a straight port of src/constants/dsaTopics.ts and
/// src/lib/calculations/mastery.ts, kept rule-for-rule identical so a topic
/// that reads "Strong" on the phone never reads "Practicing" on the website
/// for the same solve log.
///
/// The scoring formula only combines what Handy genuinely has data for —
/// exposure and recency, difficulty-weighted — not the full nine-signal
/// formula a fuller product spec describes. There is no failed-submission
/// log, no per-topic contest linkage, and no ground-truth "optimal
/// complexity" to grade a stored verdict against, so nothing here pretends
/// to measure success rate, contest performance or complexity quality. See
/// the web file's module doc for the full reasoning.
library;

import '../models/coding.dart';

enum DsaTopic {
  arrays,
  strings,
  hashing,
  twoPointers,
  slidingWindow,
  binarySearch,
  stack,
  queue,
  linkedList,
  trees,
  bst,
  heap,
  graphs,
  bfs,
  dfs,
  greedy,
  backtracking,
  dp,
  bitManipulation,
  numberTheory,
  prefixSum,
  unionFind,
  segmentTree,
  trie,
  advancedGraph,
}

extension DsaTopicMeta on DsaTopic {
  /// The id on the wire — written out rather than derived from `name` so a
  /// future rename in Dart can never silently disagree with the documents
  /// the web app already wrote.
  String get id => switch (this) {
        DsaTopic.arrays => 'arrays',
        DsaTopic.strings => 'strings',
        DsaTopic.hashing => 'hashing',
        DsaTopic.twoPointers => 'two-pointers',
        DsaTopic.slidingWindow => 'sliding-window',
        DsaTopic.binarySearch => 'binary-search',
        DsaTopic.stack => 'stack',
        DsaTopic.queue => 'queue',
        DsaTopic.linkedList => 'linked-list',
        DsaTopic.trees => 'trees',
        DsaTopic.bst => 'bst',
        DsaTopic.heap => 'heap',
        DsaTopic.graphs => 'graphs',
        DsaTopic.bfs => 'bfs',
        DsaTopic.dfs => 'dfs',
        DsaTopic.greedy => 'greedy',
        DsaTopic.backtracking => 'backtracking',
        DsaTopic.dp => 'dp',
        DsaTopic.bitManipulation => 'bit-manipulation',
        DsaTopic.numberTheory => 'number-theory',
        DsaTopic.prefixSum => 'prefix-sum',
        DsaTopic.unionFind => 'union-find',
        DsaTopic.segmentTree => 'segment-tree',
        DsaTopic.trie => 'trie',
        DsaTopic.advancedGraph => 'advanced-graph',
      };

  String get label => switch (this) {
        DsaTopic.arrays => 'Arrays',
        DsaTopic.strings => 'Strings',
        DsaTopic.hashing => 'Hashing',
        DsaTopic.twoPointers => 'Two Pointers',
        DsaTopic.slidingWindow => 'Sliding Window',
        DsaTopic.binarySearch => 'Binary Search',
        DsaTopic.stack => 'Stack',
        DsaTopic.queue => 'Queue',
        DsaTopic.linkedList => 'Linked List',
        DsaTopic.trees => 'Trees',
        DsaTopic.bst => 'BST',
        DsaTopic.heap => 'Heap',
        DsaTopic.graphs => 'Graphs',
        DsaTopic.bfs => 'BFS',
        DsaTopic.dfs => 'DFS',
        DsaTopic.greedy => 'Greedy',
        DsaTopic.backtracking => 'Backtracking',
        DsaTopic.dp => 'Dynamic Programming',
        DsaTopic.bitManipulation => 'Bit Manipulation',
        DsaTopic.numberTheory => 'Number Theory',
        DsaTopic.prefixSum => 'Prefix Sum',
        DsaTopic.unionFind => 'Union Find',
        DsaTopic.segmentTree => 'Segment Tree',
        DsaTopic.trie => 'Trie',
        DsaTopic.advancedGraph => 'Advanced Graphs',
      };
}

/// Display order, and the default learning-path order nextFocusTopic() walks.
const dsaTopics = <DsaTopic>[
  DsaTopic.arrays,
  DsaTopic.strings,
  DsaTopic.hashing,
  DsaTopic.twoPointers,
  DsaTopic.slidingWindow,
  DsaTopic.binarySearch,
  DsaTopic.stack,
  DsaTopic.queue,
  DsaTopic.linkedList,
  DsaTopic.trees,
  DsaTopic.bst,
  DsaTopic.heap,
  DsaTopic.bfs,
  DsaTopic.dfs,
  DsaTopic.graphs,
  DsaTopic.greedy,
  DsaTopic.backtracking,
  DsaTopic.dp,
  DsaTopic.bitManipulation,
  DsaTopic.prefixSum,
  DsaTopic.unionFind,
  DsaTopic.numberTheory,
  DsaTopic.segmentTree,
  DsaTopic.trie,
  DsaTopic.advancedGraph,
];

DsaTopic? _dsaTopicFromId(String id) {
  for (final topic in dsaTopics) {
    if (topic.id == id) return topic;
  }
  return null;
}

/// Codeforces' own tag vocabulary, lowercased, mapped to the canonical set.
/// Deliberately partial — see the web file's comment on why a style tag like
/// "brute force" or "constructive algorithms" maps to nothing rather than
/// being forced onto a DSA topic it was never claiming to be.
const _codeforcesTagMap = <String, DsaTopic>{
  'data structures': DsaTopic.arrays,
  'strings': DsaTopic.strings,
  'string suffix structures': DsaTopic.strings,
  'hashing': DsaTopic.hashing,
  'two pointers': DsaTopic.twoPointers,
  'binary search': DsaTopic.binarySearch,
  'dfs and similar': DsaTopic.dfs,
  'trees': DsaTopic.trees,
  'graphs': DsaTopic.graphs,
  'shortest paths': DsaTopic.graphs,
  'graph matchings': DsaTopic.advancedGraph,
  'flows': DsaTopic.advancedGraph,
  'greedy': DsaTopic.greedy,
  'dp': DsaTopic.dp,
  'divide and conquer': DsaTopic.backtracking,
  'bitmasks': DsaTopic.bitManipulation,
  'number theory': DsaTopic.numberTheory,
  'chinese remainder theorem': DsaTopic.numberTheory,
  'dsu': DsaTopic.unionFind,
  '*special': DsaTopic.advancedGraph,
};

/// LeetCode's own topicTags. Not wired to a live fetch yet — LeetCode's
/// recent-submission list carries no tags today (see RecentSolve.tags) — kept
/// ready so a future fetch of per-problem tags has a normaliser already here.
const _leetcodeTagMap = <String, DsaTopic>{
  'array': DsaTopic.arrays,
  'string': DsaTopic.strings,
  'hash table': DsaTopic.hashing,
  'two pointers': DsaTopic.twoPointers,
  'sliding window': DsaTopic.slidingWindow,
  'binary search': DsaTopic.binarySearch,
  'stack': DsaTopic.stack,
  'queue': DsaTopic.queue,
  'linked list': DsaTopic.linkedList,
  'tree': DsaTopic.trees,
  'binary tree': DsaTopic.trees,
  'binary search tree': DsaTopic.bst,
  'heap (priority queue)': DsaTopic.heap,
  'graph': DsaTopic.graphs,
  'breadth-first search': DsaTopic.bfs,
  'depth-first search': DsaTopic.dfs,
  'greedy': DsaTopic.greedy,
  'backtracking': DsaTopic.backtracking,
  'dynamic programming': DsaTopic.dp,
  'bit manipulation': DsaTopic.bitManipulation,
  'prefix sum': DsaTopic.prefixSum,
  'union find': DsaTopic.unionFind,
  'segment tree': DsaTopic.segmentTree,
  'trie': DsaTopic.trie,
};

/// A platform's own raw tag, normalised to a canonical topic — or null when
/// it names no real DSA topic, or the platform has no tag map at all.
DsaTopic? normaliseTopic(CodingPlatform platform, String rawTag) {
  final map = switch (platform) {
    CodingPlatform.codeforces => _codeforcesTagMap,
    CodingPlatform.leetcode => _leetcodeTagMap,
    _ => null,
  };
  if (map == null) return null;
  return map[rawTag.trim().toLowerCase()];
}

/// Every raw tag a solve carries, reduced to the distinct canonical topics.
List<String> topicsFromTags(CodingPlatform platform, List<String> rawTags) {
  final found = <DsaTopic>{};
  for (final tag in rawTags) {
    final topic = normaliseTopic(platform, tag);
    if (topic != null) found.add(topic);
  }
  return [for (final topic in found) topic.id];
}

enum MasteryBand { starting, learning, practicing, strong, advanced, mastered }

extension MasteryBandLabel on MasteryBand {
  String get label => switch (this) {
        MasteryBand.starting => 'Starting',
        MasteryBand.learning => 'Learning',
        MasteryBand.practicing => 'Practicing',
        MasteryBand.strong => 'Strong',
        MasteryBand.advanced => 'Advanced',
        MasteryBand.mastered => 'Mastered',
      };
}

MasteryBand bandFor(int percent) {
  if (percent >= 95) return MasteryBand.mastered;
  if (percent >= 80) return MasteryBand.advanced;
  if (percent >= 60) return MasteryBand.strong;
  if (percent >= 40) return MasteryBand.practicing;
  if (percent >= 20) return MasteryBand.learning;
  return MasteryBand.starting;
}

class TopicMastery {
  const TopicMastery({
    required this.topic,
    required this.solved,
    required this.easy,
    required this.medium,
    required this.hard,
    required this.percent,
    required this.band,
    required this.lastSolvedAt,
  });

  final DsaTopic topic;
  final int solved;
  final int easy;
  final int medium;
  final int hard;
  final int percent;
  final MasteryBand band;
  final String lastSolvedAt;
}

int _difficultyWeight(ProblemDifficulty? difficulty) => switch (difficulty) {
      ProblemDifficulty.hard => 3,
      ProblemDifficulty.medium => 2,
      // Easy and "not recorded" are treated the same on purpose — an unknown
      // difficulty should not quietly earn the medium-tier weight it happens
      // to sit next to in this switch.
      _ => 1,
    };

DateTime _utcDay(String iso) {
  final parts = iso.split('-');
  return DateTime.utc(
    int.tryParse(parts.elementAtOrNull(0) ?? '') ?? 1970,
    int.tryParse(parts.elementAtOrNull(1) ?? '') ?? 1,
    int.tryParse(parts.elementAtOrNull(2) ?? '') ?? 1,
  );
}

/// 1.0 within the last 90 days, decaying in a straight line to a 0.4 floor by
/// the one-year mark, and staying at that floor after.
double _recencyWeight(String solvedAtIso, String todayIso) {
  final days = _utcDay(todayIso).difference(_utcDay(solvedAtIso)).inDays.toDouble();
  final clamped = days < 0 ? 0.0 : days;
  if (clamped <= 90) return 1;
  if (clamped >= 365) return 0.4;
  return 1 - 0.6 * ((clamped - 90) / (365 - 90));
}

/// Weighted points needed to reach 100% — see the module doc for what
/// "weighted" means.
const _pointsForFullMastery = 20;

/// Every canonical topic with at least one tagged solve, most-practiced first.
List<TopicMastery> computeTopicMastery(List<CodingSolution> solutions, String todayIso) {
  final byTopic = <DsaTopic, ({double points, int easy, int medium, int hard, int count, String lastSolvedAt})>{};

  for (final solution in solutions) {
    if (solution.solvedAt.isEmpty) continue;
    final weight = _difficultyWeight(solution.difficulty) * _recencyWeight(solution.solvedAt, todayIso);

    for (final rawTopic in solution.topics) {
      final topic = _dsaTopicFromId(rawTopic);
      if (topic == null) continue; // a stale/unknown id from a future app version — skip, don't crash

      final existing = byTopic[topic];
      final easy = (existing?.easy ?? 0) + (solution.difficulty == ProblemDifficulty.easy || solution.difficulty == null ? 1 : 0);
      final medium = (existing?.medium ?? 0) + (solution.difficulty == ProblemDifficulty.medium ? 1 : 0);
      final hard = (existing?.hard ?? 0) + (solution.difficulty == ProblemDifficulty.hard ? 1 : 0);
      final lastSolvedAt = existing == null || solution.solvedAt.compareTo(existing.lastSolvedAt) > 0
          ? solution.solvedAt
          : existing.lastSolvedAt;

      byTopic[topic] = (
        points: (existing?.points ?? 0) + weight,
        easy: easy,
        medium: medium,
        hard: hard,
        count: (existing?.count ?? 0) + 1,
        lastSolvedAt: lastSolvedAt,
      );
    }
  }

  final result = [
    for (final entry in byTopic.entries)
      () {
        final percent = (entry.value.points / _pointsForFullMastery * 100).round().clamp(0, 100);
        return TopicMastery(
          topic: entry.key,
          solved: entry.value.count,
          easy: entry.value.easy,
          medium: entry.value.medium,
          hard: entry.value.hard,
          percent: percent,
          band: bandFor(percent),
          lastSolvedAt: entry.value.lastSolvedAt,
        );
      }(),
  ];

  result.sort((a, b) {
    final byPercent = b.percent.compareTo(a.percent);
    return byPercent != 0 ? byPercent : b.solved.compareTo(a.solved);
  });
  return result;
}

/// The weakest topic actually worth calling a weakness — needs at least two
/// tagged solves, so one unlucky hard problem can't brand a topic "weak" off
/// a single data point. Null when nothing qualifies yet.
TopicMastery? weakestTopic(List<TopicMastery> masteries) {
  final candidates = masteries.where((m) => m.solved >= 2).toList();
  if (candidates.isEmpty) return null;
  return candidates.reduce((worst, entry) => entry.percent < worst.percent ? entry : worst);
}

/// What to focus on next. Prefers a canonical topic with zero exposure, in
/// the curated learning-path order dsaTopics is written in; once every topic
/// has at least one solve, falls back to the weakest one.
DsaTopic? nextFocusTopic(List<TopicMastery> masteries) {
  final touched = masteries.map((m) => m.topic).toSet();
  for (final topic in dsaTopics) {
    if (!touched.contains(topic)) return topic;
  }
  return weakestTopic(masteries)?.topic;
}
