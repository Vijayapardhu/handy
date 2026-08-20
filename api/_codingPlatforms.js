// Reading a student's public practice profile off five coding sites.
//
// One module, five very different sources:
//
//   LeetCode      GraphQL, undocumented but stable and public
//   Codeforces    a real, documented REST API
//   CodeChef      no API at all — the profile page, parsed with cheerio
//   GeeksforGeeks a JSON endpoint their own profile page calls
//   HackerRank    two public REST endpoints behind /rest
//
// Everything here reads *public* pages with nothing but a handle. No password
// is ever asked for, stored or sent — unlike api/_hubPortal.js, which holds a
// college credential because it has to. A practice tracker does not have to,
// so it does not.
//
// Each fetcher returns the same normalised shape (see src/types/coding.ts's
// PlatformStats) and each one catches its own failures into `error` instead of
// throwing. A CodeChef markup change must not blank a student's LeetCode
// numbers, and every one of these sources will break eventually.
import * as cheerio from "cheerio";

/** A browser UA. CodeChef and GeeksforGeeks both 403 a bare fetch. */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Nothing here is worth making a student wait on. Slow site → that platform reports an error. */
const TIMEOUT_MS = 12_000;

export const PLATFORM_IDS = ["leetcode", "codeforces", "codechef", "gfg", "hackerrank"];

const PROFILE_URLS = {
  leetcode: (h) => `https://leetcode.com/u/${encodeURIComponent(h)}/`,
  codeforces: (h) => `https://codeforces.com/profile/${encodeURIComponent(h)}`,
  codechef: (h) => `https://www.codechef.com/users/${encodeURIComponent(h)}`,
  gfg: (h) => `https://www.geeksforgeeks.org/user/${encodeURIComponent(h)}/`,
  hackerrank: (h) => `https://www.hackerrank.com/profile/${encodeURIComponent(h)}`,
};

export function profileUrl(platform, handle) {
  const build = PROFILE_URLS[platform];
  return build ? build(handle) : "";
}

