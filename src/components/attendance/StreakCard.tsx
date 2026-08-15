import { Flame, TrendingUp, TrendingDown, Minus } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRecentAttendance } from "@/hooks/useRecentAttendance";
import { calculateStreak } from "@/lib/calculations/dayStatus";
import { ATTENDED_STATUSES, calculateAttendance, roundPercentage } from "@/lib/calculations/attendance";
import { todayIso, addDaysIso } from "@/lib/date";
import type { AttendanceRecordDoc } from "@/types/attendance";
import styles from "./StreakCard.module.css";

function weekPercentage(records: AttendanceRecordDoc[]): number | null {
  const held = records.length;
  if (held === 0) return null;
  const attended = records.filter((r) => ATTENDED_STATUSES.has(r.status)).length;
  return roundPercentage(calculateAttendance(attended, held));
}

/**
 * Home-page insight card: current day streak (no absences, worst-status-per-day
 * wins across all subjects) plus a this-week-vs-last-week % comparison. Purely
 * derived from the last 30 days of individual attendance records — a
 * non-critical widget, so it fails quiet (renders nothing) rather than
 * blocking the rest of the home page on error.
 */
export function StreakCard() {
  const recentQuery = useRecentAttendance(30);

  if (recentQuery.isLoading) return <Skeleton height={96} />;
  if (recentQuery.isError || !recentQuery.data) return null;

  const records = recentQuery.data;
  const byDate = new Map<string, AttendanceRecordDoc[]>();
  records.forEach((r) => {
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
  });
  const datesDesc = [...byDate.keys()].sort().reverse();
  const streak = calculateStreak(datesDesc.map((date) => ({ date, records: byDate.get(date)! })));

  const today = todayIso();
  const weekAgo = addDaysIso(today, -6);
  const twoWeeksAgo = addDaysIso(today, -13);

  const thisWeekPct = weekPercentage(records.filter((r) => r.date >= weekAgo && r.date <= today));
  const lastWeekPct = weekPercentage(records.filter((r) => r.date >= twoWeeksAgo && r.date < weekAgo));
  const delta =
    thisWeekPct !== null && lastWeekPct !== null ? roundPercentage(thisWeekPct - lastWeekPct) : null;

  return (
    <Card className={styles.card}>
      <div className={styles.streak}>
        <span className={styles.flameWrap} data-active={streak > 0}>
          <Flame size={20} />
        </span>
        <div>
          <p className={styles.streakValue}>
            {streak > 0 ? `${streak}-day streak` : "No streak yet"}
          </p>
          <p className={styles.streakHint}>
            {streak > 0 ? "Attend today to keep it going" : "Attend every class today to start one"}
          </p>
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.comparison}>
        {delta === null ? (
          <p className={styles.comparisonHint}>Not enough data yet to compare weeks.</p>
        ) : (
          <p className={styles.comparisonHint}>
            <span className={styles.comparisonIcon} data-trend={delta > 0 ? "up" : delta < 0 ? "down" : "flat"}>
              {delta > 0 ? <TrendingUp size={14} /> : delta < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
            </span>
            This week is{" "}
            <strong>
              {delta === 0 ? "even with" : `${Math.abs(delta)}% ${delta > 0 ? "better than" : "lower than"}`}
            </strong>{" "}
            last week
          </p>
        )}
      </div>
    </Card>
  );
}
