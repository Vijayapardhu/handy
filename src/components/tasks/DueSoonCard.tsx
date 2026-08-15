import { Link } from "react-router-dom";
import { ChevronRight, ClipboardList } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { getDeadline, getDueSoon } from "@/lib/calculations/deadlines";
import { useTasks } from "@/hooks/useTasks";
import { todayIso } from "@/lib/date";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import styles from "./DueSoonCard.module.css";

const MAX_SHOWN = 3;

/**
 * Home-screen view of what's coming. Renders nothing when nothing is due
 * within the next few days — an empty "no deadlines" card would take up the
 * space every day of the week for the sake of the rare week it's wrong.
 */
export function DueSoonCard() {
  const today = todayIso();
  const { data: tasks } = useTasks();
  const dueSoon = getDueSoon(tasks ?? [], today);

  if (dueSoon.length === 0) return null;

  return (
    <Card className={styles.card}>
      <Link to={ROUTES.tasks} className={styles.header}>
        <span className={styles.title}>
          <ClipboardList size={15} /> Due soon
        </span>
        <span className={styles.count}>
          {dueSoon.length} <ChevronRight size={14} />
        </span>
      </Link>

      <div className={styles.list}>
        {dueSoon.slice(0, MAX_SHOWN).map((task) => {
          const deadline = getDeadline(task.dueDate, today, task.done);
          return (
            <div key={task.id} className={styles.row}>
              <span className={styles.taskTitle}>{task.title}</span>
              <span className={cn(styles.chip, styles[deadline.urgency])}>{deadline.label}</span>
            </div>
          );
        })}
      </div>

      {dueSoon.length > MAX_SHOWN && (
        <Link to={ROUTES.tasks} className={styles.more}>
          +{dueSoon.length - MAX_SHOWN} more
        </Link>
      )}
    </Card>
  );
}
