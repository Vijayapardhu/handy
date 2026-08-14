import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { History, Target, TrendingUp, ChevronRight } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrendChart } from "@/components/charts/TrendChart";
import { useSubject } from "@/hooks/useSubjects";
import { useAttendanceSummaryForSubject } from "@/hooks/useAttendanceSummaryForSubject";
import { useCollegeConfig } from "@/hooks/useCollegeConfig";
import { useSubjectTrend } from "@/hooks/useSubjectTrend";
import { useAuth } from "@/app/providers/AuthProvider";
import { calculateAttendance, getAttendanceStatus, roundPercentage } from "@/lib/calculations/attendance";
import { ROUTES } from "@/constants/routes";
import styles from "./SubjectDetailPage.module.css";

export function SubjectDetailPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const { student } = useAuth();
  const subjectQuery = useSubject(subjectId);
  const summaryQuery = useAttendanceSummaryForSubject(subjectId);
  const configQuery = useCollegeConfig(student?.collegeId);
  const trendQuery = useSubjectTrend(subjectId);

  const isLoading = subjectQuery.isLoading || summaryQuery.isLoading || configQuery.isLoading;
  const isError = subjectQuery.isError || summaryQuery.isError || configQuery.isError;

  const percentage = useMemo(() => {
    if (!summaryQuery.data) return null;
    return roundPercentage(calculateAttendance(summaryQuery.data.attended, summaryQuery.data.held));
  }, [summaryQuery.data]);

  const target = subjectQuery.data?.targetAttendance ?? configQuery.data?.minimumAttendancePercentage ?? 75;
  const status = configQuery.data ? getAttendanceStatus(percentage, configQuery.data.statusThresholds) : "na";

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
    </div>
  );
}
