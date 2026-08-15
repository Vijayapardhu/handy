import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useCreateTask } from "@/hooks/useTasks";
import { todayIso } from "@/lib/date";
import { TASK_KIND_LABELS, TASK_REPEAT_LABELS, type TaskKind, type TaskRepeat } from "@/types/task";
import type { SubjectDoc } from "@/types/subject";
import styles from "./TaskForm.module.css";

const KINDS = Object.keys(TASK_KIND_LABELS) as TaskKind[];
const REPEATS = Object.keys(TASK_REPEAT_LABELS) as TaskRepeat[];

/**
 * Quick add. Only a title and a date are required — anything that makes a
 * student stop and think is a reason not to write the thing down at all.
 */
export function TaskForm({ subjects, onClose }: { subjects: SubjectDoc[]; onClose: () => void }) {
  const createTask = useCreateTask();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TaskKind>("assignment");
  const [dueDate, setDueDate] = useState(todayIso());
  const [dueTime, setDueTime] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [repeat, setRepeat] = useState<TaskRepeat>("none");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    await createTask.mutateAsync({ title, kind, dueDate, dueTime, subjectId, notes, repeat });
    onClose();
  }

  return (
    <Card className={styles.card}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          placeholder="What do you need to remember?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          maxLength={120}
        />

        <div className={styles.kinds}>
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={k === kind ? styles.kindActive : styles.kind}
              onClick={() => setKind(k)}
            >
              {TASK_KIND_LABELS[k]}
            </button>
          ))}
        </div>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Due date</span>
            <input
              className={styles.input}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Time (optional)</span>
            <input
              className={styles.input}
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
            />
          </label>
        </div>

        {subjects.length > 0 && (
          <label className={styles.field}>
            <span className={styles.label}>Subject (optional)</span>
            <select
              className={styles.input}
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              {/* Linking a subject is what lets the task appear on that class
                  in the timetable. */}
              <option value="">Not tied to a subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className={styles.field}>
          <span className={styles.label}>Repeat</span>
          <select className={styles.input} value={repeat} onChange={(e) => setRepeat(e.target.value as TaskRepeat)}>
            {REPEATS.map((r) => (
              <option key={r} value={r}>
                {TASK_REPEAT_LABELS[r]}
              </option>
            ))}
          </select>
        </label>

        <textarea
          className={styles.textarea}
          placeholder="Notes — what to prepare, what to bring…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={500}
        />

        <div className={styles.actions}>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={createTask.isPending} disabled={!title.trim()}>
            Add task
          </Button>
        </div>
      </form>
    </Card>
  );
}
