import { Flame, TrendingUp, TrendingDown, Minus } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRecentAttendance } from "@/hooks/useRecentAttendance";
import { calculateMarkStreak, markAttendedHeld } from "@/lib/calculations/attendanceMarks";
import { calculateAttendance, roundPercentage } from "@/lib/calculations/attendance";
import { todayIso, addDaysIso } from "@/lib/date";
import type { AttendanceMarkDoc } from "@/types/attendanceMark";
import styles from "./StreakCard.module.css";

function weekPercentage(marks: AttendanceMarkDoc[]): number | null {
  const { attended, held } = markAttendedHeld(marks);
  if (held === 0) return null;
  return roundPercentage(calculateAttendance(attended, held));
}

/**
 * Home-page insight card: current day streak (no absences, worst-status-per-day
 * wins across all subjects) plus a this-week-vs-last-week % comparison. Purely
 * derived from the last 30 days of the student's own attendance marks — a
 * non-critical widget, so it fails quiet (renders nothing) rather than
 * blocking the rest of the home page on error.
 */
export function StreakCard() {
  const recentQuery = useRecentAttendance(30);

  if (recentQuery.isLoading) return <Skeleton height={96} />;
  if (recentQuery.isError || !recentQuery.data) return null;

  const marks = recentQuery.data;
  const byDate = new Map<string, AttendanceMarkDoc[]>();
  marks.forEach((m) => {
    const list = byDate.get(m.date) ?? [];
    list.push(m);
    byDate.set(m.date, list);
  });
  const datesDesc = [...byDate.keys()].sort().reverse();
  const streak = calculateMarkStreak(datesDesc.map((date) => ({ date, marks: byDate.get(date)! })));

  const today = todayIso();
  const weekAgo = addDaysIso(today, -6);
  const twoWeeksAgo = addDaysIso(today, -13);

  const thisWeekPct = weekPercentage(marks.filter((m) => m.date >= weekAgo && m.date <= today));
  const lastWeekPct = weekPercentage(marks.filter((m) => m.date >= twoWeeksAgo && m.date < weekAgo));
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
