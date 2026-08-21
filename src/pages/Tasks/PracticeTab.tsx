import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Activity, Code2, ExternalLink, Plus, RefreshCw, Settings } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConnectPlatformsCard } from "@/components/coding/ConnectPlatformsCard";
import { DailyProblemCard } from "@/components/coding/DailyProblemCard";
import { PlatformStatCard } from "@/components/coding/PlatformStatCard";
import { SolutionForm, type SolutionDraft } from "@/components/coding/SolutionForm";
import { SolutionRow } from "@/components/coding/SolutionRow";
import { StreakHeatmap } from "@/components/coding/StreakHeatmap";
import {
  useCodingProfile,
  useDailyProblem,
  useDeleteSolution,
  useLinkHandles,
  useRefreshCodingProfile,
  useSolutions,
} from "@/hooks/useCoding";
import {
  buildActivityMap,
  buildHeatmap,
  complexityCoverage,
  currentStreak,
  longestStreak,
  totalByDifficulty,
  weeklyProgress,
} from "@/lib/calculations/coding";
import { CodingError } from "@/services/coding/codingService";
import { PLATFORM_BRAND } from "@/constants/codingBrand";
import { topicsFromTags } from "@/constants/dsaTopics";
import { computeTopicMastery } from "@/lib/calculations/mastery";
import { TopicMasteryCard } from "@/components/coding/TopicMasteryCard";
import { formatShortDate, todayIso } from "@/lib/date";
import { PLATFORM_META, type RecentSolve } from "@/types/coding";
import styles from "./PracticeTab.module.css";

/** Enough recent solves to recognise the week, not so many it becomes a second log. */
const RECENT_LIMIT = 6;

/**
 * Coding practice: what the five platforms say, and what the student wrote
 * down themselves.
 *
 * The order is deliberate. Totals and streak first (the answer to "am I
 * keeping this up"), then today's problem (the answer to "what now"), then the
 * solve log with its complexity verdicts (the part no platform can give you,
 * and the only part worth re-reading in a year).
 */
