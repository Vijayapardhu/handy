import { useMemo } from "react";
import { Target } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ClassLeaderboard } from "@/components/coding/ClassLeaderboard";
import { ContestList } from "@/components/coding/ContestList";
import { PracticeGoalCard } from "@/components/coding/PracticeGoalCard";
import {
  useCodingLeaderboard,
  useCodingProfile,
  useCodingSettings,
  useContests,
  useSolutions,
} from "@/hooks/useCoding";
import { useActiveTimetable } from "@/hooks/useTimetable";
import { weeklyProgress } from "@/lib/calculations/coding";
import { getWeeklyFreePeriods } from "@/lib/calculations/timetable";
import { todayIso } from "@/lib/date";
import styles from "./GoalsTab.module.css";

/**
 * The forward-looking half: a weekly target, the class board, and what's on
 * next.
 *
 * All three answer "why bother this week" rather than "what have I done" —
 * which is why they are not mixed into the practice tab's totals. A goal
 * shown next to a solved count reads as a score; shown next to free periods
 * and a contest date, it reads as a plan.
 */
export function GoalsTab() {
  const today = todayIso();
  const profileQuery = useCodingProfile();
  const solutionsQuery = useSolutions();
  const settings = useCodingSettings();
  const timetableQuery = useActiveTimetable(today);

  const linked = profileQuery.data?.linked ?? false;
  const leaderboardQuery = useCodingLeaderboard(linked);
  const contestsQuery = useContests(linked);

  const profile = profileQuery.data?.profile ?? null;
  const progress = useMemo(
    () => weeklyProgress(solutionsQuery.data ?? [], profile?.weeklyTarget ?? 0, today),
    [solutionsQuery.data, profile?.weeklyTarget, today],
  );

  const freeByDay = useMemo(() => {
    if (!timetableQuery.data) return null;
    return getWeeklyFreePeriods(timetableQuery.data.entries);
  }, [timetableQuery.data]);

  if (profileQuery.isLoading) {
    return (
      <div className={styles.stack}>
        <Skeleton height={140} />
        <Skeleton height={140} />
      </div>
    );
  }

  // Goals without any connected platform would be a target with nothing to
  // measure it against, and a board with nobody on it.
  if (!linked) {
    return (
      <EmptyState
        icon={Target}
        title="Connect a coding profile first"
        description="Goals, the class board and contest reminders all hang off your practice profiles. Add one on the Practice tab."
      />
    );
  }

  return (
    <div className={styles.stack}>
      <PracticeGoalCard
        progress={progress}
        freeByDay={freeByDay}
        onSave={(weeklyTarget) => settings.mutate({ weeklyTarget })}
        saving={settings.isPending}
      />

      {leaderboardQuery.data && (
        <ClassLeaderboard
          entries={leaderboardQuery.data.entries}
          sharing={profile?.shareToLeaderboard !== false}
          onToggleSharing={(shareToLeaderboard) => settings.mutate({ shareToLeaderboard })}
          toggling={settings.isPending}
        />
      )}

      {contestsQuery.data && contestsQuery.data.length > 0 && (
        <ContestList contests={contestsQuery.data} />
      )}
    </div>
  );
}
