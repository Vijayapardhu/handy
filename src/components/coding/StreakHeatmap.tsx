import { Flame } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { formatShortDate } from "@/lib/date";
import type { ActivityDay } from "@/lib/calculations/coding";
import styles from "./StreakHeatmap.module.css";

/**
 * Twelve weeks of practice, one square per day.
 *
 * Built from LeetCode's submission calendar plus anything logged in the solve
 * log, so a student who practises on Codeforces and writes it down still has
 * a streak. The gaps are the point — this is the one view that shows the
 * weeks nothing happened, which is what a "247 problems solved" total hides.
 */
export function StreakHeatmap({
  days,
  streak,
  longest,
}: {
  days: ActivityDay[];
  streak: number;
  longest: number;
}) {
  const activeDays = days.filter((day) => day.count > 0).length;

  return (
    <Card className={styles.card}>
      <div className={styles.head}>
        <p className={styles.title}>
          <Flame size={15} className={streak > 0 ? styles.flameLit : styles.flameOut} />
          {streak > 0 ? `${streak}-day streak` : "No streak yet"}
        </p>
        <p className={styles.sub}>
          {activeDays} active {activeDays === 1 ? "day" : "days"}
          {longest > 0 && ` · best ${longest}`}
        </p>
      </div>

      {/* Column-major: each column is a week, so the rows line up as weekdays
          the way every practice heatmap a student has already seen does. */}
      <div className={styles.grid} role="img" aria-label={`Practice activity, ${activeDays} active days in the last ${days.length}`}>
        {days.map((day) => (
          <span
            key={day.date}
            className={styles.cell}
            data-level={day.level}
            title={`${formatShortDate(day.date)} — ${day.count === 0 ? "nothing" : `${day.count} solved`}`}
          />
        ))}
      </div>

      <div className={styles.legend}>
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} className={styles.cell} data-level={level} />
        ))}
        <span>More</span>
      </div>
    </Card>
  );
}
