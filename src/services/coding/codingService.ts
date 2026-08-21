import { addDoc, deleteDoc, doc, getDocs, orderBy, query, updateDoc, where } from "firebase/firestore";
import { codingSolutionsCol } from "@/services/firebase/collections";
import type {
  CodingPlatform,
  CodingProfileDoc,
  CodingSolutionDoc,
  ComplexityVerdict,
  ContestItem,
  DailyProblem,
  LeaderboardEntry,
  ProblemDifficulty,
} from "@/types/coding";

/**
 * Two halves, deliberately split:
 *
 *   - Everything about *platforms* goes through /api/coding, because reading
 *     LeetCode or CodeChef from a browser is impossible (CORS) and because
 *     the numbers behind a leaderboard must not be client-written.
 *   - Everything about the *solve log* is plain Firestore, because it is the
 *     student's own writing and the rules already fence it to their uid — the
 *     same shape taskService.ts has.
 */

export class CodingError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CodingError";
  }
}

/** Server codes to something a student can act on. Mirrors hubAttendanceService.ts. */
const MESSAGES: Record<string, string> = {
  rate_limited: "You've refreshed a lot in the last hour. Try again shortly.",
  coding_failed: "Could not reach the coding platforms. Try again shortly.",
  ai_unconfigured: "That isn't switched on for this app yet.",
  ai_unreachable: "The analyser didn't respond. Try again, or enter the complexity yourself.",
  ai_failed: "The analyser couldn't read that solution. Try again, or enter it yourself.",
  ai_unparseable: "The analyser gave an answer we couldn't read. Try again.",
  ai_truncated: "That solution needed more room to think through than we allow. Try again, or trim the code to just the solution.",
  code_too_long: "That's too much code to analyse — paste just the solution.",
  missing_code: "Paste your solution first.",
  unknown_topic: "That topic isn't one Handy tracks.",
};

function messageFor(code: string, fallback: string): string {
  if (code.startsWith("invalid_handle_")) {
    const platform = code.replace("invalid_handle_", "");
    return `That ${platform} username has characters no username can contain — check it and try again.`;
  }
  return MESSAGES[code] ?? fallback;
}

async function post<T>(body: Record<string, unknown>, idToken: string, fallback: string): Promise<T> {
  const response = await fetch("/api/coding", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;
  if (!response.ok || !data?.ok) {
    throw new CodingError(data?.error ?? "unknown", messageFor(data?.error ?? "unknown", fallback));
  }
  return data;
}

export interface ProfileResult {
  linked: boolean;
  profile: CodingProfileDoc;
  /** True when the answer came from the server's cached snapshot rather than a live read. */
  cached?: boolean;
  /** True when a refresh was asked for but the hourly budget was already spent. */
  rateLimited?: boolean;
}

export async function fetchCodingProfile(idToken: string, forceRefresh = false): Promise<ProfileResult> {
  return post<ProfileResult>({ action: "profile", forceRefresh }, idToken, "Could not load your practice profile.");
}

export async function linkHandles(
  handles: Partial<Record<CodingPlatform, string>>,
  idToken: string,
): Promise<ProfileResult> {
  return post<ProfileResult>({ action: "link", handles }, idToken, "Could not save those usernames.");
}

export async function updateCodingSettings(
  settings: { weeklyTarget?: number; shareToLeaderboard?: boolean },
  idToken: string,
): Promise<{ profile: CodingProfileDoc }> {
  return post<{ profile: CodingProfileDoc }>(
    { action: "settings", ...settings },
    idToken,
    "Could not save that setting.",
  );
}

export async function fetchContests(idToken: string): Promise<ContestItem[]> {
  const data = await post<{ contests: ContestItem[] }>(
    { action: "contests" },
    idToken,
    "Could not load upcoming contests.",
  );
  return data.contests;
}

export async function fetchDailyProblem(idToken: string): Promise<DailyProblem | null> {
  const data = await post<{ daily: DailyProblem | null }>(
    { action: "daily" },
    idToken,
    "Could not load today's problem.",
  );
  return data.daily;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  peerKey: string | null;
  sharing?: boolean;
}

export async function fetchLeaderboard(idToken: string): Promise<LeaderboardResult> {
  return post<LeaderboardResult>({ action: "leaderboard" }, idToken, "Could not load the class board.");
}

/**
 * Reads the complexity of a pasted solution.
 *
 * Returns a verdict the student can edit — never a fact. `ai_unconfigured`
 * comes back as a typed error rather than an exception the UI has to guess at,
 * because "the analyser is off" is a normal state with a normal answer: type
 * it in yourself.
 */
export async function analyseComplexity(
  input: { code: string; language: string; title?: string; platform?: CodingPlatform },
  idToken: string,
): Promise<ComplexityVerdict> {
  const response = await fetch("/api/coding-complexity", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(input),
  });
  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string; verdict?: ComplexityVerdict }
    | null;
  if (!data?.ok || !data.verdict) {
    const code = data?.error ?? "ai_failed";
    throw new CodingError(code, messageFor(code, "Could not analyse that solution."));
  }
  return data.verdict;
}

