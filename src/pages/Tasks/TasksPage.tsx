import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ClipboardList, Code2, Compass, Flame, Plus, Target } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { TaskForm } from "@/components/tasks/TaskForm";
import { FocusHero } from "@/components/tasks/FocusHero";
import { DeadlinesTab } from "./DeadlinesTab";
import { PracticeTab } from "./PracticeTab";
import { GoalsTab } from "./GoalsTab";
import { RoadmapTab } from "./RoadmapTab";
import { useTasks } from "@/hooks/useTasks";
import { useCodingProfile, useSolutions } from "@/hooks/useCoding";
import { useActiveSubjectsMap } from "@/hooks/useActiveSubjectsMap";
import { useActiveTimetable } from "@/hooks/useTimetable";
import { countByUrgency, focusMessage } from "@/lib/calculations/deadlines";
import { buildActivityMap, currentStreak, weeklyProgress } from "@/lib/calculations/coding";
import { roadmapMastery } from "@/lib/calculations/mastery";
import { getWeeklyFreePeriods } from "@/lib/calculations/timetable";
import { DSA_TOPICS } from "@/constants/dsaTopics";
import { todayIso } from "@/lib/date";
import { cn } from "@/lib/utils/cn";
import type { IconComponent } from "@/components/ui/icons";
import styles from "./TasksPage.module.css";

type TabId = "deadlines" | "practice" | "goals" | "roadmap";

function isTabId(value: string | null): value is TabId {
  return value === "deadlines" || value === "practice" || value === "goals" || value === "roadmap";
}

/**
 * One screen for "what should I be doing" — coursework and coding practice.
 *
 * These were always the same question. A student with a free period on
 * Wednesday is choosing between the lab record due Friday and the problems
 * they meant to solve this week, and the two used to live on different
 * screens (one of which didn't exist).
 *
 * The redesign's shape: a hero band that answers the question in one glance —
 * real numbers, not a page title — then three tabs that go deep on each. The
 * hero is read-only; the tabs (each carrying its own badge) are where a tap
 * actually goes somewhere. Two controls doing the same job would just be
 * confusing about which one to use.
 */
export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab: TabId = isTabId(rawTab) ? rawTab : "deadlines";
  const today = todayIso();

  const tasksQuery = useTasks();
  const codingQuery = useCodingProfile();
  const solutionsQuery = useSolutions();
  const timetableQuery = useActiveTimetable(today);
  const subjectsMap = useActiveSubjectsMap();
  const [showForm, setShowForm] = useState(false);

  const tasks = tasksQuery.data ?? [];
  const openCount = tasks.filter((t) => !t.done).length;
  const urgency = useMemo(() => countByUrgency(tasksQuery.data ?? [], today), [tasksQuery.data, today]);
  const hero = useMemo(() => focusMessage(tasksQuery.data ?? [], today), [tasksQuery.data, today]);

  const profile = codingQuery.data?.profile ?? null;
  const linked = codingQuery.data?.linked ?? false;
  const streak = useMemo(() => {
    if (!profile) return null;
    return currentStreak(buildActivityMap(profile.stats, solutionsQuery.data ?? []), today);
  }, [profile, solutionsQuery.data, today]);
  const goalProgress = useMemo(
    () => weeklyProgress(solutionsQuery.data ?? [], profile?.weeklyTarget ?? 0, today),
    [solutionsQuery.data, profile?.weeklyTarget, today],
  );
  const topicsTouched = useMemo(
    () => roadmapMastery(solutionsQuery.data ?? [], today).filter((entry) => entry.solved > 0).length,
    [solutionsQuery.data, today],
  );

  const freeCount = useMemo(() => {
    if (!timetableQuery.data) return 0;
    const byDay = getWeeklyFreePeriods(timetableQuery.data.entries);
    return [...byDay.values()].reduce((sum, periods) => sum + periods.length, 0);
  }, [timetableQuery.data]);

  const TABS: {
    id: TabId;
    label: string;
    icon: IconComponent;
    badge: string | null;
    badgeTone: "danger" | "flame" | "goal" | "roadmap" | null;
  }[] = [
    {
      id: "deadlines",
      label: "Deadlines",
      icon: ClipboardList,
      badge: openCount > 0 ? String(openCount) : null,
      badgeTone: urgency.overdue > 0 ? "danger" : null,
    },
    {
      id: "practice",
      label: "Practice",
      icon: Code2,
      badge: linked && (streak ?? 0) > 0 ? String(streak) : null,
      badgeTone: "flame",
    },
    {
      id: "goals",
      label: "Goals",
      icon: Target,
      badge: goalProgress.target > 0 ? `${goalProgress.percent}%` : null,
      badgeTone: "goal",
    },
    {
      id: "roadmap",
      label: "Roadmap",
      icon: Compass,
      badge: topicsTouched > 0 ? `${topicsTouched}/${DSA_TOPICS.length}` : null,
      badgeTone: "roadmap",
    },
  ];

  function selectTab(next: TabId) {
    // `replace` so tabbing around does not fill the back stack with the same
    // page — Back should leave Tasks, not walk the tabs backwards.
    setSearchParams(next === "deadlines" ? {} : { tab: next }, { replace: true });
    setShowForm(false);
  }

  return (
    <div>
      <FocusHero
        message={hero}
        urgent={urgency.overdue > 0}
        dateLabel={format(parseISO(today), "EEEE · d MMM").toUpperCase()}
        weekCount={urgency.week}
        freeCount={freeCount}
        streak={streak}
        linked={linked}
      />

      <div className={styles.tabs} role="tablist" aria-label="Tasks sections">
        {TABS.map(({ id, label, icon: Icon, badge, badgeTone }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={cn(styles.tab, tab === id && styles.selected)}
            onClick={() => selectTab(id)}
          >
            <Icon size={16} />
            {label}
            {badge && (
              <span className={cn(styles.badge, badgeTone && styles[badgeTone])}>
                {badgeTone === "flame" && <Flame size={10} />}
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "deadlines" && (
        <>
          <div className={styles.tabHead}>
            <Button size="sm" onClick={() => setShowForm((value) => !value)}>
              <Plus size={14} /> Add deadline
            </Button>
          </div>
          {showForm && (
            <TaskForm
              subjects={[...subjectsMap.bySubjectId.values()]}
              onClose={() => setShowForm(false)}
            />
          )}
          <DeadlinesTab />
        </>
      )}

      {tab === "practice" && <PracticeTab />}
      {tab === "goals" && <GoalsTab />}
      {tab === "roadmap" && <RoadmapTab />}
    </div>
  );
}
