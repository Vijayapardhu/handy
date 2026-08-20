import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardList, Code2, Plus, Target } from "@/components/ui/icons";
import { TopHeader } from "@/components/layout/TopHeader";
import { Button } from "@/components/ui/Button";
import { TaskForm } from "@/components/tasks/TaskForm";
import { DeadlinesTab } from "./DeadlinesTab";
import { PracticeTab } from "./PracticeTab";
import { GoalsTab } from "./GoalsTab";
import { useTasks } from "@/hooks/useTasks";
import { useCodingProfile } from "@/hooks/useCoding";
import { useActiveSubjectsMap } from "@/hooks/useActiveSubjectsMap";
import { cn } from "@/lib/utils/cn";
import type { IconComponent } from "@/components/ui/icons";
import styles from "./TasksPage.module.css";

type TabId = "deadlines" | "practice" | "goals";

const TABS: { id: TabId; label: string; icon: IconComponent }[] = [
  { id: "deadlines", label: "Deadlines", icon: ClipboardList },
  { id: "practice", label: "Practice", icon: Code2 },
  { id: "goals", label: "Goals", icon: Target },
];

function isTabId(value: string | null): value is TabId {
  return value === "deadlines" || value === "practice" || value === "goals";
}

/**
 * One screen for "what should I be doing" — coursework and coding practice.
 *
 * These were always the same question. A student with a free period on
 * Wednesday is choosing between the lab record due Friday and the problems
 * they meant to solve this week, and until now those two lived on different
 * screens (one of which did not exist).
 *
 * The tab lives in the query string rather than in component state so a
 * refresh, a back button and a shared link all land where the student was —
 * and so a notification can point straight at /tasks?tab=practice.
 */
export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab: TabId = isTabId(rawTab) ? rawTab : "deadlines";

  const tasksQuery = useTasks();
  const codingQuery = useCodingProfile();
  const subjectsMap = useActiveSubjectsMap();
  const [showForm, setShowForm] = useState(false);

  const openCount = (tasksQuery.data ?? []).filter((task) => !task.done).length;

  function selectTab(next: TabId) {
    // `replace` so tabbing around does not fill the back stack with the same
    // page — Back should leave Tasks, not walk the tabs backwards.
    setSearchParams(next === "deadlines" ? {} : { tab: next }, { replace: true });
    setShowForm(false);
  }

  const subtitle =
    tab === "deadlines"
      ? openCount > 0
        ? `${openCount} to do`
        : "Nothing pending"
      : tab === "practice"
        ? `${codingQuery.data?.profile.totalSolved ?? 0} problems solved`
        : "Targets, class board and contests";

  return (
    <div>
      <TopHeader
        title="Tasks"
        subtitle={subtitle}
        action={
          // Only the deadlines tab has a header action; practice has its own
          // "Log" button next to the solve log, where the list it adds to is.
          tab === "deadlines" ? (
            <Button size="sm" onClick={() => setShowForm((value) => !value)}>
              <Plus size={14} /> Add
            </Button>
          ) : undefined
        }
      />

      <div className={styles.tabs} role="tablist" aria-label="Tasks sections">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={cn(styles.tab, tab === id && styles.selected)}
            onClick={() => selectTab(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === "deadlines" && (
        <>
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
    </div>
  );
}
