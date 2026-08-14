import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { getAttendanceStatus } from "@/lib/calculations/attendance";
import type { StatusThresholds } from "@/lib/calculations/attendance";
import styles from "./OverallAttendanceCard.module.css";

interface OverallAttendanceCardProps {
  percentage: number | null;
  attended: number;
  held: number;
  target: number;
  thresholds: StatusThresholds;
  /** When set, the whole card becomes a link (e.g. Home → Overall Attendance overview tab). */
  linkTo?: string;
}

/** SRS §8.2 — the single most important number on the home page. */
export function OverallAttendanceCard({
  percentage,
  attended,
  held,
  target,
  thresholds,
  linkTo,
}: OverallAttendanceCardProps) {
  const status = getAttendanceStatus(percentage, thresholds);
  const progressToTarget = percentage === null ? 0 : Math.min(100, (percentage / target) * 100);
  const gap = percentage === null ? null : Math.max(0, target - percentage);
  const circumference = 2 * Math.PI * 46;
  const dash = percentage === null ? 0 : (Math.min(percentage, 100) / 100) * circumference;

  const content = (
    <Card className={styles.card}>
      <div className={styles.top}>
        <div>
          <p className={styles.label}>Overall Attendance</p>
          <p className={styles.value}>{percentage === null ? "N/A" : `${percentage.toFixed(2)}%`}</p>
          <p className={styles.target}>
            Target <strong className={styles.targetValue}>{target}%</strong>
          </p>
        </div>
        <div className={styles.ring} aria-hidden="true">
          <svg viewBox="0 0 100 100" width={92} height={92}>
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--color-border)" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className={styles.ringCenter}>
            <span className={styles.ringAttended}>{attended}</span>
            <span className={styles.ringLabel}>Attended</span>
            <span className={styles.ringHeld}>{held}</span>
            <span className={styles.ringLabel}>Held</span>
          </div>
        </div>
      </div>

      <div className={styles.progressTrack}>
        <div
          className={styles.progressFill}
          data-status={status}
          style={{ width: `${progressToTarget}%` }}
        />
        <span className={styles.progressTargetMark} style={{ left: "100%" }} />
      </div>

      <p className={styles.footnote}>
        {gap === null
          ? "Attend a few classes to see your progress toward the target."
          : gap === 0
            ? "You've reached your target — nice work."
            : (
              <>
                You need <strong>{gap.toFixed(2)}%</strong> more to reach the target
              </>
            )}
      </p>
    </Card>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className={styles.linkWrap}>
        {content}
      </Link>
    );
  }
  return content;
}