export function PracticeTab() {
  const today = todayIso();
  const profileQuery = useCodingProfile();
  const solutionsQuery = useSolutions();
  const refresh = useRefreshCodingProfile();
  const link = useLinkHandles();
  const removeSolution = useDeleteSolution();

  const linked = profileQuery.data?.linked ?? false;
  const dailyQuery = useDailyProblem(linked);

  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState<Partial<SolutionDraft> | null>(null);

  const profile = profileQuery.data?.profile ?? null;
  const solutions = useMemo(() => solutionsQuery.data ?? [], [solutionsQuery.data]);

  const activity = useMemo(
    () => buildActivityMap(profile?.stats ?? [], solutions),
    [profile?.stats, solutions],
  );
  const heatmap = useMemo(() => buildHeatmap(activity, today), [activity, today]);
  const streak = currentStreak(activity, today);
  const best = longestStreak(activity);
  const difficulty = totalByDifficulty(profile?.stats ?? []);
  const coverage = complexityCoverage(solutions);
  const goal = useMemo(
    () => weeklyProgress(solutions, profile?.weeklyTarget ?? 0, today),
    [solutions, profile?.weeklyTarget, today],
  );
  const mastery = useMemo(() => computeTopicMastery(solutions, today), [solutions, today]);

  if (profileQuery.isLoading) {
    return (
      <div className={styles.loadingStack}>
        <Skeleton height={120} />
        <Skeleton height={92} />
        <Skeleton height={92} />
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <ErrorState
        message="Unable to load your practice profile."
        onRetry={() => profileQuery.refetch()}
      />
    );
  }

  // Nothing linked: the connect form *is* the page. No empty stat tiles above
  // it pretending there is data to come.
  if (!linked) {
    return (
      <div className={styles.stack}>
        <ConnectPlatformsCard
          handles={profile?.handles ?? {}}
          onSave={(handles) => link.mutate(handles)}
          saving={link.isPending}
          error={link.error instanceof CodingError ? link.error.message : null}
        />
        <p className={styles.footnote}>
          Handy reads only what those profiles already show the public. Nothing is posted, and no
          password is ever asked for.
        </p>
      </div>
    );
  }

  const recent = (profile?.recent ?? []).slice(0, RECENT_LIMIT);

  return (
    <div className={styles.stack}>
      <Card className={styles.summary}>
        <div className={styles.summaryHead}>
          <div className={styles.summaryTotal}>
            <p className={styles.total}>{profile?.totalSolved ?? 0}</p>
            <p className={styles.totalLabel}>problems solved, all platforms</p>
          </div>

          {/* A teaser into Goals, not a duplicate of it: the ring shows only
              this week's number, never the full goal card's controls. */}
          {goal.target > 0 && (
            <ProgressRing percent={goal.percent} size={64} strokeWidth={6} color={goal.met ? "var(--status-good)" : "var(--color-primary)"}>
              <span className={styles.ringValue}>{goal.solved}</span>
              <span className={styles.ringOf}>/{goal.target}</span>
            </ProgressRing>
          )}

          <div className={styles.summaryActions}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setShowSettings((value) => !value)}
              aria-label="Edit connected profiles"
            >
              <Settings size={16} />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
              aria-label="Refresh from the platforms"
            >
              <RefreshCw size={16} className={refresh.isPending ? styles.spinning : undefined} />
            </button>
          </div>
        </div>

        {difficulty && (
          <div className={styles.difficultyBar}>
            <span className={styles.easy}>{difficulty.easy} easy</span>
            <span className={styles.medium}>{difficulty.medium} medium</span>
            <span className={styles.hard}>{difficulty.hard} hard</span>
          </div>
        )}

        <p className={styles.refreshedAt}>
          {profile?.refreshedAt
            ? `Updated ${formatShortDate(profile.refreshedAt.slice(0, 10))}`
            : "Not read yet"}
          {profileQuery.data?.rateLimited && " · refresh limit reached, showing the last snapshot"}
        </p>
      </Card>

      {showSettings && (
        <ConnectPlatformsCard
          handles={profile?.handles ?? {}}
          onSave={(handles) => {
            link.mutate(handles);
            setShowSettings(false);
          }}
          saving={link.isPending}
          error={link.error instanceof CodingError ? link.error.message : null}
          compact
        />
      )}

      <div className={styles.platformGrid}>
        {(profile?.stats ?? []).map((stats) => (
          <PlatformStatCard key={stats.platform} stats={stats} />
        ))}
      </div>

      <StreakHeatmap days={heatmap} streak={streak} longest={best} />

      {mastery.length > 0 && <TopicMasteryCard mastery={mastery} />}

      {dailyQuery.data && <DailyProblemCard daily={dailyQuery.data} />}

      {recent.length > 0 && (
        <Card className={styles.recentCard}>
          <p className={styles.sectionHeading}>
            <Activity size={15} /> Recently accepted
          </p>
          <ul className={styles.recentList}>
            {recent.map((solve) => (
              <RecentSolveRow key={`${solve.platform}-${solve.url}-${solve.solvedAt}`} solve={solve} onLog={setDraft} />
            ))}
          </ul>
          <p className={styles.recentNote}>
            Logging one keeps the code and works out its complexity — the part the platform never
            tells you.
          </p>
        </Card>
      )}

      <div className={styles.logHead}>
        <p className={styles.sectionHeading}>
          <Code2 size={15} /> Solve log
        </p>
        <Button size="sm" onClick={() => setDraft(draft ? null : {})}>
          <Plus size={14} /> Log
        </Button>
      </div>

      {coverage.total > 0 && (
        <p className={styles.coverage}>
          {coverage.analysed} of {coverage.total} have a complexity recorded ({coverage.percent}%).
        </p>
      )}

      {draft && <SolutionForm initial={draft} onClose={() => setDraft(null)} />}

      {solutionsQuery.isLoading && <Skeleton height={72} />}

      {!solutionsQuery.isLoading && solutions.length === 0 && !draft && (
        <EmptyState
          icon={Code2}
          title="Nothing logged yet"
          description="Save a solution to keep the code, its time and space complexity, and what you got wrong first."
        />
      )}

      <div className={styles.solutionList}>
        {solutions.map((solution) => (
          <SolutionRow
            key={solution.id}
            solution={solution}
            onDelete={() => removeSolution.mutate(solution.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** A platform-reported solve, with the one action that turns it into a logged one. */
function RecentSolveRow({
  solve,
  onLog,
}: {
  solve: RecentSolve;
  onLog: (draft: Partial<SolutionDraft>) => void;
}) {
  return (
    <li className={styles.recentRow}>
      <span className={styles.recentDot} style={{ background: PLATFORM_BRAND[solve.platform].color }} aria-hidden="true" />
      <div className={styles.recentBody}>
        <a className={styles.recentTitle} href={solve.url} target="_blank" rel="noreferrer noopener">
          {solve.title} <ExternalLink size={11} />
        </a>
        <p className={styles.recentMeta}>
          {PLATFORM_META[solve.platform].label}
          {solve.language && ` · ${solve.language}`}
          {` · ${format(parseISO(solve.solvedAt), "d MMM")}`}
        </p>
      </div>
      <button
        type="button"
        className={styles.logButton}
        onClick={() =>
          onLog({
            platform: solve.platform,
            title: solve.title,
            url: solve.url,
            difficulty: solve.difficulty ?? "",
            language: solve.language ?? "Python",
            solvedAt: format(parseISO(solve.solvedAt), "yyyy-MM-dd"),
            // Real tags only — Codeforces and LeetCode both publish them per
            // solve, so this pre-fills for those two; CodeChef/GFG/HackerRank
            // carry none (types/coding.ts's RecentSolve.tags), so this comes
            // back empty for them and the student tags it themselves.
            topics: topicsFromTags(solve.platform, solve.tags),
          })
        }
      >
        Log
      </button>
    </li>
  );
}
