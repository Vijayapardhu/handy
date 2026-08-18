import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  History,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
} from "@/components/ui/icons";
import { TopHeader } from "@/components/layout/TopHeader";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrendChart } from "@/components/charts/TrendChart";
import { StudyTimerCard } from "@/components/subject/StudyTimerCard";
import { SubjectAnnouncements } from "@/components/announcements/SubjectAnnouncements";
import { SubjectNotes } from "@/components/announcements/SubjectNotes";
import { useSubject } from "@/hooks/useSubjects";
import { useAttendanceSummaryForSubject } from "@/hooks/useAttendanceSummaryForSubject";
import { useCollegeConfig } from "@/hooks/useCollegeConfig";
import { useSubjectTrend } from "@/hooks/useSubjectTrend";
import { useActiveTimetable } from "@/hooks/useTimetable";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  calculateAttendance,
  calculateRequiredClasses,
  calculateSafeAbsences,
  getAttendanceStatus,
  roundPercentage,
} from "@/lib/calculations/attendance";
import { daysToAttend, shortWhen } from "@/lib/calculations/planning";
import { todayIso } from "@/lib/date";
import { ROUTES } from "@/constants/routes";
import styles from "./SubjectDetailPage.module.css";

export function SubjectDetailPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const { student } = useAuth();
  const subjectQuery = useSubject(subjectId);
  const summaryQuery = useAttendanceSummaryForSubject(subjectId);
  const configQuery = useCollegeConfig(student?.collegeId);
  const trendQuery = useSubjectTrend(subjectId);
  const timetableQuery = useActiveTimetable();

  const isLoading = subjectQuery.isLoading || summaryQuery.isLoading || configQuery.isLoading;
  const isError = subjectQuery.isError || summaryQuery.isError || configQuery.isError;

  const percentage = useMemo(() => {
    if (!summaryQuery.data) return null;
    return roundPercentage(calculateAttendance(summaryQuery.data.attended, summaryQuery.data.held));
  }, [summaryQuery.data]);

  const target = subjectQuery.data?.targetAttendance ?? configQuery.data?.minimumAttendancePercentage ?? 75;
  const status = configQuery.data ? getAttendanceStatus(percentage, configQuery.data.statusThresholds) : "na";
  const today = todayIso();

  /**
   * The actionable half of the percentage — what it lets you do, or costs —
   * mirrors mobile's "What this means" card (subject_detail_screen.dart).
   */
  const meaning = useMemo(() => {
    const attended = summaryQuery.data?.attended ?? 0;
    const held = summaryQuery.data?.held ?? 0;
    if (held === 0) return null;

    const safe = calculateSafeAbsences(attended, held, target);
    if (safe.status === "can_miss" && safe.maxAbsences > 0) {
      return {
        kind: "can-miss" as const,
        canSkip: safe.maxAbsences,
        afterOneMiss: roundPercentage(calculateAttendance(attended, held + 1)),
      };
    }

    const required = calculateRequiredClasses(attended, held, target);
    const needed = required.status === "needs_classes" ? required.classesNeeded : null;
    const plan = needed ? daysToAttend(needed, timetableQuery.data?.entries ?? [], today, { subjectId }) : null;
    return {
      kind: "below-target" as const,
      needed,
      plan,
      afterOneAttend: roundPercentage(calculateAttendance(attended + 1, held + 1)),
    };
  }, [summaryQuery.data, target, timetableQuery.data, today, subjectId]);

  if (isError) {
    return (
      <div className="page-narrow">
        <TopHeader title="Subject" back />
        <ErrorState message="Unable to load this subject. Please try again." onRetry={() => {
          subjectQuery.refetch();
          summaryQuery.refetch();
        }} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <TopHeader title="Subject" back />
        <Skeleton height={140} className={styles.skeletonGap} />
        <Skeleton height={68} className={styles.skeletonGap} />
        <Skeleton height={68} className={styles.skeletonGap} />
        <Skeleton height={68} className={styles.skeletonGap} />
        <Skeleton height={188} />
      </div>
    );
  }

  if (!subjectQuery.data) {
    return (
      <div>
        <TopHeader title="Subject" back />
        <EmptyState title="Subject not found" description="This subject may have been removed." />
      </div>
    );
  }

  const subject = subjectQuery.data;
  const attended = summaryQuery.data?.attended ?? 0;
  const held = summaryQuery.data?.held ?? 0;

  return (
    <div>
      <TopHeader title={subject.name} subtitle={subject.code} back />

      <Card className={styles.headline}>
        <div className={styles.headlineTop}>
          <div>
            <p className={styles.percentage}>{percentage === null ? "N/A" : `${percentage.toFixed(2)}%`}</p>
            <p className={styles.count}>
              {attended} / {held} classes
            </p>
          </div>
          <StatusBadge status={status} />
        </div>
        <ProgressBar value={percentage ?? 0} status={status} />
        <p className={styles.targetLine}>
          Target: <strong>{target}%</strong>
        </p>
      </Card>

      {meaning && (
        <Card className={styles.meaningCard}>
          <p className={styles.meaningLabel}>What this means</p>
          {meaning.kind === "can-miss" ? (
            <>
              <p className={styles.meaningFact}>
                <ShieldAlert size={16} />
                You can miss {meaning.canSkip} more class{meaning.canSkip === 1 ? "" : "es"} and stay above {target}%.
              </p>
              <p className={styles.meaningFact}>
                <TrendingDown size={16} />
                Missing the next one takes you to{" "}
                {meaning.afterOneMiss === null ? "N/A" : `${meaning.afterOneMiss.toFixed(2)}%`}.
              </p>
            </>
          ) : (
            <>
              <p className={`${styles.meaningFact} ${styles.meaningWarn}`}>
                <AlertTriangle size={16} />
                {meaning.needed === null
                  ? `Below ${target}%. This target isn't reachable by attendance alone this semester.`
                  : `Below ${target}%. Attend the next ${meaning.needed} in a row to get back above it.`}
              </p>
              {meaning.plan && (
                <p className={styles.meaningFact}>
                  <CalendarClock size={16} />
                  That&rsquo;s {meaning.plan.days} more day{meaning.plan.days === 1 ? "" : "s"}{" "}
                  {subject.shortName || "this subject"} meets — you&rsquo;d get there by{" "}
                  {shortWhen(meaning.plan.on, today)}.
                </p>
              )}
              <p className={styles.meaningFact}>
                <TrendingUp size={16} />
                Attending the next one takes you to{" "}
                {meaning.afterOneAttend === null ? "N/A" : `${meaning.afterOneAttend.toFixed(2)}%`}.
              </p>
            </>
          )}
        </Card>
      )}

      <div className={styles.actions}>
        <Link to={ROUTES.subjectHistory(subject.id)} className={styles.actionRow}>
          <span className={styles.actionIcon}>
            <History size={18} />
          </span>
          <span className={styles.actionBody}>
            <span className={styles.actionTitle}>Attendance History</span>
            <span className={styles.actionSubtitle}>See every recorded class for this subject</span>
          </span>
          <ChevronRight size={18} className={styles.chevron} />
        </Link>

        <Link to={ROUTES.subjectPlanner(subject.id)} className={styles.actionRow}>
          <span className={styles.actionIcon}>
            <Target size={18} />
          </span>
          <span className={styles.actionBody}>
            <span className={styles.actionTitle}>Attendance Planner</span>
            <span className={styles.actionSubtitle}>Classes needed to reach your target</span>
          </span>
          <ChevronRight size={18} className={styles.chevron} />
        </Link>
      </div>

      <Card className={styles.trendCard}>
        <div className={styles.trendHeader}>
          <span className={styles.trendTitle}>
            <TrendingUp size={16} /> 8-Week Trend
          </span>
          <span className={styles.trendFaculty}>Faculty: {subject.facultyName}</span>
        </div>
        {trendQuery.isLoading && <Skeleton height={140} />}
        {trendQuery.isError && <p className={styles.trendError}>Unable to load the trend chart.</p>}
        {!trendQuery.isLoading && !trendQuery.isError && trendQuery.data && (
          <TrendChart points={trendQuery.data} target={target} />
        )}
      </Card>

      <StudyTimerCard subject={subject} />

      <SubjectNotes subjectCode={subject.code} facultyId={subject.facultyId} />
      <SubjectAnnouncements subjectCode={subject.code} facultyId={subject.facultyId} />
    </div>
  );
}
