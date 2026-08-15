import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Bell, CalendarClock, Check, Plus, RefreshCw, Trash2, X } from "@/components/ui/icons";
import { TopHeader } from "@/components/layout/TopHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTasks, useSetTaskDone, useUpdateTask, useDeleteTask } from "@/hooks/useTasks";
import { useActiveSubjectsMap } from "@/hooks/useActiveSubjectsMap";
import { useActiveTimetable } from "@/hooks/useTimetable";
import { getEntriesForDay, getWeeklyFreePeriods } from "@/lib/calculations/timetable";
import { getDeadline } from "@/lib/calculations/deadlines";
import { formatTime12h, formatDisplayDate, todayIso, WEEKDAY_LABELS } from "@/lib/date";
import { TASK_KIND_LABELS, TASK_REPEAT_LABELS } from "@/types/task";
import type { TaskRepeat } from "@/types/task";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import styles from "./TaskDetailPage.module.css";

const REPEATS = Object.keys(TASK_REPEAT_LABELS) as TaskRepeat[];
const LEAD_DAY_OPTIONS = [1, 2, 3, 5, 7];

interface Slot {
  kind: "class" | "free";
  startTime: string;
  label: string;
}

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const tasksQuery = useTasks();
  const subjectsMap = useActiveSubjectsMap();
  const timetableQuery = useActiveTimetable(todayIso());
  const setDone = useSetTaskDone();
  const update = useUpdateTask();
  const removeTask = useDeleteTask();
  const [newSubtask, setNewSubtask] = useState("");
  const [plannerOpen, setPlannerOpen] = useState(false);

  const task = tasksQuery.data?.find((t) => t.id === taskId);

  const slotsByDay = useMemo(() => {
    const map = new Map<number, Slot[]>();
    if (!timetableQuery.data) return map;
    const free = getWeeklyFreePeriods(timetableQuery.data.entries);
    const taughtDays = new Set(timetableQuery.data.entries.filter((e) => e.active).map((e) => e.dayOfWeek));
    const days = new Set([...taughtDays, ...free.keys()]);
    for (const day of days) {
      const classes: Slot[] = getEntriesForDay(timetableQuery.data.entries, day)
        .filter((e) => e.type !== "break")
        .map((e) => ({
          kind: "class",
          startTime: e.startTime,
          label: subjectsMap.bySubjectId.get(e.subjectId)?.shortName ?? subjectsMap.bySubjectId.get(e.subjectId)?.name ?? "Class",
        }));
      const freeSlots: Slot[] = (free.get(day) ?? []).map((f) => ({
        kind: "free",
        startTime: f.startTime,
        label: "Free period",
      }));
      map.set(day, [...classes, ...freeSlots].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    }
    return map;
  }, [timetableQuery.data, subjectsMap.bySubjectId]);

  if (tasksQuery.isLoading) {
    return (
      <div className="page-narrow">
        <TopHeader title="Deadline" back />
        <Skeleton height={200} />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="page-narrow">
        <TopHeader title="Deadline" back />
        <EmptyState title="This deadline is gone" description="It may have been deleted." />
      </div>
    );
  }

  const deadline = getDeadline(task.dueDate, todayIso(), task.done);
  const subjectName = task.subjectId ? subjectsMap.bySubjectId.get(task.subjectId)?.name : undefined;
  const subtasksDone = task.subtasks.filter((s) => s.done).length;
  const progress = task.subtasks.length > 0 ? Math.round((subtasksDone / task.subtasks.length) * 100) : 0;

  function toggleSubtask(index: number) {
    if (!task) return;
    const next = task.subtasks.map((s, i) => (i === index ? { ...s, done: !s.done } : s));
    update.mutate({ taskId: task.id, edits: { subtasks: next } });
  }

  function deleteSubtask(index: number) {
    if (!task) return;
    update.mutate({ taskId: task.id, edits: { subtasks: task.subtasks.filter((_, i) => i !== index) } });
  }

  function handleAddSubtask(event: FormEvent) {
    event.preventDefault();
    if (!task || !newSubtask.trim()) return;
    update.mutate({ taskId: task.id, edits: { subtasks: [...task.subtasks, { title: newSubtask.trim(), done: false }] } });
    setNewSubtask("");
  }

  function setRepeat(repeat: TaskRepeat) {
    if (!task) return;
    update.mutate({ taskId: task.id, edits: { repeat } });
  }

  function setLeadDays(leadDays: number | null) {
    if (!task) return;
    update.mutate({ taskId: task.id, edits: { leadDays } });
  }

  function attachSlot(day: number, slot: Slot) {
    if (!task) return;
    update.mutate({
      taskId: task.id,
      edits: { attachDay: day, attachTime: slot.startTime, attachLabel: slot.label },
    });
    setPlannerOpen(false);
  }

  function clearAttachment() {
    if (!task) return;
    update.mutate({ taskId: task.id, edits: { attachDay: null, attachTime: null, attachLabel: null } });
  }

  async function handleDelete() {
    if (!task) return;
    await removeTask.mutateAsync(task.id);
    navigate(ROUTES.tasks, { replace: true });
  }

  return (
    <div className="page-narrow">
      <TopHeader title="Deadline" back />

      <Card className={styles.headerCard}>
        <div className={styles.headerRow}>
          <button
            type="button"
            className={cn(styles.check, task.done && styles.checked)}
            onClick={() => setDone.mutate({ taskId: task.id, done: !task.done, task })}
            aria-label={task.done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
          >
            {task.done && <Check size={14} strokeWidth={3} />}
          </button>
          <div className={styles.headerBody}>
            <p className={cn(styles.title, task.done && styles.titleDone)}>{task.title}</p>
            <p className={styles.meta}>
              {TASK_KIND_LABELS[task.kind]}
              {subjectName && ` · ${subjectName}`}
            </p>
          </div>
          <span className={cn(styles.countdown, styles[deadline.urgency])}>{deadline.label}</span>
        </div>
        <p className={styles.dueLine}>
          Due {formatDisplayDate(task.dueDate)}
          {task.dueTime && ` at ${formatTime12h(task.dueTime)}`}
        </p>
        {task.notes && <p className={styles.notes}>{task.notes}</p>}
      </Card>

      <p className={styles.sectionTitle}>Steps</p>
      <Card className={styles.section}>
        {task.subtasks.length > 0 && (
          <>
            <ProgressBar value={progress} className={styles.progressBar} />
            <p className={styles.progressLabel}>
              {subtasksDone} of {task.subtasks.length} done
            </p>
            <ul className={styles.subtaskList}>
              {task.subtasks.map((s, i) => (
                <li key={i} className={styles.subtaskRow}>
                  <button
                    type="button"
                    className={cn(styles.subtaskCheck, s.done && styles.checked)}
                    onClick={() => toggleSubtask(i)}
                    aria-label={s.done ? `Mark ${s.title} as not done` : `Mark ${s.title} as done`}
                  >
                    {s.done && <Check size={11} strokeWidth={3} />}
                  </button>
                  <span className={cn(styles.subtaskTitle, s.done && styles.subtaskDone)}>{s.title}</span>
                  <button
                    type="button"
                    className={styles.subtaskDelete}
                    onClick={() => deleteSubtask(i)}
                    aria-label={`Remove step ${s.title}`}
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <form className={styles.addSubtaskRow} onSubmit={handleAddSubtask}>
          <input
            className={styles.addSubtaskInput}
            placeholder="Add a step — write, print, get it signed…"
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            maxLength={120}
          />
          <Button type="submit" size="sm" variant="secondary" disabled={!newSubtask.trim()}>
            <Plus size={14} />
          </Button>
        </form>
      </Card>

      <p className={styles.sectionTitle}>
        <RefreshCw size={13} /> Repeat
      </p>
      <Card padded={false} className={styles.chipCard}>
        {REPEATS.map((r) => (
          <button
            key={r}
            type="button"
            className={cn(styles.chip, task.repeat === r && styles.chipActive)}
            onClick={() => setRepeat(r)}
          >
            {TASK_REPEAT_LABELS[r]}
          </button>
        ))}
      </Card>

      <p className={styles.sectionTitle}>
        <Bell size={13} /> Remind me
      </p>
      <Card padded={false} className={styles.chipCard}>
        <button
          type="button"
          className={cn(styles.chip, task.leadDays === null && styles.chipActive)}
          onClick={() => setLeadDays(null)}
        >
          Default
        </button>
        {LEAD_DAY_OPTIONS.map((d) => (
          <button
            key={d}
            type="button"
            className={cn(styles.chip, task.leadDays === d && styles.chipActive)}
            onClick={() => setLeadDays(d)}
          >
            {d} {d === 1 ? "day" : "days"} before
          </button>
        ))}
      </Card>

      <p className={styles.sectionTitle}>
        <CalendarClock size={13} /> When will you do it?
      </p>
      <Card className={styles.section}>
        {task.attachDay !== null && task.attachTime !== null ? (
          <div className={styles.attachedRow}>
            <span>
              {WEEKDAY_LABELS[task.attachDay]} · {formatTime12h(task.attachTime)} · {task.attachLabel}
            </span>
            <button type="button" className={styles.subtaskDelete} onClick={clearAttachment} aria-label="Remove planned slot">
              <X size={14} />
            </button>
          </div>
        ) : (
          <p className={styles.plannerHint}>Pin this to a free period or class so it has a moment, not just a date.</p>
        )}

        {!plannerOpen && (
          <Button variant="secondary" size="sm" onClick={() => setPlannerOpen(true)} className={styles.plannerToggle}>
            {task.attachDay !== null ? "Change slot" : "Pick a slot"}
          </Button>
        )}

        {plannerOpen && (
          <div className={styles.planner}>
            {timetableQuery.isLoading && <Skeleton height={100} />}
            {!timetableQuery.isLoading && slotsByDay.size === 0 && (
              <p className={styles.plannerHint}>No timetable published yet.</p>
            )}
            {[...slotsByDay.entries()].map(([day, slots]) => (
              <div key={day} className={styles.plannerDay}>
                <p className={styles.plannerDayLabel}>{WEEKDAY_LABELS[day]}</p>
                <div className={styles.plannerSlots}>
                  {slots.map((slot) => (
                    <button
                      key={`${day}-${slot.startTime}`}
                      type="button"
                      className={cn(styles.slotChip, slot.kind === "free" && styles.slotFree)}
                      onClick={() => attachSlot(day, slot)}
                    >
                      {formatTime12h(slot.startTime)} · {slot.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setPlannerOpen(false)}>
              Close
            </Button>
          </div>
        )}
      </Card>

      <Button variant="danger" fullWidth onClick={handleDelete} loading={removeTask.isPending} className={styles.deleteButton}>
        <Trash2 size={16} /> Delete deadline
      </Button>
    </div>
  );
}
