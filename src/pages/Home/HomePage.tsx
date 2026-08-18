import { useMemo } from "react";
import { Bell } from "@/components/ui/icons";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { useSubjectsWithAttendance, useSubject } from "@/hooks/useSubjects";
import { useCollegeConfig } from "@/hooks/useCollegeConfig";
import { useActiveTimetable } from "@/hooks/useTimetable";
import { useNotifications } from "@/hooks/useNotifications";
import { useTasks } from "@/hooks/useTasks";
import { useCampusFeatures } from "@/hooks/useCampusFeatures";
import { OverallAttendanceCard } from "@/components/attendance/OverallAttendanceCard";
import { HubAttendanceCard } from "@/components/attendance/HubAttendanceCard";
import { NeedsAttentionList } from "@/components/attendance/NeedsAttentionList";
import { NextClassCard } from "@/components/attendance/NextClassCard";
import { DueSoonCard } from "@/components/tasks/DueSoonCard";
import { DayProgressRow } from "@/components/home/DayProgressRow";
import { ExamCountdownCard } from "@/components/home/ExamCountdownCard";
import { CardSwiper } from "@/components/home/CardSwiper";
import { TodayAttendanceList } from "@/components/home/TodayAttendanceList";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { aggregateAttendance, calculateRequiredClasses } from "@/lib/calculations/attendance";
import { getDueSoon } from "@/lib/calculations/deadlines";
import { getEntriesForDay, getFreePeriods, getNextEntry } from "@/lib/calculations/timetable";
import { daysToAttend, shortWhen } from "@/lib/calculations/planning";
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
  const tasksQuery = useTasks();
  const { hasTimetable } = useCampusFeatures();

  const today = todayIso();
  const currentTime = nowTimeHHmm();
  const dayOfWeek = dayOfWeekFromIso(today);

  const todayEntries = useMemo(() => {
    if (!timetableQuery.data) return [];
    return getEntriesForDay(timetableQuery.data.entries, dayOfWeek);
  }, [timetableQuery.data, dayOfWeek]);

  const nextEntry = useMemo(() => {
    if (!timetableQuery.data) return null;
    return getNextEntry(timetableQuery.data.entries, dayOfWeek, currentTime);
  }, [timetableQuery.data, dayOfWeek, currentTime]);
  const nextSubject = useSubject(nextEntry?.subjectId);

  /** The class right after `nextEntry` — only rendered while `nextEntry` is running. */
  const afterEntry = useMemo(() => {
    if (!nextEntry) return null;
    const index = todayEntries.findIndex((e) => e.id === nextEntry.id);
    return index >= 0 ? (todayEntries[index + 1] ?? null) : null;
  }, [todayEntries, nextEntry]);
  const afterSubject = useSubject(afterEntry?.subjectId);

  const classesLeft = useMemo(
    () => todayEntries.filter((e) => e.endTime >= currentTime).length,
    [todayEntries, currentTime],
  );
  const freePeriodsLeft = useMemo(() => {
    if (!timetableQuery.data) return 0;
    return getFreePeriods(timetableQuery.data.entries, dayOfWeek).filter((f) => f.endTime >= currentTime).length;
  }, [timetableQuery.data, dayOfWeek, currentTime]);
  const dueSoonCount = useMemo(() => getDueSoon(tasksQuery.data ?? [], today).length, [tasksQuery.data, today]);

  const unreadCount = notificationsQuery.data?.filter((n) => !n.read).length ?? 0;

  const overall = useMemo(() => {
    if (!subjectsQuery.data) return null;
    return aggregateAttendance(subjectsQuery.data.map((s) => ({ attended: s.attended, held: s.held })));
  }, [subjectsQuery.data]);

  /** "17 days of classes, by 12 May" under the Overall Attendance card — see OverallAttendanceCard.daysNote. */
  const overallDaysNote = useMemo(() => {
    if (!overall || !configQuery.data) return null;
    const required = calculateRequiredClasses(overall.attended, overall.held, configQuery.data.minimumAttendancePercentage);
    if (required.status !== "needs_classes" || required.classesNeeded <= 0) return null;
    const plan = daysToAttend(required.classesNeeded, timetableQuery.data?.entries ?? [], today);
    if (!plan) return null;
    return `${plan.days} day${plan.days === 1 ? "" : "s"} of classes, by ${shortWhen(plan.on, today)}`;
  }, [overall, configQuery.data, timetableQuery.data, today]);

  // Technical Hour (CodeForge/skills-hour) is a Maya-tracked period, separate
  // from Campus Connect — only students whose timetable actually carries one
  // have anything to swipe to, so the card only appears for them.
  const hasTechnicalHour = useMemo(
    () => (timetableQuery.data?.entries ?? []).some((e) => e.type === "technical"),
    [timetableQuery.data],
  );

  const isLoading = subjectsQuery.isLoading || configQuery.isLoading;
  const isError = subjectsQuery.isError || configQuery.isError;

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
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
          {hasTechnicalHour ? (
            <CardSwiper labels={["Overall Attendance", "CodeForge Attendance"]}>
              {[
                <OverallAttendanceCard
                  key="overall"
                  percentage={overall?.percentage ?? null}
                  attended={overall?.attended ?? 0}
                  held={overall?.held ?? 0}
                  target={configQuery.data.minimumAttendancePercentage}
                  thresholds={configQuery.data.statusThresholds}
                  linkTo={ROUTES.subjects}
                  daysNote={overallDaysNote}
                />,
                <HubAttendanceCard key="hub" />,
              ]}
            </CardSwiper>
          ) : (
            <OverallAttendanceCard
              percentage={overall?.percentage ?? null}
              attended={overall?.attended ?? 0}
              held={overall?.held ?? 0}
              target={configQuery.data.minimumAttendancePercentage}
              thresholds={configQuery.data.statusThresholds}
              linkTo={ROUTES.subjects}
              daysNote={overallDaysNote}
            />
          )}

          {/* Both of these are read off the timetable, which AEC and ACET's
              portal does not expose. Shown empty they would claim this student
              has no classes today, which is a statement about their week
              rather than about what Handy can see. */}
          {hasTimetable ? (
            <DayProgressRow
              classesLeft={classesLeft}
              freePeriodsLeft={freePeriodsLeft}
              dueSoonCount={dueSoonCount}
            />
          ) : null}

          {/* Sits high on purpose: a deadline two days out matters more
              than a percentage that moved by 0.4%. */}
          <DueSoonCard />

          <ExamCountdownCard />

          <NeedsAttentionList subjects={subjectsQuery.data} />

          {hasTimetable && <TodayAttendanceList entries={todayEntries} />}

          {hasTimetable && (
            <NextClassCard
              entry={nextEntry}
              subject={nextSubject.data}
              after={afterEntry}
              afterSubject={afterSubject.data}
            />
          )}
        </div>
      )}
    </div>
  );
}
