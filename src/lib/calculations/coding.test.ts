import { describe, expect, it } from "vitest";
import {
  buildActivityDetail,
  buildActivityMap,
  buildHeatmap,
  complexityCoverage,
  currentStreak,
  longestStreak,
  totalByDifficulty,
  weeklyProgress,
} from "./coding";
import type { CodingSolutionDoc, PlatformStats, RecentSolve } from "@/types/coding";

function solution(solvedAt: string, withComplexity = false): CodingSolutionDoc {
  return {
    id: solvedAt,
    studentId: "s1",
    platform: "leetcode",
    title: "Two Sum",
    url: "https://leetcode.com/problems/two-sum/",
    difficulty: "easy",
    language: "python",
    code: "",
    notes: "",
    topics: [],
    complexity: withComplexity
      ? {
          time: "O(n)",
          space: "O(n)",
          confidence: "high",
          explanation: "",
          bottleneck: null,
          betterApproach: null,
          source: "ai",
          model: "test",
          analyzedAt: "2026-08-20T00:00:00.000Z",
        }
      : null,
    solvedAt,
    createdAt: "",
    updatedAt: "",
  };
}

function stats(calendar: Record<string, number> | null, byDifficulty: PlatformStats["byDifficulty"] = null): PlatformStats {
  return {
    platform: "leetcode",
    handle: "h",
    displayName: null,
    avatarUrl: null,
    profileUrl: "",
    solved: 10,
    byDifficulty,
    rating: null,
    maxRating: null,
    rank: null,
    globalRank: null,
    contestsAttended: null,
    currentStreak: null,
    calendar,
    fetchedAt: "",
    error: null,
  };
}

describe("buildActivityMap", () => {
  it("adds platform calendars and logged solutions together", () => {
    const activity = buildActivityMap(
      [stats({ "2026-08-19": 2 })],
      [solution("2026-08-19"), solution("2026-08-18")],
    );
    expect(activity.get("2026-08-19")).toBe(3);
    expect(activity.get("2026-08-18")).toBe(1);
  });

  it("is empty when nothing has happened", () => {
    expect(buildActivityMap([stats(null)], []).size).toBe(0);
  });
});

function recentSolve(platform: RecentSolve["platform"], title: string, solvedAt: string): RecentSolve {
  return { platform, title, url: "", difficulty: null, language: null, solvedAt, tags: [] };
}

describe("buildActivityDetail", () => {
  it("uses the calendar count for a platform that publishes one, even with no title", () => {
    const detail = buildActivityDetail([stats({ "2026-08-19": 3 })], [], []);
    expect(detail.get("2026-08-19")).toEqual([{ platform: "leetcode", count: 3, titles: [] }]);
  });

  it("adds a recent solve's platform and title without double-counting a calendar day", () => {
    const detail = buildActivityDetail(
      [stats({ "2026-08-19": 3 })],
      [recentSolve("leetcode", "Two Sum", "2026-08-19T10:00:00.000Z")],
      [],
    );
    expect(detail.get("2026-08-19")).toEqual([{ platform: "leetcode", count: 3, titles: ["Two Sum"] }]);
  });

  it("counts a platform with no calendar purely off its named solves", () => {
    const detail = buildActivityDetail(
      [],
      [recentSolve("codeforces", "Watermelon", "2026-08-19T10:00:00.000Z")],
      [],
    );
    expect(detail.get("2026-08-19")).toEqual([
      { platform: "codeforces", count: 1, titles: ["Watermelon"] },
    ]);
  });

  it("adds a logged solution alongside a platform's recent solve on the same day", () => {
    const detail = buildActivityDetail(
      [],
      [recentSolve("leetcode", "Two Sum", "2026-08-19T10:00:00.000Z")],
      [solution("2026-08-19")],
    );
    const day = detail.get("2026-08-19")!;
    expect(day).toHaveLength(1);
    expect(day[0].count).toBe(1);
    expect(day[0].titles).toEqual(["Two Sum"]);
  });

  it("lists platforms sorted alphabetically", () => {
    const detail = buildActivityDetail(
      [],
      [
        recentSolve("leetcode", "Two Sum", "2026-08-19T10:00:00.000Z"),
        recentSolve("codeforces", "Watermelon", "2026-08-19T10:00:00.000Z"),
      ],
      [],
    );
    expect(detail.get("2026-08-19")!.map((entry) => entry.platform)).toEqual(["codeforces", "leetcode"]);
  });

  it("is empty for a day with nothing at all", () => {
    expect(buildActivityDetail([stats(null)], [], []).size).toBe(0);
  });
});

