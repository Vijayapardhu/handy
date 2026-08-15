import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { ROUTES } from "@/constants/routes";
import styles from "./DayProgressRow.module.css";

interface DayProgressRowProps {
  classesLeft: number;
  freePeriodsLeft: number;
  dueSoonCount: number;
}

/**
 * Three numbers that answer "what's left in my day" at a glance — classes
 * still ahead, free periods still ahead, and deadlines that need attention
 * this week. Pure computation over data the page already fetches.
 */
export function DayProgressRow({ classesLeft, freePeriodsLeft, dueSoonCount }: DayProgressRowProps) {
  return (
    <Card padded={false} className={styles.row}>
      <Link to={ROUTES.timetable} className={styles.stat}>
        <span className={styles.value}>{classesLeft}</span>
        <span className={styles.label}>{classesLeft === 1 ? "Class left" : "Classes left"}</span>
      </Link>
      <div className={styles.divider} />
      <Link to={ROUTES.timetable} className={styles.stat}>
        <span className={styles.value}>{freePeriodsLeft}</span>
        <span className={styles.label}>{freePeriodsLeft === 1 ? "Free period" : "Free periods"}</span>
      </Link>
      <div className={styles.divider} />
      <Link to={ROUTES.tasks} className={styles.stat}>
        <span className={styles.value}>{dueSoonCount}</span>
        <span className={styles.label}>Due soon</span>
      </Link>
    </Card>
  );
}
