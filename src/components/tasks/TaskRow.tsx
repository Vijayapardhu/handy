import { Check, Trash2 } from "lucide-react";
import { getDeadline } from "@/lib/calculations/deadlines";
import { formatTime12h, todayIso } from "@/lib/date";
import { TASK_KIND_LABELS, type TaskDoc } from "@/types/task";
import { cn } from "@/lib/utils/cn";
import styles from "./TaskRow.module.css";

/**
 * One task. The countdown is the loudest thing on the row — a student scans
 * for "how long have I got", not for the title.
 */
export function TaskRow({
  task,
  subjectName,
  onToggle,
  onDelete,
}: {
  task: TaskDoc;
  subjectName?: string;
  onToggle: (done: boolean) => void;
  onDelete: () => void;
}) {
  const deadline = getDeadline(task.dueDate, todayIso(), task.done);

  return (
    <div className={cn(styles.row, task.done && styles.doneRow)}>
      <button
        type="button"
        className={cn(styles.check, task.done && styles.checked)}
        onClick={() => onToggle(!task.done)}
        aria-label={task.done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
      >
        {task.done && <Check size={13} strokeWidth={3} />}
      </button>

      <div className={styles.body}>
        <p className={styles.title}>{task.title}</p>
        <p className={styles.meta}>
          {TASK_KIND_LABELS[task.kind]}
          {subjectName && ` · ${subjectName}`}
          {task.dueTime && ` · ${formatTime12h(task.dueTime)}`}
        </p>
        {task.notes && <p className={styles.notes}>{task.notes}</p>}
      </div>

      <div className={styles.tail}>
        <span className={cn(styles.countdown, styles[deadline.urgency])}>{deadline.label}</span>
        <button
          type="button"
          className={styles.delete}
          onClick={onDelete}
          aria-label={`Delete ${task.title}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
