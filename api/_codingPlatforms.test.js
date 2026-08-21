import { describe, expect, it } from "vitest";
import {
  normaliseLeetCode,
  normaliseCodeforces,
  normaliseGfg,
  normaliseHackerRank,
  parseCodeChefProfile,
  parseLeetCodeCalendar,
} from "./_codingPlatforms.js";

// Every fixture below is a trimmed copy of a real response, kept verbatim in
// shape. These five parsers are the whole reason this feature can break
// without anyone changing Handy — three of the sources have no API contract at
// all — so the shapes are pinned here rather than trusted.

describe("normaliseLeetCode", () => {
  const DATA = {
    matchedUser: {
      username: "neal_wu",
      profile: { ranking: 622143, realName: "Neal Wu", userAvatar: "https://x/a.png" },
      submitStatsGlobal: {
        acSubmissionNum: [
          { difficulty: "All", count: 253 },
          { difficulty: "Easy", count: 60 },
          { difficulty: "Medium", count: 141 },
          { difficulty: "Hard", count: 52 },
        ],
      },
      userCalendar: { streak: 4, totalActiveDays: 120, submissionCalendar: '{"1755648000":3}' },
    },
    userContestRanking: { attendedContestsCount: 51, rating: 3686.191, globalRanking: 2 },
    recentAcSubmissionList: [
      { title: "Two Sum", titleSlug: "two-sum", timestamp: "1755648000", lang: "python3" },
    ],
  };

  it("reads the difficulty split off the All/Easy/Medium/Hard rows", () => {
    const { stats } = normaliseLeetCode("neal_wu", DATA);
    expect(stats.solved).toBe(253);
    expect(stats.byDifficulty).toEqual({ easy: 60, medium: 141, hard: 52 });
  });

  it("rounds the contest rating, which arrives fractional", () => {
    const { stats } = normaliseLeetCode("neal_wu", DATA);
    expect(stats.rating).toBe(3686);
    expect(stats.contestsAttended).toBe(51);
  });

  it("builds a problem URL from the slug, not the title", () => {
    const { recent } = normaliseLeetCode("neal_wu", DATA);
    expect(recent[0].url).toBe("https://leetcode.com/problems/two-sum/");
    expect(recent[0].language).toBe("python3");
  });

  it("reports a missing user as an error rather than empty stats", () => {
    const { stats } = normaliseLeetCode("nobody", { matchedUser: null });
    expect(stats.error).toBe("not_found");
    expect(stats.solved).toBeNull();
  });

  it("leaves rating null for someone who has never entered a contest", () => {
    const { stats } = normaliseLeetCode("neal_wu", { ...DATA, userContestRanking: null });
    expect(stats.rating).toBeNull();
  });

  it("leaves a recent solve untagged when no tag map is passed", () => {
    const { recent } = normaliseLeetCode("neal_wu", DATA);
    expect(recent[0].tags).toEqual([]);
  });

  it("tags a recent solve from the batched fetchLeetCodeTopicTags result, matched by slug", () => {
    const tagsBySlug = new Map([["two-sum", ["Array", "Hash Table"]]]);
    const { recent } = normaliseLeetCode("neal_wu", DATA, tagsBySlug);
    expect(recent[0].tags).toEqual(["Array", "Hash Table"]);
  });

  it("leaves a solve untagged when its slug has no entry in the map — a failed lookup, not a crash", () => {
    const tagsBySlug = new Map([["some-other-problem", ["Graph"]]]);
    const { recent } = normaliseLeetCode("neal_wu", DATA, tagsBySlug);
    expect(recent[0].tags).toEqual([]);
  });
});

describe("parseLeetCodeCalendar", () => {
  it("converts epoch-second keys to calendar days", () => {
    expect(parseLeetCodeCalendar('{"1755648000":3,"1755734400":1}')).toEqual({
      "2025-08-20": 3,
      "2025-08-21": 1,
    });
  });

  it("returns null for the empty calendar LeetCode sends for inactive users", () => {
    expect(parseLeetCodeCalendar("{}")).toBeNull();
    expect(parseLeetCodeCalendar(null)).toBeNull();
    expect(parseLeetCodeCalendar("not json")).toBeNull();
  });
});