async function withTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { "User-Agent": UA, ...(options.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Every stats object has the same keys, whether or not the platform fills them. */
function emptyStats(platform, handle) {
  return {
    platform,
    handle,
    displayName: null,
    avatarUrl: null,
    profileUrl: profileUrl(platform, handle),
    solved: null,
    byDifficulty: null,
    rating: null,
    maxRating: null,
    rank: null,
    globalRank: null,
    contestsAttended: null,
    currentStreak: null,
    calendar: null,
    fetchedAt: new Date().toISOString(),
    error: null,
  };
}

function failed(platform, handle, error) {
  return { ...emptyStats(platform, handle), error };
}

function toInt(value) {
  const n = Number.parseInt(String(value ?? "").replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function normaliseDifficulty(raw) {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "easy" || value === "medium" || value === "hard") return value;
  return null;
}

// ── LeetCode ────────────────────────────────────────────────────────────────

const LEETCODE_PROFILE_QUERY = `
  query handyProfile($username: String!, $year: Int) {
    matchedUser(username: $username) {
      username
      profile { ranking realName userAvatar }
      submitStatsGlobal { acSubmissionNum { difficulty count } }
      userCalendar(year: $year) { streak totalActiveDays submissionCalendar }
    }
    userContestRanking(username: $username) {
      attendedContestsCount
      rating
      globalRanking
    }
    recentAcSubmissionList(username: $username, limit: 15) {
      title
      titleSlug
      timestamp
      lang
    }
  }
`;

async function leetcodeGraphql(query, variables) {
  const response = await withTimeout("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com" },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`leetcode_http_${response.status}`);
  const body = await response.json();
  // GraphQL answers 200 with an errors array; an unknown username lands here.
  if (body.errors?.length) throw new Error(body.errors[0]?.message ?? "leetcode_error");
  return body.data;
}

/**
 * LeetCode's submission calendar arrives as a JSON *string* keyed by UTC epoch
 * seconds. Converted to yyyy-MM-dd here so the heatmap never has to think
 * about epochs, and trimmed to a year so the document stays small.
 */
export function parseLeetCodeCalendar(raw) {
  if (!raw) return null;
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  const calendar = {};
  for (const [seconds, count] of Object.entries(parsed)) {
    const date = new Date(Number(seconds) * 1000);
    if (Number.isNaN(date.getTime())) continue;
    calendar[date.toISOString().slice(0, 10)] = Number(count) || 0;
  }
  return Object.keys(calendar).length > 0 ? calendar : null;
}

export function normaliseLeetCode(handle, data) {
  const user = data?.matchedUser;
  // Same { stats, recent } shape as the success path — fetchPlatform reads
  // both keys, and a bare stats object here would read as an undefined recent.
  if (!user) return { stats: failed("leetcode", handle, "not_found"), recent: [] };

  const stats = emptyStats("leetcode", handle);
  const counts = new Map(
    (user.submitStatsGlobal?.acSubmissionNum ?? []).map((row) => [
      String(row.difficulty).toLowerCase(),
      Number(row.count) || 0,
    ]),
  );

  stats.displayName = user.profile?.realName || user.username || handle;
  stats.avatarUrl = user.profile?.userAvatar ?? null;
  stats.solved = counts.get("all") ?? null;
  stats.byDifficulty = {
    easy: counts.get("easy") ?? 0,
    medium: counts.get("medium") ?? 0,
    hard: counts.get("hard") ?? 0,
  };
  stats.globalRank = user.profile?.ranking ?? null;
  stats.currentStreak = user.userCalendar?.streak ?? null;
  stats.calendar = parseLeetCodeCalendar(user.userCalendar?.submissionCalendar);
  // Contest rating is null for anyone who has never entered a contest — which
  // is most students, and is not an error.
  stats.rating = data?.userContestRanking?.rating
    ? Math.round(data.userContestRanking.rating)
    : null;
  stats.contestsAttended = data?.userContestRanking?.attendedContestsCount ?? null;

  const recent = (data?.recentAcSubmissionList ?? []).map((row) => ({
    platform: "leetcode",
    title: row.title,
    url: `https://leetcode.com/problems/${row.titleSlug}/`,
    // The recent-submission list carries no difficulty. Left null rather than
    // guessed; the solve log lets the student set it when they save one.
    difficulty: null,
    language: row.lang ?? null,
    solvedAt: new Date(Number(row.timestamp) * 1000).toISOString(),
    tags: [],
  }));

  return { stats, recent };
}

async function fetchLeetCode(handle) {
  const data = await leetcodeGraphql(LEETCODE_PROFILE_QUERY, {
    username: handle,
    year: new Date().getUTCFullYear(),
  });
  return normaliseLeetCode(handle, data);
}

// ── Codeforces ──────────────────────────────────────────────────────────────

export function normaliseCodeforces(handle, info, submissions) {
  const stats = emptyStats("codeforces", handle);
  stats.displayName = [info?.firstName, info?.lastName].filter(Boolean).join(" ") || info?.handle || handle;
  stats.avatarUrl = info?.titlePhoto ?? info?.avatar ?? null;
  stats.rating = info?.rating ?? null;
  stats.maxRating = info?.maxRating ?? null;
  stats.rank = info?.rank ?? null;

  // Codeforces counts submissions, not problems: the same problem solved twice
  // is two OK verdicts. Distinct problems is the number a student means.
  const solvedKeys = new Set();
  const recent = [];
  for (const submission of submissions ?? []) {
    if (submission.verdict !== "OK") continue;
    const problem = submission.problem ?? {};
    const contestId = problem.contestId ?? submission.contestId;
    const key = `${contestId}-${problem.index}`;
    if (solvedKeys.has(key)) continue;
    solvedKeys.add(key);
    if (recent.length < 15) {
      recent.push({
        platform: "codeforces",
        title: `${problem.index}. ${problem.name}`,
        url: contestId
          ? `https://codeforces.com/contest/${contestId}/problem/${problem.index}`
          : "https://codeforces.com/problemset",
        // Codeforces rates problems 800-3500 rather than labelling them; the
        // bands below are the ones its own colour scheme uses.
        difficulty: problem.rating ? ratingToDifficulty(problem.rating) : null,
        language: submission.programmingLanguage ?? null,
        solvedAt: new Date(Number(submission.creationTimeSeconds) * 1000).toISOString(),
        tags: problem.tags ?? [],
      });
    }
  }
  stats.solved = solvedKeys.size;

  return { stats, recent };
}

function ratingToDifficulty(rating) {
  if (rating < 1200) return "easy";
  if (rating < 1900) return "medium";
  return "hard";
}

async function fetchCodeforces(handle) {
  const infoResponse = await withTimeout(
    `https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`,
  );
  const infoBody = await infoResponse.json();
  if (infoBody.status !== "OK" || !infoBody.result?.[0]) throw new Error("not_found");

  // Newest first, capped: a prolific handle has tens of thousands of
  // submissions and the whole history is not worth the transfer.
  let submissions = [];
  try {
    const statusResponse = await withTimeout(
      `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=2000`,
    );
    const statusBody = await statusResponse.json();
    if (statusBody.status === "OK") submissions = statusBody.result ?? [];
  } catch {
    // Submissions are a bonus; the profile alone is still worth showing.
  }

  return normaliseCodeforces(handle, infoBody.result[0], submissions);
}

// ── CodeChef ────────────────────────────────────────────────────────────────

/**
 * CodeChef has no API, so this reads the profile page.
 *
 * Exported and pure so api/_codingPlatforms.test.js can pin the selectors
 * against a real saved page — this is the fetcher most likely to break, and a
 * test is the only thing that will say so before a student does.
 */
export function parseCodeChefProfile(handle, html) {
  const $ = cheerio.load(html);
  const stats = emptyStats("codechef", handle);

  const name = $("h1.h2-style").first().text().trim();
  if (!name) return failed("codechef", handle, "not_found");
  stats.displayName = name;

  const avatar = $(".user-details-container img").first().attr("src");
  if (avatar) stats.avatarUrl = avatar.startsWith("http") ? avatar : `https:${avatar}`;

  stats.rating = toInt($(".rating-number").first().text());

  const highest = $(".rating-header small").first().text();
  const highestMatch = highest.match(/(\d{3,4})/);
  if (highestMatch) stats.maxRating = Number(highestMatch[1]);

  const stars = $(".rating-star span").length;
  if (stars > 0) stats.rank = `${stars} star`;

  // "Global Rank" and "Country Rank" sit in the same list, and read "Inactive"
  // for anyone who has not competed recently — which is not a number.
  const globalRank = toInt($(".rating-ranks .inline-list li").first().find("strong").text());
  stats.globalRank = globalRank;

  const solvedMatch = $("body").text().match(/Total Problems Solved:\s*(\d+)/i);
  stats.solved = solvedMatch ? Number(solvedMatch[1]) : null;

  return stats;
}

async function fetchCodeChef(handle) {
  const response = await withTimeout(profileUrl("codechef", handle), { redirect: "follow" });
  // An unknown user is a redirect to the homepage, not a 404.
  if (!response.ok) throw new Error(`http_${response.status}`);
  if (!new URL(response.url).pathname.startsWith("/users/")) throw new Error("not_found");
  const stats = parseCodeChefProfile(handle, await response.text());
  if (stats.error) throw new Error(stats.error);
  return { stats, recent: [] };
}

// ── GeeksforGeeks ───────────────────────────────────────────────────────────

export function normaliseGfg(handle, payload) {
  const data = payload?.data;
  if (!data) return failed("gfg", handle, "not_found");

  const stats = emptyStats("gfg", handle);
  stats.displayName = data.name || handle;
  stats.avatarUrl = data.profile_image_url ?? null;
  stats.solved = Number.isFinite(data.total_problems_solved) ? data.total_problems_solved : null;
  // GfG's "score" is its own currency, not a rating — shown as the rank line
  // rather than in a rating tile, so it is never compared with a CF rating.
  stats.rank = Number.isFinite(data.score) ? `${data.score} score` : null;
  stats.currentStreak = Number.isFinite(data.pod_solved_current_streak)
    ? data.pod_solved_current_streak
    : null;
  stats.globalRank = toInt(data.institute_rank);
  return stats;
}

async function fetchGfg(handle) {
  const response = await withTimeout(
    `https://authapi.geeksforgeeks.org/api-get/user-profile-info/?handle=${encodeURIComponent(handle)}`,
  );
  if (!response.ok) throw new Error(`http_${response.status}`);
  const stats = normaliseGfg(handle, await response.json());
  if (stats.error) throw new Error(stats.error);
  return { stats, recent: [] };
}

// ── HackerRank ──────────────────────────────────────────────────────────────

export function normaliseHackerRank(handle, profile, badges) {
  const model = profile?.model;
  if (!model) return failed("hackerrank", handle, "not_found");

  const stats = emptyStats("hackerrank", handle);
  stats.displayName = model.name || model.username || handle;
  stats.avatarUrl = model.avatar ?? null;

  // HackerRank has no single "problems solved" number: it publishes per-track
  // badges, each with its own solved count. Summing them is the closest honest
  // equivalent, and the star total is what students actually quote.
  const models = badges?.models ?? [];
  if (models.length > 0) {
    stats.solved = models.reduce((sum, badge) => sum + (Number(badge.solved) || 0), 0);
    const totalStars = models.reduce((sum, badge) => sum + (Number(badge.stars) || 0), 0);
    stats.rank = `${totalStars} star${totalStars === 1 ? "" : "s"}`;
  }
  return stats;
}

async function fetchHackerRank(handle) {
  const [profileResponse, badgeResponse] = await Promise.all([
    withTimeout(
      `https://www.hackerrank.com/rest/contests/master/hackers/${encodeURIComponent(handle)}/profile`,
    ),
    withTimeout(`https://www.hackerrank.com/rest/hackers/${encodeURIComponent(handle)}/badges`),
  ]);
  if (!profileResponse.ok) throw new Error(`http_${profileResponse.status}`);
  const profile = await profileResponse.json();
  const badges = badgeResponse.ok ? await badgeResponse.json() : null;
  const stats = normaliseHackerRank(handle, profile, badges);
  if (stats.error) throw new Error(stats.error);
  return { stats, recent: [] };
}

// ── Dispatch ────────────────────────────────────────────────────────────────

const FETCHERS = {
  leetcode: fetchLeetCode,
  codeforces: fetchCodeforces,
  codechef: fetchCodeChef,
  gfg: fetchGfg,
  hackerrank: fetchHackerRank,
};

/**
 * One platform, never throwing.
 *
 * The error string is a code rather than a sentence — the client owns the
 * wording (services/coding/codingService.ts), the same split the hub and
 * portal services already use.
 */
/**
 * All five ways of saying "no such user", in one word.
 *
 * LeetCode answers with a GraphQL message, Codeforces with a 400, HackerRank
 * with a 404, GeeksforGeeks with a 400, CodeChef with a redirect. A mistyped
 * username is by far the most common failure here and deserves the one error
 * the UI can give real advice about, so they are collapsed to `not_found`
 * rather than each surfacing its own status code.
 */
function classifyError(message) {
  if (/not exist|not found|no such|404|http_400|invalid handle/i.test(message)) return "not_found";
  return message.slice(0, 80);
}

export async function fetchPlatform(platform, handle) {
  const fetcher = FETCHERS[platform];
  if (!fetcher) return { stats: failed(platform, handle, "unknown_platform"), recent: [] };
  try {
    const result = await fetcher(handle);
    return { stats: result.stats, recent: result.recent ?? [] };
  } catch (error) {
    const message = error?.name === "AbortError" ? "timeout" : (error?.message ?? "fetch_failed");
    console.error(`[coding] ${platform}/${handle} failed:`, message);
    return { stats: failed(platform, handle, classifyError(message)), recent: [] };
  }
}

/**
 * Every linked platform at once.
 *
 * Concurrent because they are five unrelated sites: waiting for CodeChef's
 * slow page before starting Codeforces would make the refresh feel like the
 * slowest site rather than the slowest request.
 */
export async function fetchAllPlatforms(handles) {
  const entries = Object.entries(handles ?? {}).filter(([platform, handle]) =>
    PLATFORM_IDS.includes(platform) && String(handle ?? "").trim(),
  );
  const results = await Promise.all(
    entries.map(([platform, handle]) => fetchPlatform(platform, String(handle).trim())),
  );

  const stats = results.map((result) => result.stats);
  const recent = results
    .flatMap((result) => result.recent)
    .sort((a, b) => b.solvedAt.localeCompare(a.solvedAt))
    .slice(0, 30);

  const totalSolved = stats.reduce((sum, entry) => sum + (entry.solved ?? 0), 0);
  return { stats, recent, totalSolved };
}

// ── Daily problem and contests ──────────────────────────────────────────────

const LEETCODE_DAILY_QUERY = `
  query handyDaily {
    activeDailyCodingChallengeQuestion {
      date
      link
      question { title difficulty topicTags { name } }
    }
  }
`;

export async function fetchDailyProblem() {
  try {
    const data = await leetcodeGraphql(LEETCODE_DAILY_QUERY, {});
    const daily = data?.activeDailyCodingChallengeQuestion;
    if (!daily?.question) return null;
    return {
      title: daily.question.title,
      url: `https://leetcode.com${daily.link}`,
      difficulty: normaliseDifficulty(daily.question.difficulty),
      tags: (daily.question.topicTags ?? []).map((tag) => tag.name),
      date: daily.date,
    };
  } catch (error) {
    console.error("[coding] daily problem failed:", error?.message);
    return null;
  }
}

async function fetchCodeforcesContests() {
  const response = await withTimeout("https://codeforces.com/api/contest.list?gym=false");
  const body = await response.json();
  if (body.status !== "OK") return [];
  return (body.result ?? [])
    .filter((contest) => contest.phase === "BEFORE")
    .map((contest) => ({
      platform: "codeforces",
      name: contest.name,
      url: `https://codeforces.com/contests/${contest.id}`,
      startsAt: new Date(Number(contest.startTimeSeconds) * 1000).toISOString(),
      durationMinutes: contest.durationSeconds ? Math.round(contest.durationSeconds / 60) : null,
    }));
}

async function fetchLeetCodeContests() {
  const data = await leetcodeGraphql(
    `query handyContests { upcomingContests { title titleSlug startTime duration } }`,
    {},
  );
  return (data?.upcomingContests ?? []).map((contest) => ({
    platform: "leetcode",
    name: contest.title,
    url: `https://leetcode.com/contest/${contest.titleSlug}/`,
    startsAt: new Date(Number(contest.startTime) * 1000).toISOString(),
    durationMinutes: contest.duration ? Math.round(Number(contest.duration) / 60) : null,
  }));
}

async function fetchCodeChefContests() {
  const response = await withTimeout("https://www.codechef.com/api/list/contests/all");
  const body = await response.json();
  return (body?.future_contests ?? []).map((contest) => ({
    platform: "codechef",
    name: contest.contest_name,
    url: `https://www.codechef.com/${contest.contest_code}`,
    startsAt: new Date(contest.contest_start_date_iso).toISOString(),
    durationMinutes: toInt(contest.contest_duration),
  }));
}

/**
 * Upcoming contests across the platforms that publish them, soonest first.
 *
 * GeeksforGeeks and HackerRank are absent on purpose — neither has a public
 * upcoming-contest feed, and inventing one from a scraped page would go stale
 * silently.
 */
export async function fetchContests(limit = 12) {
  const sources = await Promise.allSettled([
    fetchCodeforcesContests(),
    fetchLeetCodeContests(),
    fetchCodeChefContests(),
  ]);
  const now = Date.now();
  return sources
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((contest) => {
      const time = Date.parse(contest.startsAt);
      return Number.isFinite(time) && time > now;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, limit);
}
