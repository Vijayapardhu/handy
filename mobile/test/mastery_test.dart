import 'package:flutter_test/flutter_test.dart';
import 'package:handy/logic/mastery.dart';
import 'package:handy/models/coding.dart';

const _today = '2026-08-20';

CodingSolution _solution(
  String id,
  String solvedAt,
  List<String> topics, {
  ProblemDifficulty? difficulty = ProblemDifficulty.medium,
}) {
  return CodingSolution(
    id: id,
    platform: CodingPlatform.codeforces,
    title: id,
    url: '',
    difficulty: difficulty,
    language: 'C++',
    code: '',
    notes: '',
    complexity: null,
    topics: topics,
    solvedAt: solvedAt,
  );
}

void main() {
  group('normaliseTopic', () {
    test('maps real Codeforces tags to the canonical set', () {
      expect(normaliseTopic(CodingPlatform.codeforces, 'dp'), DsaTopic.dp);
      expect(normaliseTopic(CodingPlatform.codeforces, 'two pointers'), DsaTopic.twoPointers);
      expect(normaliseTopic(CodingPlatform.codeforces, 'DSU'), DsaTopic.unionFind);
    });

    test('is case-insensitive and trims whitespace', () {
      expect(normaliseTopic(CodingPlatform.codeforces, '  Greedy  '), DsaTopic.greedy);
    });

    test('returns null for a style tag with no DSA-topic equivalent', () {
      expect(normaliseTopic(CodingPlatform.codeforces, 'constructive algorithms'), isNull);
      expect(normaliseTopic(CodingPlatform.codeforces, 'brute force'), isNull);
    });

    test('returns null for a platform with no tag map at all', () {
      expect(normaliseTopic(CodingPlatform.codechef, 'dp'), isNull);
      expect(normaliseTopic(CodingPlatform.gfg, 'graphs'), isNull);
    });
  });

  group('topicsFromTags', () {
    test('de-duplicates when two raw tags map to the same canonical topic', () {
      expect(
        topicsFromTags(CodingPlatform.codeforces, ['graphs', 'shortest paths']),
        ['graphs'],
      );
    });

    test('drops unmapped tags silently rather than erroring', () {
      expect(topicsFromTags(CodingPlatform.codeforces, ['implementation', 'dp']), ['dp']);
    });
  });

  group('bandFor', () {
    test('matches the stated bands exactly', () {
      expect(bandFor(0), MasteryBand.starting);
      expect(bandFor(19), MasteryBand.starting);
      expect(bandFor(20), MasteryBand.learning);
      expect(bandFor(39), MasteryBand.learning);
      expect(bandFor(40), MasteryBand.practicing);
      expect(bandFor(59), MasteryBand.practicing);
      expect(bandFor(60), MasteryBand.strong);
      expect(bandFor(79), MasteryBand.strong);
      expect(bandFor(80), MasteryBand.advanced);
      expect(bandFor(94), MasteryBand.advanced);
      expect(bandFor(95), MasteryBand.mastered);
      expect(bandFor(100), MasteryBand.mastered);
    });
  });

  group('computeTopicMastery', () {
    test('is empty with nothing solved', () {
      expect(computeTopicMastery([], _today), isEmpty);
    });

    test('ignores an untagged solve entirely', () {
      expect(computeTopicMastery([_solution('a', _today, [])], _today), isEmpty);
    });

    test('counts one solve toward every topic it is tagged with', () {
      final result = computeTopicMastery([
        _solution('a', _today, ['dp', 'graphs']),
      ], _today);
      expect(result.map((r) => r.topic).toSet(), {DsaTopic.dp, DsaTopic.graphs});
      expect(result.every((r) => r.solved == 1), isTrue);
    });

    test('weighs hard above medium above easy', () {
      final easy = computeTopicMastery(
        [_solution('a', _today, ['dp'], difficulty: ProblemDifficulty.easy)],
        _today,
      )[0]
          .percent;
      final medium = computeTopicMastery(
        [_solution('b', _today, ['dp'], difficulty: ProblemDifficulty.medium)],
        _today,
      )[0]
          .percent;
      final hard = computeTopicMastery(
        [_solution('c', _today, ['dp'], difficulty: ProblemDifficulty.hard)],
        _today,
      )[0]
          .percent;
      expect(easy, lessThan(medium));
      expect(medium, lessThan(hard));
    });

    test('treats an unrecorded difficulty the same as easy', () {
      final unset = computeTopicMastery(
        [_solution('a', _today, ['dp'], difficulty: null)],
        _today,
      )[0]
          .percent;
      final easy = computeTopicMastery(
        [_solution('b', _today, ['dp'], difficulty: ProblemDifficulty.easy)],
        _today,
      )[0]
          .percent;
      expect(unset, easy);
    });

    test('weighs a recent solve above an old one', () {
      final recent = computeTopicMastery(
        [_solution('a', _today, ['dp'], difficulty: ProblemDifficulty.hard)],
        _today,
      )[0]
          .percent;
      final old = computeTopicMastery(
        [_solution('b', '2024-01-01', ['dp'], difficulty: ProblemDifficulty.hard)],
        _today,
      )[0]
          .percent;
      expect(recent, greaterThan(old));
    });

    test('never exceeds 100 no matter how much is solved', () {
      final many = [
        for (var i = 0; i < 50; i++) _solution('a$i', _today, ['dp'], difficulty: ProblemDifficulty.hard),
      ];
      expect(computeTopicMastery(many, _today)[0].percent, 100);
    });

    test('reports the real difficulty split alongside the score', () {
      final solutions = [
        _solution('a', _today, ['arrays'], difficulty: ProblemDifficulty.easy),
        _solution('b', _today, ['arrays'], difficulty: ProblemDifficulty.easy),
        _solution('c', _today, ['arrays'], difficulty: ProblemDifficulty.hard),
      ];
      final entry = computeTopicMastery(solutions, _today)[0];
      expect(entry.easy, 2);
      expect(entry.medium, 0);
      expect(entry.hard, 1);
    });

    test('sorts most-practiced first', () {
      final solutions = [
        _solution('a', _today, ['arrays'], difficulty: ProblemDifficulty.easy),
        _solution('b', _today, ['graphs'], difficulty: ProblemDifficulty.hard),
        _solution('c', _today, ['graphs'], difficulty: ProblemDifficulty.hard),
      ];
      expect(computeTopicMastery(solutions, _today)[0].topic, DsaTopic.graphs);
    });

    test('ignores a topic id that is not in the current canonical list', () {
      final weird = _solution('a', _today, ['some-future-topic-id']);
      expect(computeTopicMastery([weird], _today), isEmpty);
    });
  });

  group('weakestTopic', () {
    test('requires at least two solves before calling a topic weak', () {
      final oneOff = computeTopicMastery(
        [_solution('a', _today, ['dp'], difficulty: ProblemDifficulty.easy)],
        _today,
      );
      expect(weakestTopic(oneOff), isNull);
    });

    test('picks the lowest-percent topic once it qualifies', () {
      final solutions = [
        _solution('a', _today, ['arrays'], difficulty: ProblemDifficulty.hard),
        _solution('b', _today, ['arrays'], difficulty: ProblemDifficulty.hard),
        _solution('c', _today, ['graphs'], difficulty: ProblemDifficulty.easy),
        _solution('d', _today, ['graphs'], difficulty: ProblemDifficulty.easy),
      ];
      expect(weakestTopic(computeTopicMastery(solutions, _today))?.topic, DsaTopic.graphs);
    });

    test('is null with nothing solved', () {
      expect(weakestTopic([]), isNull);
    });
  });

  group('nextFocusTopic', () {
    test('recommends the first untouched topic in the curated order', () {
      final solutions = [
        for (var i = 2; i < dsaTopics.length; i++)
          _solution('s$i', _today, [dsaTopics[i].id], difficulty: ProblemDifficulty.medium),
      ];
      expect(nextFocusTopic(computeTopicMastery(solutions, _today)), dsaTopics[0]);
    });

    test('recommends the very first curated topic for a student who has solved nothing', () {
      expect(nextFocusTopic([]), dsaTopics[0]);
    });
  });

  group('roadmapMastery', () {
    test('returns every canonical topic, not just the ones with exposure', () {
      final roadmap = roadmapMastery([], _today);
      expect(roadmap, hasLength(dsaTopics.length));
      expect(roadmap.map((entry) => entry.topic), dsaTopics);
    });

    test('fills an untouched topic with a real zero rather than leaving it out', () {
      final roadmap = roadmapMastery([], _today);
      final first = roadmap[0];
      expect(first.topic, dsaTopics[0]);
      expect(first.solved, 0);
      expect(first.easy, 0);
      expect(first.medium, 0);
      expect(first.hard, 0);
      expect(first.percent, 0);
      expect(first.band, MasteryBand.starting);
      expect(first.lastSolvedAt, isEmpty);
    });

    test('carries the real computed entry through for a topic with exposure', () {
      final solutions = [_solution('s1', _today, [dsaTopics[0].id], difficulty: ProblemDifficulty.hard)];
      final roadmap = roadmapMastery(solutions, _today);
      expect(roadmap[0].solved, 1);
      expect(roadmap[0].hard, 1);
      expect(roadmap[0].percent, greaterThan(0));
    });

    test('stays in curated order regardless of solve order', () {
      final solutions = [
        _solution('s1', _today, [dsaTopics[10].id]),
        _solution('s2', _today, [dsaTopics[2].id]),
      ];
      final roadmap = roadmapMastery(solutions, _today);
      expect(roadmap.map((entry) => entry.topic), dsaTopics);
    });
  });

  group('topicResourceLinks', () {
    test('builds a real LeetCode tag URL for a topic the tag map actually reaches', () {
      expect(topicResourceLinks(DsaTopic.dp).leetcode, 'https://leetcode.com/tag/dynamic-programming/');
      expect(
        topicResourceLinks(DsaTopic.twoPointers).leetcode,
        'https://leetcode.com/tag/two-pointers/',
      );
    });

    test('builds a real Codeforces tag URL for a topic the tag map actually reaches', () {
      expect(topicResourceLinks(DsaTopic.dp).codeforces, 'https://codeforces.com/problemset?tags=dp');
    });

    test('leaves leetcode null for a topic the tag map does not reach, rather than guessing', () {
      expect(topicResourceLinks(DsaTopic.numberTheory).leetcode, isNull);
    });

    test('always gives a GFG search link, CodeChef and HackerRank practice links', () {
      for (final topic in dsaTopics) {
        final links = topicResourceLinks(topic);
        expect(links.geeksforgeeks, contains('geeksforgeeks.org/?s='));
        expect(links.codechef, 'https://www.codechef.com/practice');
        expect(links.hackerrank, 'https://www.hackerrank.com/domains/algorithms');
      }
    });
  });
}
