import { Link } from "react-router-dom";
import { Code2 } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { codeForgeStats, getHubStatus } from "@/lib/calculations/hubAttendance";
import { useHubAttendance } from "@/hooks/useHubAttendance";
import { ROUTES } from "@/constants/routes";
import styles from "./HubAttendanceCard.module.css";

/**
 * Second face of the Home page's attendance card stack (see CardSwiper),
 * shown only to students whose timetable has a Technical Hour period.
 *
 * Deliberately built to the same rhythm as OverallAttendanceCard — same ring
 * math, same bar-then-footnote layout, same ~220px height — because a swipe
 * between the two should feel like turning the same card over, not landing on
 * a different, flatter component. Color comes from getHubStatus, the same
 * bands the breakdown page and Profile's connect card use, so a percentage
 * never reads as one status here and a different one there.
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
        <Skeleton height={220} />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className={styles.card}>
        <div className={styles.centeredState}>
          <span className={styles.headerIcon} aria-hidden="true">
            <Code2 size={20} />
          </span>
          <p className={styles.title}>CodeForge Attendance</p>
          <p className={styles.stateText}>Couldn&rsquo;t load CodeForge attendance.</p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!data?.linked) {
    return (
      <Card className={styles.card}>
        <div className={styles.centeredState}>
          <span className={styles.headerIcon} aria-hidden="true">
            <Code2 size={20} />
          </span>
          <p className={styles.title}>CodeForge Attendance</p>
          <p className={styles.stateText}>CodeForge and skills-hour sessions, from Maya.</p>
          <Link to={ROUTES.profile}>
            <Button variant="secondary" size="sm">
              Connect from Profile
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  const snapshot = data.snapshot;
  // CodeForge only — the ability courses on the same Maya login are not part of
  // a CodeForge percentage. See codeForgeStats / isCodeForgeCourse.
  const cf = snapshot ? codeForgeStats(snapshot) : null;
  const percentage = cf?.percentage ?? null;
  const attended = cf?.attendedSessions ?? 0;
  const held = cf?.totalSessions ?? 0;
  const courseCount = cf?.courses.length ?? 0;
  const status = getHubStatus(percentage);

  const circumference = 2 * Math.PI * 46;
  const dash = percentage === null ? 0 : (Math.min(percentage, 100) / 100) * circumference;

  return (
    <Link to={ROUTES.hubAttendance} className={styles.linkWrap}>
      <Card className={styles.card}>
        <div className={styles.top}>
          <div>
            <p className={styles.label}>CodeForge Attendance</p>
            <div className={styles.valueRow}>
              <p className={styles.value}>{percentage === null ? "N/A" : `${percentage.toFixed(2)}%`}</p>
              <StatusBadge status={status} />
            </div>
            <p className={styles.meta}>
              {courseCount} {courseCount === 1 ? "course" : "courses"} tracked
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
          <div className={styles.progressFill} data-status={status} style={{ width: `${percentage ?? 0}%` }} />
        </div>

        <p className={styles.footnote}>
          {held === 0
            ? "Attend a session to see your progress here."
            : `${attended}/${held} sessions attended`}
        </p>
      </Card>
    </Link>
  );
}
