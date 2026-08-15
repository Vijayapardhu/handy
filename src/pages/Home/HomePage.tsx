import { useMemo } from "react";
import { Bell, Menu } from "@/components/ui/icons";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { useSubjectsWithAttendance, useSubject } from "@/hooks/useSubjects";
import { useCollegeConfig } from "@/hooks/useCollegeConfig";
import { useActiveTimetable } from "@/hooks/useTimetable";
import { useNotifications } from "@/hooks/useNotifications";
import { OverallAttendanceCard } from "@/components/attendance/OverallAttendanceCard";
import { NeedsAttentionList } from "@/components/attendance/NeedsAttentionList";
import { NextClassCard } from "@/components/attendance/NextClassCard";
import { DueSoonCard } from "@/components/tasks/DueSoonCard";
import { LeavePlannerCta } from "@/components/attendance/LeavePlannerCta";
import { StreakCard } from "@/components/attendance/StreakCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { aggregateAttendance } from "@/lib/calculations/attendance";
import { getNextEntry } from "@/lib/calculations/timetable";
import { todayIso, nowTimeHHmm, dayOfWeekFromIso } from "@/lib/date";
import { ROUTES } from "@/constants/routes";
import styles from "./HomePage.module.css";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function HomePage() {
  const { student } = useAuth();
  const subjectsQuery = useSubjectsWithAttendance();
  const configQuery = useCollegeConfig(student?.collegeId);
  const timetableQuery = useActiveTimetable();
  const notificationsQuery = useNotifications();

  const today = todayIso();
  const nextEntry = useMemo(() => {
    if (!timetableQuery.data) return null;
    return getNextEntry(timetableQuery.data.entries, dayOfWeekFromIso(today), nowTimeHHmm());
  }, [timetableQuery.data, today]);
  const nextSubject = useSubject(nextEntry?.subjectId);

  const unreadCount = notificationsQuery.data?.filter((n) => !n.read).length ?? 0;

  const overall = useMemo(() => {
    if (!subjectsQuery.data) return null;
    return aggregateAttendance(subjectsQuery.data.map((s) => ({ attended: s.attended, held: s.held })));
  }, [subjectsQuery.data]);

  const isLoading = subjectsQuery.isLoading || configQuery.isLoading;
  const isError = subjectsQuery.isError || configQuery.isError;

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.iconButton} aria-label="Menu">
          <Menu size={22} />
        </button>
        <Link to={ROUTES.notifications} className={styles.iconButton} aria-label="Notifications">
          <Bell size={22} />
          {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
        </Link>
      </div>

      <div className={styles.greeting}>
        <h1 className={styles.greetingTitle}>
          {greeting()}, <span className={styles.name}>{student?.name.split(" ")[0] ?? ""}</span> 👋
        </h1>
        <p className={styles.greetingSubtitle}>Let&rsquo;s keep your attendance on track.</p>
      </div>

      {isError && (
        <ErrorState
          message="Unable to load your attendance. Please check your connection and try again."
          onRetry={() => {
            subjectsQuery.refetch();
            configQuery.refetch();
          }}
        />
      )}

      {!isError && isLoading && (
        <div className={styles.stack}>
          <Skeleton height={220} />
          <Skeleton height={160} />
          <Skeleton height={110} />
          <Skeleton height={80} />
        </div>
      )}

      {!isError && !isLoading && subjectsQuery.data && configQuery.data && (
        <div className={styles.stack}>
          <OverallAttendanceCard
            percentage={overall?.percentage ?? null}
            attended={overall?.attended ?? 0}
            held={overall?.held ?? 0}
            target={configQuery.data.minimumAttendancePercentage}
            thresholds={configQuery.data.statusThresholds}
            linkTo={`${ROUTES.subjects}?tab=overview`}
          />

          {/* Sits high on purpose: a deadline two days out matters more
              than a percentage that moved by 0.4%. */}
          <DueSoonCard />

          <StreakCard />

          <NeedsAttentionList subjects={subjectsQuery.data} />

          <NextClassCard
            entry={nextEntry}
            subject={nextSubject.data}
          />

          <LeavePlannerCta />
        </div>
      )}
    </div>
  );
}
