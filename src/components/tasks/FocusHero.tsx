import { AlertTriangle, Calendar, CalendarClock, Flame } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";
import styles from "./FocusHero.module.css";

export interface FocusHeroProps {
  /** The one sentence — see lib/calculations/deadlines.focusMessage. */
  message: string;
  urgent: boolean;
  dateLabel: string;
  weekCount: number;
  freeCount: number;
  streak: number | null;
  /** Null when nothing has ever loaded (profile still fetching); distinct from 0. */
  linked: boolean;
}

/**
 * The first thing a student sees on Tasks now — one glance, three real
 * numbers, no title bar pretending "Tasks" is the point.
 *
 * The three stats are read-only on purpose. Navigation stays with the tab
 * strip below (which carries its own badges) — a second, separately-clickable
 * copy of the same numbers here would just be two controls doing one job.
 * This band answers "how am I actually doing", the tabs answer "where do I go
 * to act on it".
 */
export function FocusHero({
  message,
  urgent,
  dateLabel,
  weekCount,
  freeCount,
  streak,
  linked,
}: FocusHeroProps) {
  return (
    <div className={cn(styles.hero, urgent && styles.urgent)}>
      <p className={styles.eyebrow}>{dateLabel}</p>
      <p className={styles.message}>
        {urgent && <AlertTriangle size={17} className={styles.messageIcon} />}
        {message}
      </p>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <Calendar size={15} className={styles.statIcon} />
          <span className={styles.statValue}>{weekCount}</span>
          <span className={styles.statLabel}>this week</span>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.stat}>
          <Flame size={15} className={cn(styles.statIcon, Boolean(streak) && styles.flameLit)} />
          <span className={styles.statValue}>{linked ? (streak ?? 0) : "—"}</span>
          <span className={styles.statLabel}>{linked ? "day streak" : "not connected"}</span>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.stat}>
          <CalendarClock size={15} className={styles.statIcon} />
          <span className={styles.statValue}>{freeCount}</span>
          <span className={styles.statLabel}>free periods</span>
        </div>
      </div>
    </div>
  );
}
