/**
 * Competitive-programming practice, tracked next to coursework.
 *
 * A student's practice lives on five different sites, none of which talk to
 * each other and only two of which have a real API. Handy reads all five from
 * one place, using nothing but a public handle — never a password. That
 * matters: an account here is worth stealing, and a tracker is not worth
 * asking for one.
 *
 * Naming note: "CodeForge" in this app already means Aditya's Maya skills-hour
 * platform (see types/hubAttendance.ts). This is a different thing entirely —
 * the student's own public practice profiles — and is called "practice"
 * throughout to keep the two apart.
 */

export type CodingPlatform = "leetcode" | "codeforces" | "codechef" | "gfg" | "hackerrank";

/** Iteration order is display order — LeetCode first, since that is what most students actually use. */
export const CODING_PLATFORMS: CodingPlatform[] = [
  "leetcode",
  "codeforces",
  "codechef",
  "gfg",
  "hackerrank",
];

export interface CodingPlatformMeta {
  id: CodingPlatform;
  label: string;
  /** What the site itself calls the thing being typed in, so the field can say so. */
  handleLabel: string;
  /** A real-looking example, not a placeholder — students copy the shape. */
  handleHint: string;
  profileUrl: (handle: string) => string;
  /** Whether this platform reports a rating. Drives which stat tiles render. */
  hasRating: boolean;
}

export const PLATFORM_META: Record<CodingPlatform, CodingPlatformMeta> = {
  leetcode: {
    id: "leetcode",
    label: "LeetCode",
    handleLabel: "Username",
    handleHint: "the name in leetcode.com/u/___",
    profileUrl: (handle) => `https://leetcode.com/u/${encodeURIComponent(handle)}/`,
    hasRating: true,
  },
  codeforces: {
    id: "codeforces",
    label: "Codeforces",
    handleLabel: "Handle",
    handleHint: "the name in codeforces.com/profile/___",
    profileUrl: (handle) => `https://codeforces.com/profile/${encodeURIComponent(handle)}`,
    hasRating: true,
  },
  codechef: {
    id: "codechef",
    label: "CodeChef",
    handleLabel: "Username",
    handleHint: "the name in codechef.com/users/___",
    profileUrl: (handle) => `https://www.codechef.com/users/${encodeURIComponent(handle)}`,
    hasRating: true,
  },
  gfg: {
    id: "gfg",
    label: "GeeksforGeeks",
    handleLabel: "Username",
    handleHint: "the name in geeksforgeeks.org/user/___",
    profileUrl: (handle) => `https://www.geeksforgeeks.org/user/${encodeURIComponent(handle)}/`,
    hasRating: false,
  },
  hackerrank: {
    id: "hackerrank",
    label: "HackerRank",
    handleLabel: "Username",
    handleHint: "the name in hackerrank.com/profile/___",
    profileUrl: (handle) => `https://www.hackerrank.com/profile/${encodeURIComponent(handle)}`,
    hasRating: false,
  },
};

export type ProblemDifficulty = "easy" | "medium" | "hard";

export interface DifficultySplit {
  easy: number;
  medium: number;
  hard: number;
}

/**
 * One platform's numbers at one moment.
 *
 * Every field except `platform`, `handle` and `fetchedAt` is nullable, and
 * that is the point: the five platforms expose wildly different things, and a
 * zero would be a lie where a site simply does not publish the number. The UI
 * renders a tile only for the fields that came back.
 */
export interface PlatformStats {
  platform: CodingPlatform;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string;
  /** Accepted/solved problem count. */
  solved: number | null;
  /** LeetCode only — nobody else publishes a difficulty split. */
  byDifficulty: DifficultySplit | null;
  rating: number | null;
  maxRating: number | null;
  /** The site's own word for the band: "expert", "3 star", "Guardian". */
  rank: string | null;
  globalRank: number | null;
  contestsAttended: number | null;
  currentStreak: number | null;
  /** yyyy-MM-dd -> submissions that day, where the platform publishes it (LeetCode). */
  calendar: Record<string, number> | null;
  fetchedAt: string;
  /**
   * Set when *this* platform failed while others succeeded — a scrape broke,
   * a handle was mistyped, a site was down. Carried in the snapshot rather
   * than thrown, so one dead site never blanks the whole page.
   */
  error: string | null;
}

