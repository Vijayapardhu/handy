import { useMemo, useState } from "react";
import { CalendarClock, ClipboardList } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { TaskRow } from "@/components/tasks/TaskRow";
import { useTasks, useSetTaskDone, useDeleteTask } from "@/hooks/useTasks";
import { useActiveSubjectsMap } from "@/hooks/useActiveSubjectsMap";
import { useActiveTimetable } from "@/hooks/useTimetable";
import { countByUrgency, getDeadline, sortByUrgency } from "@/lib/calculations/deadlines";
import { getWeeklyFreePeriods } from "@/lib/calculations/timetable";
import { todayIso, WEEKDAY_LABELS } from "@/lib/date";
import { cn } from "@/lib/utils/cn";
import styles from "./DeadlinesTab.module.css";

type FilterId = "all" | "overdue" | "today" | "week";

/**
 * Everything a student has to remember that the college portal doesn't know
 * about — assignments, presentations, lab records — with the free periods
 * they could actually use to do it.
 *
 * The filter chips are new: a plain sorted list already puts the most urgent
 * thing first, but "how many are actually late" is a question a list answers
 * slowly and a count answers instantly. Tapping a chip narrows the list to
 * exactly what it counted, so the number is never just decoration.
 */
export function DeadlinesTab() {
  const today = todayIso();
  const tasksQuery = useTasks();
  const subjectsMap = useActiveSubjectsMap();
  const timetableQuery = useActiveTimetable(today);
  const setDone = useSetTaskDone();
  const removeTask = useDeleteTask();
  const [filter, setFilter] = useState<FilterId>("all");

  const open = useMemo(() => sortByUrgency(tasksQuery.data ?? [], today), [tasksQuery.data, today]);
  const done = useMemo(() => (tasksQuery.data ?? []).filter((t) => t.done), [tasksQuery.data]);
  const counts = useMemo(() => countByUrgency(tasksQuery.data ?? [], today), [tasksQuery.data, today]);

  const visible = useMemo(() => {
    if (filter === "all") return open;
    return open.filter((task) => {
      const days = getDeadline(task.dueDate, today).daysLeft;
      if (filter === "overdue") return days < 0;
      if (filter === "today") return days === 0;
      return days >= 0 && days <= 7;
    });
  }, [open, filter, today]);

  /** Free periods per weekday — the honest answer to "when can I get this done?". */
  const freeByDay = useMemo(() => {
    if (!timetableQuery.data) return null;
    return getWeeklyFreePeriods(timetableQuery.data.entries);
  }, [timetableQuery.data]);

  const totalFree = freeByDay
    ? [...freeByDay.values()].reduce((sum, periods) => sum + periods.length, 0)
    : 0;

  return (
    <div>
      {tasksQuery.isError && (
        <ErrorState message="Unable to load your tasks." onRetry={() => tasksQuery.refetch()} />
      )}

      {!tasksQuery.isError && tasksQuery.isLoading && (
        <div className={styles.loadingStack}>
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </div>
      )}

      {!tasksQuery.isError && !tasksQuery.isLoading && open.length === 0 && done.length === 0 && (
        <div className={styles.emptyWrap}>
          <EmptyState
            icon={ClipboardList}
            title="Nothing to remember yet"
            description="Add a presentation, an assignment deadline, or anything else you need to keep track of."
          />
        </div>
      )}

      {open.length > 0 && (
        <div className={styles.chips} role="tablist" aria-label="Filter deadlines">
          {(
            [
              ["all", "All", open.length],
              ["overdue", "Overdue", counts.overdue],
              ["today", "Today", counts.today],
              ["week", "This week", counts.week],
            ] as [FilterId, string, number][]
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={cn(styles.chip, filter === id && styles.chipSelected, id === "overdue" && counts.overdue > 0 && styles.chipDanger)}
              onClick={() => setFilter(id)}
            >
              {label}
              <span className={styles.chipCount}>{count}</span>
            </button>
          ))}
        </div>
      )}

      {open.length > 0 && (
        <div className={styles.list}>
          {visible.length === 0 ? (
            <p className={styles.filterEmpty}>Nothing in this filter — try another.</p>
          ) : (
            visible.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                subjectName={task.subjectId ? subjectsMap.bySubjectId.get(task.subjectId)?.name : undefined}
                onToggle={(isDone) => setDone.mutate({ taskId: task.id, done: isDone, task })}
                onDelete={() => removeTask.mutate(task.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Free periods sit below the list on purpose: they're the answer to a
          question the list has just raised. */}
      {totalFree > 0 && (
        <Card className={styles.freeCard}>
          <p className={styles.freeTitle}>
            <CalendarClock size={15} /> {totalFree} free periods this week
          </p>
          <div className={styles.freeGrid}>
            {[...freeByDay!.entries()].map(([day, periods]) => (
              <div key={day} className={styles.freeDay}>
                <span className={styles.freeDayName}>{WEEKDAY_LABELS[day]}</span>
                <span className={cn(styles.freeDayCount, periods.length > 0 && styles.freeDayHas)}>
                  {periods.length === 0 ? "—" : periods.length}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {done.length > 0 && (
        <>
          <p className={styles.sectionTitle}>Completed</p>
          <div className={styles.list}>
            {done.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                subjectName={
                  task.subjectId ? subjectsMap.bySubjectId.get(task.subjectId)?.name : undefined
                }
                onToggle={(isDone) => setDone.mutate({ taskId: task.id, done: isDone, task })}
                onDelete={() => removeTask.mutate(task.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