describe("currentStreak", () => {
  it("counts back from today", () => {
    const activity = new Map([
      ["2026-08-20", 1],
      ["2026-08-19", 2],
      ["2026-08-18", 1],
    ]);
    expect(currentStreak(activity, "2026-08-20")).toBe(3);
  });

  it("stays alive on a day with no practice yet, counting from yesterday", () => {
    const activity = new Map([
      ["2026-08-19", 1],
      ["2026-08-18", 1],
    ]);
    expect(currentStreak(activity, "2026-08-20")).toBe(2);
  });

  it("is zero once two days have been missed", () => {
    expect(currentStreak(new Map([["2026-08-18", 1]]), "2026-08-20")).toBe(0);
  });

  it("is zero with no activity at all", () => {
    expect(currentStreak(new Map(), "2026-08-20")).toBe(0);
  });

  it("does not jump a gap", () => {
    const activity = new Map([
      ["2026-08-20", 1],
      ["2026-08-18", 1],
      ["2026-08-17", 1],
    ]);
    expect(currentStreak(activity, "2026-08-20")).toBe(1);
  });
});

describe("longestStreak", () => {
  it("finds the longest run anywhere in the record", () => {
    const activity = new Map([
      ["2026-08-01", 1],
      ["2026-08-02", 1],
      ["2026-08-03", 1],
      ["2026-08-10", 1],
      ["2026-08-11", 1],
    ]);
    expect(longestStreak(activity)).toBe(3);
  });

  it("is zero for an empty record", () => {
    expect(longestStreak(new Map())).toBe(0);
  });
});

describe("buildHeatmap", () => {
  it("returns one cell per day including the empty ones, oldest first", () => {
    const cells = buildHeatmap(new Map([["2026-08-20", 5]]), "2026-08-20", 7);
    expect(cells).toHaveLength(7);
    expect(cells[0].date).toBe("2026-08-14");
    expect(cells[6].date).toBe("2026-08-20");
    expect(cells[6].count).toBe(5);
    expect(cells[0].level).toBe(0);
    expect(cells[0].platforms).toEqual([]);
  });

  it("carries the platform breakdown into the matching cell when a detail map is passed", () => {
    const detail = new Map([["2026-08-20", [{ platform: "leetcode" as const, count: 5, titles: ["Two Sum"] }]]]);
    const cells = buildHeatmap(new Map([["2026-08-20", 5]]), "2026-08-20", 7, detail);
    expect(cells[6].platforms).toEqual([{ platform: "leetcode", count: 5, titles: ["Two Sum"] }]);
    expect(cells[0].platforms).toEqual([]);
  });

  it("puts any activity above level 0 and caps the shade at 4", () => {
    const cells = buildHeatmap(
      new Map([
        ["2026-08-19", 1],
        ["2026-08-20", 50],
      ]),
      "2026-08-20",
      2,
    );
    expect(cells[0].level).toBe(1);
    expect(cells[1].level).toBe(4);
  });
});

describe("weeklyProgress", () => {
  // 2026-08-20 is a Thursday, so the week began Monday 2026-08-17.
  it("counts only solutions from the current Monday onwards", () => {
    const progress = weeklyProgress(
      [solution("2026-08-17"), solution("2026-08-20"), solution("2026-08-16")],
      5,
      "2026-08-20",
    );
    expect(progress.solved).toBe(2);
    expect(progress.remaining).toBe(3);
    expect(progress.percent).toBe(40);
    expect(progress.met).toBe(false);
  });

  it("treats Sunday as the end of the week that is closing, not a new one", () => {
    // 2026-08-23 is a Sunday; its week still starts on the 17th.
    const progress = weeklyProgress([solution("2026-08-17")], 1, "2026-08-23");
    expect(progress.solved).toBe(1);
    expect(progress.daysLeft).toBe(1);
    expect(progress.met).toBe(true);
  });

  it("reports 0% rather than dividing by zero when no target is set", () => {
    const progress = weeklyProgress([solution("2026-08-20")], 0, "2026-08-20");
    expect(progress.percent).toBe(0);
    expect(progress.met).toBe(false);
  });

  it("clamps past 100% when a student overshoots", () => {
    const progress = weeklyProgress(
      [solution("2026-08-18"), solution("2026-08-19"), solution("2026-08-20")],
      2,
      "2026-08-20",
    );
    expect(progress.percent).toBe(100);
    expect(progress.remaining).toBe(0);
    expect(progress.met).toBe(true);
  });
});

describe("totalByDifficulty", () => {
  it("sums the platforms that publish a split", () => {
    expect(
      totalByDifficulty([
        stats(null, { easy: 10, medium: 5, hard: 1 }),
        stats(null, { easy: 2, medium: 0, hard: 0 }),
      ]),
    ).toEqual({ easy: 12, medium: 5, hard: 1 });
  });

  it("is null when no platform publishes one", () => {
    expect(totalByDifficulty([stats(null)])).toBeNull();
  });
});

describe("complexityCoverage", () => {
  it("reports how much of the log has been analysed", () => {
    expect(complexityCoverage([solution("2026-08-20", true), solution("2026-08-19")])).toEqual({
      analysed: 1,
      total: 2,
      percent: 50,
    });
  });

  it("is 0% for an empty log rather than NaN", () => {
    expect(complexityCoverage([]).percent).toBe(0);
  });
});
