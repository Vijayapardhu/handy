import { useEffect, useRef, useState, type FormEvent } from "react";
import { Cpu, Sparkle, Timer, X } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAnalyseComplexity, useCreateSolution } from "@/hooks/useCoding";
import { CodingError } from "@/services/coding/codingService";
import { todayIso } from "@/lib/date";
import { DSA_TOPICS, DSA_TOPIC_LABELS, type DsaTopic } from "@/constants/dsaTopics";
import { cn } from "@/lib/utils/cn";
import {
  CODING_PLATFORMS,
  PLATFORM_META,
  type CodingPlatform,
  type ComplexityVerdict,
  type ProblemDifficulty,
} from "@/types/coding";
import styles from "./SolutionForm.module.css";

/** The languages students here actually submit in, plus an escape hatch. */
const LANGUAGES = ["Python", "C++", "Java", "C", "JavaScript", "Go", "Other"];

export interface SolutionDraft {
  platform: CodingPlatform;
  title: string;
  url: string;
  difficulty: ProblemDifficulty | "";
  language: string;
  solvedAt: string;
  code: string;
  notes: string;
  /** DsaTopic ids. Pre-filled from a platform's own tags when the caller has them (see PracticeTab's "Log" button); otherwise the student picks. */
  topics: string[];
}

function emptyDraft(initial?: Partial<SolutionDraft>): SolutionDraft {
  return {
    platform: "leetcode",
    title: "",
    url: "",
    difficulty: "",
    language: "Python",
    solvedAt: todayIso(),
    code: "",
    notes: "",
    topics: [],
    ...initial,
  };
}

/**
 * Logging a solved problem, and working out what it cost.
 *
 * The complexity read happens on its own, a moment after the student stops
 * changing the code field — no button to remember to press. Debounced rather
 * than fired on every keystroke, so a model call happens once per pause in
 * typing rather than once per character.
 *
 * Whatever comes back is editable before it is saved. A verdict is an
 * estimate read off the code, and the student is the one who knows whether the
 * helper it assumed about is really O(log n) — so `source` flips to "manual"
 * the moment they change a field, and the row says which it is forever after.
 *
 * Topics work the same way: pre-filled where a platform genuinely publishes
 * them (Codeforces tags, passed through in `initial`), never guessed for a
 * platform that doesn't — the chips just start unselected, and only what the
 * student actually picks counts toward a topic's mastery.
 */
