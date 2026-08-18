import { Link } from "react-router-dom";
import { Code2 } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useHubAttendance } from "@/hooks/useHubAttendance";
import { ROUTES } from "@/constants/routes";
import styles from "./HubAttendanceCard.module.css";

/** No college-configured target for the Hub the way OverallAttendanceCard has — these are plain, ungraded bands. */
function hubStatus(percentage: number | null): "critical" | "low" | "good" {
  if (percentage === null) return "good";
  if (percentage < 50) return "critical";
  if (percentage < 75) return "low";
  return "good";
}

/**
 * Second face of the Home page's attendance card stack (see CardSwiper),
 * shown only to students whose timetable has a Technical Hour period.
 *
 * Read-only here: connecting (and disconnecting) the Hub login lives on
 * Profile — see HubPortalCard — so there's exactly one place a credential is
 * entered. This card just shows what's there, or points to where to set it up.
 */
export function HubAttendanceCard() {
  const { data, isLoading, isError, refetch } = useHubAttendance(true);

  if (isLoading) {
    return (
      <Card className={styles.card}>
        <Skeleton height={160} />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className={styles.card}>
        <p className={styles.title}>Hub Attendance</p>
        <p className={styles.errorText}>Couldn&rsquo;t load Hub attendance.</p>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </Card>
    );
  }

  if (!data?.linked) {
    return (
      <Card className={styles.card}>
        <div className={styles.header}>
          <span className={styles.headerIcon} aria-hidden="true">
            <Code2 size={18} />
          </span>
          <div>
            <p className={styles.title}>Hub Attendance</p>
            <p className={styles.subtitle}>CodeForge and skills-hour sessions, from the Hub.</p>
          </div>
        </div>

        <p className={styles.hint}>Not connected yet.</p>

        <Link to={ROUTES.profile}>
          <Button variant="secondary" fullWidth size="sm">
            Connect from Profile
          </Button>
        </Link>
      </Card>
    );
  }

  const snapshot = data.snapshot;
  const percentage = snapshot?.percentage ?? null;
  const courseCount = snapshot?.courses.length ?? 0;

  return (
    <Link to={ROUTES.hubAttendance} className={styles.linkWrap}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <span className={styles.headerIcon} aria-hidden="true">
            <Code2 size={18} />
          </span>
          <div>
            <p className={styles.title}>Hub Attendance</p>
            <p className={styles.subtitle}>
              {courseCount} {courseCount === 1 ? "course" : "courses"} tracked
            </p>
          </div>
        </div>

        <p className={styles.value}>{percentage === null ? "N/A" : `${percentage.toFixed(2)}%`}</p>

        <ProgressBar value={percentage ?? 0} status={hubStatus(percentage)} />

        <p className={styles.footnote}>
          {snapshot ? `${snapshot.attendedSessions}/${snapshot.totalSessions} sessions attended` : "No data yet"}
        </p>
      </Card>
    </Link>
  );
}
