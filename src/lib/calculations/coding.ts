import type {
  CodingPlatform,
  CodingProfileDoc,
  CodingSolutionDoc,
  DifficultySplit,
  PlatformStats,
  RecentSolve,
} from "@/types/coding";

/**
 * What the practice tab actually shows, derived from two very different
 * sources: what the platforms report (counts, ratings, a LeetCode calendar)
 * and what the student logged themselves (solutions, with complexity).
 *
 * All pure and date-injected, the same contract as calculations/deadlines.ts —
 * a streak that reads the clock is a streak that cannot be tested.
 */

/** One platform's real, attributable share of a day's activity. */
export interface PlatformDayActivity {
  platform: CodingPlatform;
  count: number;
  /** Real titles only — from a recent solve or the solve log, never guessed. */
  titles: string[];
}

/** One cell of the practice heatmap. */
export interface ActivityDay {
  /** yyyy-MM-dd. */
  date: string;
  count: number;
  /** 0-4, the shade. Bucketed rather than scaled so one heavy day cannot flatten the rest. */
  level: number;
  /** Which platform(s) this count actually came from — empty for a day with nothing. */
  platforms: PlatformDayActivity[];
}

function toUtcDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

function isoFromUtcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

/**
 * Merges every source of "did practice happen that day" into one map.
 *
 * LeetCode publishes a submission calendar; nobody else does. The solve log
 * fills the rest, so a student who solves on Codeforces and logs it still has
 * a streak. Counts add up across sources — this is activity, not a total.
 */
export function buildActivityMap(
  stats: PlatformStats[],
  solutions: CodingSolutionDoc[],
): Map<string, number> {
  const activity = new Map<string, number>();
  const add = (date: string, count: number) => {
    if (!date) return;
    activity.set(date, (activity.get(date) ?? 0) + count);
  };

  for (const platform of stats) {
    for (const [date, count] of Object.entries(platform.calendar ?? {})) add(date, count);
  }
  for (const solution of solutions) add(solution.solvedAt, 1);

  return activity;
}

/**
 * Which platform(s) actually contributed to each day, for the heatmap's
 * click-through.
 *
 * Only LeetCode publishes a calendar, and even that carries no titles — a day
 * can show "LeetCode, 3 submissions" with nothing named. A recent solve or a
 * logged solution names the platform *and* the problem, so those take
 * priority for the titles; the calendar's count stays authoritative for
 * LeetCode since it is the platform's own number, not a count of what Handy
 * happens to know the title of.
 */
export function buildActivityDetail(
  stats: PlatformStats[],
  recent: RecentSolve[],
  solutions: CodingSolutionDoc[],
): Map<string, PlatformDayActivity[]> {
  const byDay = new Map<string, Map<CodingPlatform, PlatformDayActivity>>();
  const calendarCovered = new Set<string>();

  const entryFor = (date: string, platform: CodingPlatform): PlatformDayActivity => {
    let day = byDay.get(date);
    if (!day) {
      day = new Map();
      byDay.set(date, day);
    }
    let entry = day.get(platform);
    if (!entry) {
      entry = { platform, count: 0, titles: [] };
      day.set(platform, entry);
    }
    return entry;
  };

  for (const platformStats of stats) {
    for (const [date, count] of Object.entries(platformStats.calendar ?? {})) {
      if (!date || count <= 0) continue;
      entryFor(date, platformStats.platform).count = count;
      calendarCovered.add(`${date}|${platformStats.platform}`);
    }
  }

  const addTitle = (date: string, platform: CodingPlatform, title: string) => {
    if (!date) return;
    const entry = entryFor(date, platform);
    if (entry.titles.includes(title)) return;
    entry.titles.push(title);
    if (!calendarCovered.has(`${date}|${platform}`)) entry.count += 1;
  };

  for (const solve of recent) addTitle(solve.solvedAt.slice(0, 10), solve.platform, solve.title);
  for (const solution of solutions) addTitle(solution.solvedAt, solution.platform, solution.title);

  const out = new Map<string, PlatformDayActivity[]>();
  for (const [date, platforms] of byDay) {
    out.set(
      date,
      [...platforms.values()].sort((a, b) => a.platform.localeCompare(b.platform)),
    );
  }
  return out;
}