export interface TopicExplanation {
  text: string;
  model: string | null;
  generatedAt: string;
}

/**
 * A short explanation of one DSA topic — generated once per topic and cached
 * server-side forever after (see api/topic-explainer.js), so this is fast and
 * free after the first student anywhere asks about a given topic.
 */
export async function explainTopic(topic: string, idToken: string): Promise<TopicExplanation> {
  const response = await fetch("/api/topic-explainer", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ topic }),
  });
  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string; explanation?: TopicExplanation }
    | null;
  if (!data?.ok || !data.explanation) {
    const code = data?.error ?? "ai_failed";
    throw new CodingError(code, messageFor(code, "Could not load an explanation for that topic."));
  }
  return data.explanation;
}

// ── Solve log (plain Firestore, student-owned) ──────────────────────────────

export interface NewSolution {
  platform: CodingPlatform;
  title: string;
  url?: string;
  difficulty?: ProblemDifficulty | null;
  language: string;
  code?: string;
  notes?: string;
  solvedAt: string;
  complexity?: ComplexityVerdict | null;
  topics?: string[];
}

/** Newest first — the question is always "what did I do lately", never "what did I do first". */
export async function getSolutions(studentId: string): Promise<CodingSolutionDoc[]> {
  const q = query(
    codingSolutionsCol(),
    where("studentId", "==", studentId),
    orderBy("solvedAt", "desc"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export async function createSolution(studentId: string, solution: NewSolution): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(codingSolutionsCol(), {
    studentId,
    platform: solution.platform,
    title: solution.title.trim(),
    url: solution.url?.trim() ?? "",
    difficulty: solution.difficulty ?? null,
    language: solution.language.trim(),
    code: solution.code ?? "",
    notes: solution.notes?.trim() ?? "",
    complexity: solution.complexity ?? null,
    topics: solution.topics ?? [],
    solvedAt: solution.solvedAt,
    createdAt: now,
    updatedAt: now,
  } as CodingSolutionDoc);
  return ref.id;
}

export interface SolutionEdits {
  title?: string;
  url?: string;
  difficulty?: ProblemDifficulty | null;
  language?: string;
  code?: string;
  notes?: string;
  complexity?: ComplexityVerdict | null;
  solvedAt?: string;
  topics?: string[];
}

/** Partial, like updateTask: this serves a full edit and a lone complexity correction equally. */
export async function updateSolution(solutionId: string, edits: SolutionEdits): Promise<void> {
  const data: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (edits.title !== undefined) data.title = edits.title.trim();
  if (edits.url !== undefined) data.url = edits.url.trim();
  if (edits.difficulty !== undefined) data.difficulty = edits.difficulty;
  if (edits.language !== undefined) data.language = edits.language.trim();
  if (edits.code !== undefined) data.code = edits.code;
  if (edits.notes !== undefined) data.notes = edits.notes.trim();
  if (edits.complexity !== undefined) data.complexity = edits.complexity;
  if (edits.solvedAt !== undefined) data.solvedAt = edits.solvedAt;
  if (edits.topics !== undefined) data.topics = edits.topics;
  await updateDoc(doc(codingSolutionsCol(), solutionId), data);
}

export async function deleteSolution(solutionId: string): Promise<void> {
  await deleteDoc(doc(codingSolutionsCol(), solutionId));
}