export function SolutionForm({
  initial,
  onClose,
}: {
  initial?: Partial<SolutionDraft>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<SolutionDraft>(() => emptyDraft(initial));
  const [verdict, setVerdict] = useState<ComplexityVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyse = useAnalyseComplexity();
  const create = useCreateSolution();

  // Read at the moment the debounce timer fires, not when it was scheduled —
  // the student may have changed the platform or language while it waited.
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const set = <K extends keyof SolutionDraft>(key: K, value: SolutionDraft[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));

  function toggleTopic(topic: DsaTopic) {
    setDraft((previous) => ({
      ...previous,
      topics: previous.topics.includes(topic)
        ? previous.topics.filter((t) => t !== topic)
        : [...previous.topics, topic],
    }));
  }

  /** Editing a returned verdict makes it the student's, not the model's. */
  function editVerdict(patch: Partial<ComplexityVerdict>) {
    setVerdict((previous) =>
      previous ? { ...previous, ...patch, source: "manual", model: null } : previous,
    );
  }

  async function analyseCode(target: SolutionDraft) {
    setError(null);
    try {
      setVerdict(
        await analyse.mutateAsync({
          code: target.code,
          language: target.language,
          title: target.title || undefined,
          platform: target.platform,
        }),
      );
    } catch (caught) {
      setError(caught instanceof CodingError ? caught.message : "Could not analyse that solution.");
      // A failed analysis should still leave a way forward: an empty verdict
      // the student can fill in by hand.
      setVerdict({
        time: "",
        space: "",
        confidence: "medium",
        explanation: "",
        bottleneck: null,
        betterApproach: null,
        source: "manual",
        model: null,
        analyzedAt: new Date().toISOString(),
      });
    }
  }

  // The automatic replacement for the "Work out the complexity" button. A
  // 900ms pause is long enough that pasting or actively typing never fires it
  // mid-keystroke, short enough that it feels immediate once they stop.
  useEffect(() => {
    if (!draft.code.trim()) return;
    const timer = setTimeout(() => analyseCode(draftRef.current), 900);
    return () => clearTimeout(timer);
    // Re-runs only when the code itself changes — analyseCode reads the rest
    // of the draft through draftRef at fire time, so this does not need to
    // restart the timer just because the platform or language changed too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.code]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!draft.title.trim()) {
      setError("Give the problem a name.");
      return;
    }

    // A half-typed complexity is worse than none — it would count towards
    // coverage while saying nothing.
    const complexity = verdict && verdict.time.trim() && verdict.space.trim() ? verdict : null;

    await create.mutateAsync({
      platform: draft.platform,
      title: draft.title,
      url: draft.url,
      difficulty: draft.difficulty || null,
      language: draft.language,
      code: draft.code,
      notes: draft.notes,
      solvedAt: draft.solvedAt,
      complexity,
      topics: draft.topics,
    });
    onClose();
  }

  return (
    <Card className={styles.card}>
      <div className={styles.head}>
        <p className={styles.title}>Log a solved problem</p>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="solution-platform">
              Platform
            </label>
            <select
              id="solution-platform"
              className={styles.input}
              value={draft.platform}
              onChange={(event) => set("platform", event.target.value as CodingPlatform)}
            >
              {CODING_PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>
                  {PLATFORM_META[platform].label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="solution-date">
              Solved on
            </label>
            <input
              id="solution-date"
              type="date"
              className={styles.input}
              value={draft.solvedAt}
              max={todayIso()}
              onChange={(event) => set("solvedAt", event.target.value)}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="solution-title">
            Problem
          </label>
          <input
            id="solution-title"
            className={styles.input}
            value={draft.title}
            placeholder="Longest Substring Without Repeating Characters"
            onChange={(event) => set("title", event.target.value)}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="solution-difficulty">
              Difficulty
            </label>
            <select
              id="solution-difficulty"
              className={styles.input}
              value={draft.difficulty}
              onChange={(event) => set("difficulty", event.target.value as ProblemDifficulty | "")}
            >
              <option value="">Not set</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="solution-language">
              Language
            </label>
            <select
              id="solution-language"
              className={styles.input}
              value={draft.language}
              onChange={(event) => set("language", event.target.value)}
            >
              {LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            Topics <span className={styles.optional}>optional — counts toward topic mastery</span>
          </label>
          <div className={styles.topicGrid}>
            {DSA_TOPICS.map((topic) => (
              <button
                key={topic}
                type="button"
                className={cn(styles.topicChip, draft.topics.includes(topic) && styles.topicChipSelected)}
                onClick={() => toggleTopic(topic)}
                aria-pressed={draft.topics.includes(topic)}
              >
                {DSA_TOPIC_LABELS[topic]}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="solution-url">
            Link <span className={styles.optional}>optional</span>
          </label>
          <input
            id="solution-url"
            className={styles.input}
            value={draft.url}
            placeholder="https://leetcode.com/problems/..."
            onChange={(event) => set("url", event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="solution-code">
            Your solution
          </label>
          <textarea
            id="solution-code"
            className={styles.code}
            rows={8}
            value={draft.code}
            placeholder="Paste the accepted submission here"
            spellCheck={false}
            onChange={(event) => set("code", event.target.value)}
          />
          {analyse.isPending && (
            <p className={styles.analysing}>
              <Sparkle size={14} /> Reading your code…
            </p>
          )}
        </div>

        {verdict && (
          <div className={styles.verdict}>
            <div className={styles.verdictRow}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="verdict-time">
                  <Timer size={12} /> Time
                </label>
                <input
                  id="verdict-time"
                  className={styles.input}
                  value={verdict.time}
                  placeholder="O(n log n)"
                  onChange={(event) => editVerdict({ time: event.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="verdict-space">
                  <Cpu size={12} /> Space
                </label>
                <input
                  id="verdict-space"
                  className={styles.input}
                  value={verdict.space}
                  placeholder="O(n)"
                  onChange={(event) => editVerdict({ space: event.target.value })}
                />
              </div>
            </div>

            {verdict.explanation && <p className={styles.explanation}>{verdict.explanation}</p>}
            {verdict.bottleneck && (
              <p className={styles.detail}>
                <strong>Bottleneck:</strong> {verdict.bottleneck}
              </p>
            )}
            {verdict.betterApproach && (
              <p className={styles.detail}>
                <strong>Could be faster:</strong> {verdict.betterApproach}
              </p>
            )}
            <p className={styles.source}>
              {verdict.source === "ai"
                ? `Estimated from your code${verdict.model ? ` by ${verdict.model}` : ""} — check it, and correct it if it's wrong.`
                : "Your own answer."}
            </p>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="solution-notes">
            Notes <span className={styles.optional}>optional</span>
          </label>
          <textarea
            id="solution-notes"
            className={styles.input}
            rows={2}
            value={draft.notes}
            placeholder="What the trick was, what you got wrong first"
            onChange={(event) => set("notes", event.target.value)}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <Button
          type="submit"
          loading={create.isPending}
          // Waits out an in-flight auto-analysis rather than saving ahead of
          // it — the whole point of doing this automatically is that the
          // result is there by the time the student saves.
          disabled={analyse.isPending}
          fullWidth
        >
          {analyse.isPending ? "Reading your code…" : "Save to solve log"}
        </Button>
      </form>
    </Card>
  );
}
