import { Link } from "react-router-dom";
import { GraduationCap, ChevronRight } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { useTasks } from "@/hooks/useTasks";
import { getDeadline } from "@/lib/calculations/deadlines";
import { todayIso } from "@/lib/date";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import styles from "./ExamCountdownCard.module.css";

const URGENT_DAYS = 7;

/**
 * The nearest open exam, singled out from the general task list — an exam is
 * the one deadline that isn't optional to prepare for, so it earns its own
 * card rather than blending into "Due soon". Renders nothing when there is
 * no upcoming exam, the same "no news is no card" rule DueSoonCard follows.
 */
export function ExamCountdownCard() {
  const today = todayIso();
  const { data: tasks } = useTasks();

  const nextExam = (tasks ?? [])
    .filter((t) => t.kind === "exam" && !t.done)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  if (!nextExam) return null;

  const deadline = getDeadline(nextExam.dueDate, today, false);
  const urgent = deadline.daysLeft <= URGENT_DAYS;

  return (
    <Link to={ROUTES.taskDetail(nextExam.id)} className={styles.link}>
      <Card className={cn(styles.card, urgent && styles.urgent)}>
        <div className={styles.iconWrap}>
          <GraduationCap size={18} />
        </div>
        <div className={styles.body}>
          <p className={styles.eyebrow}>Next exam</p>
          <p className={styles.title}>{nextExam.title}</p>
        </div>
        <div className={styles.tail}>
          <span className={styles.countdown}>{deadline.label}</span>
          <ChevronRight size={16} className={styles.chevron} />
        </div>
      </Card>
    </Link>
  );
}
