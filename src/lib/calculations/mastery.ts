import {
  DSA_TOPICS,
  MASTERY_BAND_FLOORS,
  type DsaTopic,
  type MasteryBand,
} from "@/constants/dsaTopics";
import type { CodingSolutionDoc, DifficultySplit } from "@/types/coding";

/**
 * Topic mastery, computed from the solve log alone — not an AI opinion, a
 * plain deterministic formula anyone can check by hand.
 *
 * The product spec this is built from (§15) lists nine inputs: exposure,
 * difficulty progression, success rate, recent performance, pattern
 * coverage, contest performance, complexity quality, consistency,
 * retention. Handy genuinely has data for three of those — which problems
 * were solved, at what difficulty, and when — and nothing here pretends to
 * the other six. There is no failed-submission log (so no success rate), no
 * per-topic contest linkage, and no ground-truth "optimal complexity" to
 * grade a stored verdict against. A score built from data that does not
 * exist would be exactly the kind of invented number SRS/reliability rules
 * elsewhere in this app refuse to produce (see ComplexityVerdict.confidence,
 * or PlatformStats.error) — so this one only combines:
 *
 *   exposure   — how many tagged solves, difficulty-weighted
 *   recency    — a recent solve counts more than one from a year ago
 *
 * and reports the raw difficulty split alongside the score, so a student can
 * see for themselves whether a number reflects real depth or a pile of easy
 * problems — the same transparency the mastery spec itself asks for in §17.
 */

export interface TopicMastery {
  topic: DsaTopic;
  /** Distinct tagged solves counting toward this topic. */
  solved: number;
  byDifficulty: DifficultySplit;
  /** 0-100. */
  percent: number;
  band: MasteryBand;
  /** ISO date of the most recent solve tagged with this topic, or null if never solved. */
  lastSolvedAt: string | null;
}

const DAY_MS = 86_400_000;

function toUtcDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

function difficultyWeight(difficulty: CodingSolutionDoc["difficulty"]): number {
  if (difficulty === "hard") return 3;
  if (difficulty === "medium") return 2;
  // Easy and "not recorded" are treated the same on purpose: an unknown
  // difficulty should not quietly earn the medium-tier weight it happens to
  // sit next to in a switch statement.
  return 1;
}

/**
 * 1.0 within the last 90 days, decaying in a straight line to a 0.4 floor by
 * the one-year mark, and staying at that floor after. A solve from a year ago
 * still counts for something — it is real exposure — but a topic nobody has
 * touched since is not "mastered" in the present tense, which is what a hard
 * cutoff to zero would otherwise imply.
 */
function recencyWeight(solvedAtIso: string, todayIso: string): number {
  const days = Math.max(0, (toUtcDay(todayIso) - toUtcDay(solvedAtIso)) / DAY_MS);
  if (days <= 90) return 1;
  if (days >= 365) return 0.4;
  return 1 - 0.6 * ((days - 90) / (365 - 90));
}

/** Weighted points needed to reach 100% — see the module doc for what "weighted" means. */
const POINTS_FOR_FULL_MASTERY = 20;

export function bandFor(percent: number): MasteryBand {
  for (const [floor, band] of MASTERY_BAND_FLOORS) {
    if (percent >= floor) return band;
  }
  return "starting";
}

/**
 * Every canonical topic with at least one tagged solve, most-practiced
 * first. Topics with zero exposure are left out — see nextFocusTopic() for
 * "what to start", which is a different question from "how am I doing".
 */
export function computeTopicMastery(
  solutions: CodingSolutionDoc[],
  todayIso: string,
): TopicMastery[] {
  const byTopic = new Map<
    DsaTopic,
    { points: number; easy: number; medium: number; hard: number; count: number; lastSolvedAt: string }
  >();

  for (const solution of solutions) {
    if (!solution.solvedAt) continue;
    const weight = difficultyWeight(solution.difficulty) * recencyWeight(solution.solvedAt, todayIso);
    for (const rawTopic of solution.topics ?? []) {
      const topic = rawTopic as DsaTopic;
      if (!DSA_TOPICS.includes(topic)) continue; // a stale/unknown id from a future app version — skip, don't crash

      const entry = byTopic.get(topic) ?? { points: 0, easy: 0, medium: 0, hard: 0, count: 0, lastSolvedAt: solution.solvedAt };
      entry.points += weight;
      entry.count += 1;
      if (solution.difficulty === "hard") entry.hard += 1;
      else if (solution.difficulty === "medium") entry.medium += 1;
      else entry.easy += 1;
      if (solution.solvedAt > entry.lastSolvedAt) entry.lastSolvedAt = solution.solvedAt;
      byTopic.set(topic, entry);
    }
  }

  return [...byTopic.entries()]
    .map(([topic, entry]) => {
      const percent = Math.min(100, Math.round((entry.points / POINTS_FOR_FULL_MASTERY) * 100));
      return {
        topic,
        solved: entry.count,
        byDifficulty: { easy: entry.easy, medium: entry.medium, hard: entry.hard },
        percent,
        band: bandFor(percent),
        lastSolvedAt: entry.lastSolvedAt,
      };
    })
    .sort((a, b) => b.percent - a.percent || b.solved - a.solved);
}

/**
 * The weakest topic actually worth calling a weakness — needs at least two
 * tagged solves, so one unlucky hard problem can't brand a topic "weak" off
 * a single data point. Null when nothing qualifies yet.
 */
export function weakestTopic(masteries: TopicMastery[]): TopicMastery | null {
  const candidates = masteries.filter((m) => m.solved >= 2);
  if (candidates.length === 0) return null;
  return candidates.reduce((worst, entry) => (entry.percent < worst.percent ? entry : worst));
}

/**
 * What to focus on next — the spec's §19 "NEXT:" line.
 *
 * Prefers a canonical topic with zero exposure, in the curated learning-path
 * order DSA_TOPICS is written in (arrays before graphs before segment trees):
 * breadth before depth is the more useful default recommendation for a
 * student who hasn't touched something at all. Once every topic has at least
 * one solve, falls back to the weakest one — there is nothing left to
 * "discover", only something to get better at.
 */
export function nextFocusTopic(masteries: TopicMastery[]): DsaTopic | null {
  const touched = new Set(masteries.map((m) => m.topic));
  const untouched = DSA_TOPICS.find((topic) => !touched.has(topic));
  if (untouched) return untouched;
  return weakestTopic(masteries)?.topic ?? null;
}