/** An accepted submission read back off a platform, newest first. */
export interface RecentSolve {
  platform: CodingPlatform;
  title: string;
  url: string;
  difficulty: ProblemDifficulty | null;
  language: string | null;
  /** ISO timestamp. */
  solvedAt: string;
  tags: string[];
}

/**
 * A student's practice setup and their most recent snapshot, one document per
 * student at `codingProfiles/{uid}`.
 *
 * Written only by api/coding.js with the Admin SDK. The client reads its own
 * document and asks the server to change it — the same shape as hubAccounts,
 * and for the same reason: `totalSolved` and `peerKey` decide where a student
 * lands on a leaderboard, so neither can be something the client sets.
 */
export interface CodingProfileDoc {
  id: string;
  studentId: string;
  handles: Partial<Record<CodingPlatform, string>>;
  stats: PlatformStats[];
  recent: RecentSolve[];
  /** Sum of every platform's `solved`. Denormalised so the leaderboard can order on it. */
  totalSolved: number;
  /** Problems the student means to solve in a week. 0 means "no goal set". */
  weeklyTarget: number;
  shareToLeaderboard: boolean;
  /**
   * `<collegeId>|<department>|<year>|<section>` — who counts as "my class"
   * for the leaderboard. Derived server-side from the student document, so it
   * follows the portal rather than anything a student typed.
   */
  peerKey: string | null;
  refreshedAt: string | null;
  updatedAt: string;
}

export type ComplexitySource = "ai" | "manual";
export type ComplexityConfidence = "high" | "medium" | "low";

/**
 * What a solution costs, in time and space.
 *
 * No platform publishes this — LeetCode reports a runtime in milliseconds and
 * a percentile, which is a measurement of one machine on one day, not a
 * complexity. So it is read off the code itself (api/coding-complexity.js),
 * and the student can always overwrite the verdict: `source` records which of
 * the two it currently is, and the UI never presents an estimate as fact.
 */
export interface ComplexityVerdict {
  /** Big-O in plain notation, e.g. "O(n log n)". */
  time: string;
  space: string;
  confidence: ComplexityConfidence;
  /** Two or three sentences a student can check against their own code. */
  explanation: string;
  /** The construct that dominates — the thing to change to go faster. */
  bottleneck: string | null;
  /** An asymptotically better approach, when one exists. Null when the solution is already optimal. */
  betterApproach: string | null;
  source: ComplexitySource;
  /** Which model produced it. Null for a hand-typed verdict. */
  model: string | null;
  analyzedAt: string;
}

/**
 * One solved problem the student kept — `codingSolutions/{id}`.
 *
 * Student-owned, exactly like tasks: platforms will tell you *that* something
 * was solved, never *how*. The code is stored so the complexity verdict can be
 * re-derived later, and so a student can look up how they did it last time.
 */
export interface CodingSolutionDoc {
  id: string;
  studentId: string;
  platform: CodingPlatform;
  title: string;
  url: string;
  difficulty: ProblemDifficulty | null;
  language: string;
  code: string;
  notes: string;
  complexity: ComplexityVerdict | null;
  /**
   * DSA topics (constants/dsaTopics.ts DsaTopic ids) this solve counts
   * toward. Empty, not guessed — Codeforces solves can be pre-filled from the
   * platform's own tags (see RecentSolve.tags), everything else is untagged
   * until the student says otherwise. An untagged solve still counts toward
   * the streak and the total; it just contributes to no topic's mastery.
   */
  topics: string[];
  /** ISO date (yyyy-MM-dd) — what the streak and the heatmap count. */
  solvedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContestItem {
  platform: CodingPlatform;
  name: string;
  url: string;
  /** ISO timestamp. */
  startsAt: string;
  durationMinutes: number | null;
}

export interface DailyProblem {
  title: string;
  url: string;
  difficulty: ProblemDifficulty | null;
  tags: string[];
  /** yyyy-MM-dd, the day LeetCode set it. */
  date: string;
}

export interface LeaderboardEntry {
  rollNumber: string;
  name: string;
  totalSolved: number;
  /** True for the row belonging to the student reading the board. */
  isMe: boolean;
}