/** Four buckets. A day with anything at all is never level 0 — showing up counts. */
function levelFor(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

/**
 * The last `days` days, oldest first, including the empty ones.
 *
 * Empty days are in the array on purpose: a heatmap with the gaps removed is
 * a heatmap that says the opposite of the truth.
 */
export function buildHeatmap(
  activity: Map<string, number>,
  todayIso: string,
  days = 84,
  detail: Map<string, PlatformDayActivity[]> = new Map(),
): ActivityDay[] {
  const end = toUtcDay(todayIso);
  const out: ActivityDay[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = isoFromUtcDay(end - offset * DAY_MS);
    const count = activity.get(date) ?? 0;
    out.push({ date, count, level: levelFor(count), platforms: detail.get(date) ?? [] });
  }
  return out;
}

/**
 * Consecutive days of practice ending today — or yesterday.
 *
 * Yesterday counts as still-alive deliberately: at 9am a student has not
 * broken a 30-day streak, they just have not practised *yet*, and a tracker
 * that resets at midnight teaches people to stop trusting it.
 */
export function currentStreak(activity: Map<string, number>, todayIso: string): number {
  const today = toUtcDay(todayIso);
  const startedToday = (activity.get(todayIso) ?? 0) > 0;
  if (!startedToday && (activity.get(isoFromUtcDay(today - DAY_MS)) ?? 0) === 0) return 0;

  let streak = 0;
  let cursor = startedToday ? today : today - DAY_MS;
  while ((activity.get(isoFromUtcDay(cursor)) ?? 0) > 0) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

/** The longest run of practice days anywhere in the record. */
export function longestStreak(activity: Map<string, number>): number {
  const days = [...activity.entries()]
    .filter(([, count]) => count > 0)
    .map(([date]) => toUtcDay(date))
    .sort((a, b) => a - b);

  let best = 0;
  let run = 0;
  let previous: number | null = null;
  for (const day of days) {
    run = previous !== null && day - previous === DAY_MS ? run + 1 : 1;
    previous = day;
    if (run > best) best = run;
  }
  return best;
}

export interface WeeklyProgress {
  /** Problems logged since the start of the current week. */
  solved: number;
  target: number;
  /** 0-100, clamped. 0 when no target is set. */
  percent: number;
  remaining: number;
  /** Whole days left in the week, today included. */
  daysLeft: number;
  met: boolean;
}

/**
 * Progress against the weekly practice goal.
 *
 * The week starts Monday — a college week, not a calendar one, and the same
 * assumption the timetable makes.
 */
export function weeklyProgress(
  solutions: CodingSolutionDoc[],
  target: number,
  todayIso: string,
): WeeklyProgress {
  const today = toUtcDay(todayIso);
  const weekday = new Date(today).getUTCDay();
  // getUTCDay() is Sunday-first; Sunday belongs to the week that is ending.
  const sinceMonday = weekday === 0 ? 6 : weekday - 1;
  const monday = today - sinceMonday * DAY_MS;

  const solved = solutions.filter((solution) => {
    const day = toUtcDay(solution.solvedAt);
    return day >= monday && day <= today;
  }).length;

  const percent = target > 0 ? Math.min(100, Math.round((solved / target) * 100)) : 0;
  return {
    solved,
    target,
    percent,
    remaining: Math.max(0, target - solved),
    daysLeft: 7 - sinceMonday,
    met: target > 0 && solved >= target,
  };
}

/** Every platform's difficulty split, summed. Only LeetCode reports one today. */
export function totalByDifficulty(stats: PlatformStats[]): DifficultySplit | null {
  const withSplit = stats.filter((entry) => entry.byDifficulty);
  if (withSplit.length === 0) return null;
  return withSplit.reduce<DifficultySplit>(
    (sum, entry) => ({
      easy: sum.easy + (entry.byDifficulty?.easy ?? 0),
      medium: sum.medium + (entry.byDifficulty?.medium ?? 0),
      hard: sum.hard + (entry.byDifficulty?.hard ?? 0),
    }),
    { easy: 0, medium: 0, hard: 0 },
  );
}

/**
 * The platforms that failed on the last refresh.
 *
 * Surfaced rather than swallowed: three of the five sources have no API
 * contract, and "CodeChef could not be read" is a far better answer than a
 * silently missing tile.
 */
export function failedPlatforms(profile: CodingProfileDoc | null): PlatformStats[] {
  return (profile?.stats ?? []).filter((entry) => entry.error);
}

/**
 * How much of the solve log has a complexity recorded.
 *
 * The nudge that makes the log worth keeping — a solved problem whose cost
 * nobody worked out is a problem that will be re-solved the same slow way.
 */
export function complexityCoverage(solutions: CodingSolutionDoc[]): {
  analysed: number;
  total: number;
  percent: number;
} {
  const total = solutions.length;
  const analysed = solutions.filter((solution) => solution.complexity).length;
  return {
    analysed,
    total,
    percent: total === 0 ? 0 : Math.round((analysed / total) * 100),
  };
}

/**
 * The topics a student keeps landing on, most frequent first.
 *
 * Read off the tags platforms attach to solved problems. Useful in the
 * opposite direction too — what is *not* in this list is what has not been
 * practised.
 */
export function topTags(profile: CodingProfileDoc | null, limit = 8): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const solve of profile?.recent ?? []) {
    for (const tag of solve.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}
