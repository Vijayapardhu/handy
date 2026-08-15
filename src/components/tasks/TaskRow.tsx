import { Link } from "react-router-dom";
import { Check, ListChecks, RefreshCw, Trash2 } from "@/components/ui/icons";
import { getDeadline } from "@/lib/calculations/deadlines";
import { formatTime12h, todayIso } from "@/lib/date";
import { TASK_KIND_LABELS, type TaskDoc } from "@/types/task";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import styles from "./TaskRow.module.css";

/**
 * One task. The countdown is the loudest thing on the row — a student scans
 * for "how long have I got", not for the title. The body is a link into
 * TaskDetailPage for subtasks/repeat/planning; the checkbox and delete button
 * sit outside it so they stay reachable without opening the detail page.
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
  const subtasksDone = task.subtasks.filter((s) => s.done).length;

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

      <Link to={ROUTES.taskDetail(task.id)} className={styles.body}>
        <p className={styles.title}>{task.title}</p>
        <p className={styles.meta}>
          {TASK_KIND_LABELS[task.kind]}
          {subjectName && ` · ${subjectName}`}
          {task.dueTime && ` · ${formatTime12h(task.dueTime)}`}
          {task.repeat !== "none" && (
            <span className={styles.badge}>
              <RefreshCw size={10} />
            </span>
          )}
          {task.subtasks.length > 0 && (
            <span className={styles.badge}>
              <ListChecks size={10} /> {subtasksDone}/{task.subtasks.length}
            </span>
          )}
        </p>
        {task.notes && <p className={styles.notes}>{task.notes}</p>}
      </Link>

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