describe("normaliseCodeforces", () => {
  const INFO = {
    handle: "tourist",
    firstName: "Gennady",
    lastName: "Korotkevich",
    rating: 3530,
    maxRating: 4009,
    rank: "legendary grandmaster",
    titlePhoto: "https://x/t.jpg",
  };

  const submission = (id, index, verdict, seconds, rating) => ({
    id,
    contestId: 2245,
    creationTimeSeconds: seconds,
    problem: { contestId: 2245, index, name: `Problem ${index}`, rating, tags: ["dp"] },
    programmingLanguage: "C++23",
    verdict,
  });

  it("counts distinct problems, not accepted submissions", () => {
    const { stats } = normaliseCodeforces("tourist", INFO, [
      submission(1, "A", "OK", 1784221884, 900),
      submission(2, "A", "OK", 1784221900, 900),
      submission(3, "B", "OK", 1784222000, 2100),
    ]);
    expect(stats.solved).toBe(2);
  });

  it("ignores everything that is not an OK verdict", () => {
    const { stats } = normaliseCodeforces("tourist", INFO, [
      submission(1, "A", "WRONG_ANSWER", 1784221884, 900),
      submission(2, "B", "TIME_LIMIT_EXCEEDED", 1784221900, 900),
    ]);
    expect(stats.solved).toBe(0);
  });

  it("maps the problem rating onto a difficulty band", () => {
    const { recent } = normaliseCodeforces("tourist", INFO, [
      submission(1, "A", "OK", 1784221884, 900),
      submission(2, "B", "OK", 1784221900, 1500),
      submission(3, "C", "OK", 1784222000, 2400),
    ]);
    expect(recent.map((r) => r.difficulty)).toEqual(["easy", "medium", "hard"]);
  });

  it("survives a handle with no submissions at all", () => {
    const { stats, recent } = normaliseCodeforces("tourist", INFO, []);
    expect(stats.solved).toBe(0);
    expect(stats.rating).toBe(3530);
    expect(recent).toEqual([]);
  });
});

describe("parseCodeChefProfile", () => {
  const HTML = `
    <html><body>
      <div class="user-details-container"><img src="https://cdn.codechef.com/a.jpg" /></div>
      <h1 class="h2-style">Gennady Korotkevich</h1>
      <div class="rating-header text-center">
        <div class="rating-number">3355</div>
        <div>(Div 1)</div>
        <div class="rating-star"><span>&#9733;</span><span>&#9733;</span><span>&#9733;</span></div>
        <small>(Highest Rating 3445)</small>
      </div>
      <div class="rating-ranks"><ul class="inline-list">
        <li><a href="/ratings/all"><strong>22</strong></a> Global Rank</li>
        <li><a href="/ratings/all"><strong>1</strong></a> Country Rank</li>
      </ul></div>
      <section><h3>Total Problems Solved: 632</h3></section>
    </body></html>`;

  it("reads rating, highest rating, stars, rank and solved count", () => {
    const stats = parseCodeChefProfile("gennady.korotkevich", HTML);
    expect(stats.rating).toBe(3355);
    expect(stats.maxRating).toBe(3445);
    expect(stats.rank).toBe("3 star");
    expect(stats.globalRank).toBe(22);
    expect(stats.solved).toBe(632);
    expect(stats.displayName).toBe("Gennady Korotkevich");
  });

  it("treats a page with no name as a missing user", () => {
    expect(parseCodeChefProfile("nobody", "<html><body>Homepage</body></html>").error).toBe("not_found");
  });

  it("leaves the global rank null when CodeChef says 'Inactive' instead of a number", () => {
    const inactive = HTML.replace("<strong>22</strong>", "<strong>Inactive</strong>");
    expect(parseCodeChefProfile("someone", inactive).globalRank).toBeNull();
  });
});

describe("normaliseGfg", () => {
  it("reads the solved count, score and POTD streak", () => {
    const stats = normaliseGfg("sandeepjain", {
      data: {
        name: "Sandeep",
        profile_image_url: "https://media.geeksforgeeks.org/u.svg",
        score: 480,
        total_problems_solved: 231,
        pod_solved_current_streak: 12,
        institute_rank: "4",
      },
    });
    expect(stats.solved).toBe(231);
    expect(stats.rank).toBe("480 score");
    expect(stats.currentStreak).toBe(12);
    expect(stats.globalRank).toBe(4);
  });

  it("does not turn an empty institute rank into a zero", () => {
    const stats = normaliseGfg("x", { data: { name: "X", institute_rank: "", total_problems_solved: 3 } });
    expect(stats.globalRank).toBeNull();
  });

  it("reports a missing payload as not found", () => {
    expect(normaliseGfg("x", {}).error).toBe("not_found");
  });
});

describe("normaliseHackerRank", () => {
  const PROFILE = { model: { username: "nikhil_kumar", name: "Nikhil", avatar: "https://x/a.jpg" } };

  it("sums per-track badges, since HackerRank publishes no single total", () => {
    const stats = normaliseHackerRank("nikhil_kumar", PROFILE, {
      models: [
        { badge_type: "problem-solving", solved: 6, stars: 1 },
        { badge_type: "python", solved: 40, stars: 5 },
      ],
    });
    expect(stats.solved).toBe(46);
    expect(stats.rank).toBe("6 stars");
  });

  it("leaves solved null when the account has earned no badges", () => {
    const stats = normaliseHackerRank("nikhil_kumar", PROFILE, { models: [] });
    expect(stats.solved).toBeNull();
    expect(stats.displayName).toBe("Nikhil");
  });

  it("reports a missing profile model as not found", () => {
    expect(normaliseHackerRank("x", {}, null).error).toBe("not_found");
  });
});
