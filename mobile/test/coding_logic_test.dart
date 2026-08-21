import 'package:flutter_test/flutter_test.dart';
import 'package:handy/logic/coding.dart';
import 'package:handy/models/coding.dart';

PlatformStats _stats(Map<String, int>? calendar) {
  return PlatformStats(
    platform: CodingPlatform.leetcode,
    handle: 'h',
    displayName: null,
    avatarUrl: null,
    profileUrl: '',
    solved: 10,
    byDifficulty: null,
    rating: null,
    maxRating: null,
    rank: null,
    globalRank: null,
    contestsAttended: null,
    currentStreak: null,
    calendar: calendar,
    error: null,
  );
}

RecentSolve _recent(CodingPlatform platform, String title, DateTime solvedAt) {
  return RecentSolve(
    platform: platform,
    title: title,
    url: '',
    difficulty: null,
    language: null,
    solvedAt: solvedAt,
    tags: const [],
  );
}

CodingSolution _solution(String solvedAt, {CodingPlatform platform = CodingPlatform.leetcode, String title = 'Two Sum'}) {
  return CodingSolution(
    id: solvedAt,
    platform: platform,
    title: title,
    url: '',
    difficulty: ProblemDifficulty.easy,
    language: 'python',
    code: '',
    notes: '',
    complexity: null,
    topics: const [],
    solvedAt: solvedAt,
  );
}

void main() {
  group('buildActivityDetail', () {
    test('uses the calendar count for a platform that publishes one, even with no title', () {
      final detail = buildActivityDetail([_stats({'2026-08-19': 3})], [], []);
      final day = detail['2026-08-19']!;
      expect(day, hasLength(1));
      expect(day.first.platform, CodingPlatform.leetcode);
      expect(day.first.count, 3);
      expect(day.first.titles, isEmpty);
    });

    test("adds a recent solve's platform and title without double-counting a calendar day", () {
      final detail = buildActivityDetail(
        [_stats({'2026-08-19': 3})],
        [_recent(CodingPlatform.leetcode, 'Two Sum', DateTime(2026, 8, 19, 10))],
        [],
      );
      final day = detail['2026-08-19']!;
      expect(day, hasLength(1));
      expect(day.first.count, 3);
      expect(day.first.titles, ['Two Sum']);
    });

    test("counts a platform with no calendar purely off its named solves", () {
      final detail = buildActivityDetail(
        [],
        [_recent(CodingPlatform.codeforces, 'Watermelon', DateTime(2026, 8, 19, 10))],
        [],
      );
      final day = detail['2026-08-19']!;
      expect(day, hasLength(1));
      expect(day.first.platform, CodingPlatform.codeforces);
      expect(day.first.count, 1);
      expect(day.first.titles, ['Watermelon']);
    });

    test('adds a logged solution alongside a recent solve on the same day', () {
      final detail = buildActivityDetail(
        [],
        [_recent(CodingPlatform.leetcode, 'Two Sum', DateTime(2026, 8, 19, 10))],
        [_solution('2026-08-19')],
      );
      final day = detail['2026-08-19']!;
      expect(day, hasLength(1));
      expect(day.first.count, 1);
      expect(day.first.titles, ['Two Sum']);
    });

    test('lists platforms sorted by id', () {
      final detail = buildActivityDetail(
        [],
        [
          _recent(CodingPlatform.leetcode, 'Two Sum', DateTime(2026, 8, 19, 10)),
          _recent(CodingPlatform.codeforces, 'Watermelon', DateTime(2026, 8, 19, 10)),
        ],
        [],
      );
      expect(detail['2026-08-19']!.map((e) => e.platform), [
        CodingPlatform.codeforces,
        CodingPlatform.leetcode,
      ]);
    });

    test('is empty for a day with nothing at all', () {
      expect(buildActivityDetail([_stats(null)], [], []), isEmpty);
    });
  });

  group('buildHeatmap detail', () {
    test('carries the platform breakdown into the matching cell', () {
      final detail = {
        '2026-08-20': const [PlatformDayActivity(platform: CodingPlatform.leetcode, count: 5, titles: ['Two Sum'])],
      };
      final cells = buildHeatmap({'2026-08-20': 5}, '2026-08-20', days: 7, detail: detail);
      expect(cells.last.platforms, detail['2026-08-20']);
      expect(cells.first.platforms, isEmpty);
    });
  });
}
