import { useMemo } from "react";
import { CalendarClock, ClipboardList } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { TaskRow } from "@/components/tasks/TaskRow";
import { useTasks, useSetTaskDone, useDeleteTask } from "@/hooks/useTasks";
import { useActiveSubjectsMap } from "@/hooks/useActiveSubjectsMap";
import { useActiveTimetable } from "@/hooks/useTimetable";
import { sortByUrgency } from "@/lib/calculations/deadlines";
import { getWeeklyFreePeriods } from "@/lib/calculations/timetable";
import { todayIso, WEEKDAY_LABELS } from "@/lib/date";
import styles from "./DeadlinesTab.module.css";

/**
 * Everything a student has to remember that the college portal doesn't know
 * about — assignments, presentations, lab records — with the free periods
 * they could actually use to do it.
 *
 * Unchanged behaviour from when this was the whole Tasks page; it is a tab now
 * because coursework and coding practice are two halves of the same question
 * ("what should I be doing?") and were living on two screens.
 */
export function DeadlinesTab() {
  const today = todayIso();
  const tasksQuery = useTasks();
  const subjectsMap = useActiveSubjectsMap();
  const timetableQuery = useActiveTimetable(today);
  const setDone = useSetTaskDone();
  const removeTask = useDeleteTask();

  const open = useMemo(() => sortByUrgency(tasksQuery.data ?? [], today), [tasksQuery.data, today]);
  const done = useMemo(() => (tasksQuery.data ?? []).filter((t) => t.done), [tasksQuery.data]);

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
        <div className={styles.list}>
          {open.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              subjectName={task.subjectId ? subjectsMap.bySubjectId.get(task.subjectId)?.name : undefined}
              onToggle={(isDone) => setDone.mutate({ taskId: task.id, done: isDone, task })}
              onDelete={() => removeTask.mutate(task.id)}
            />
          ))}
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
                <span className={styles.freeDayCount}>
                  {periods.length === 0 ? "—" : `${periods.length} free`}
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
