import { useMemo } from "react";
import { OverallAttendanceCard } from "@/components/attendance/OverallAttendanceCard";
import { NeedsAttentionList } from "@/components/attendance/NeedsAttentionList";
import { SkeletonCard, Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useSubjectsWithAttendance } from "@/hooks/useSubjects";
import { useCollegeConfig } from "@/hooks/useCollegeConfig";
import { useAuth } from "@/app/providers/AuthProvider";
import { aggregateAttendance } from "@/lib/calculations/attendance";
import type { AttendanceStatusLevel } from "@/types/subject";
import styles from "./OverviewPanel.module.css";

const STATUS_ORDER: AttendanceStatusLevel[] = ["critical", "low", "average", "good", "excellent"];
const STATUS_LABEL: Record<AttendanceStatusLevel, string> = {
  critical: "Critical",
  low: "Low",
  average: "Average",
  good: "Good",
  excellent: "Excellent",
  na: "N/A",
};

export function OverviewPanel() {
  const { student } = useAuth();
  const subjectsQuery = useSubjectsWithAttendance();
  const configQuery = useCollegeConfig(student?.collegeId);

  const overall = useMemo(() => {
    if (!subjectsQuery.data) return null;
    return aggregateAttendance(subjectsQuery.data.map((s) => ({ attended: s.attended, held: s.held })));
  }, [subjectsQuery.data]);

  const statusCounts = useMemo(() => {
    const counts: Record<AttendanceStatusLevel, number> = {
      critical: 0,
      low: 0,
      average: 0,
      good: 0,
      excellent: 0,
      na: 0,
    };
    subjectsQuery.data?.forEach((s) => {
      counts[s.status] += 1;
    });
    return counts;
  }, [subjectsQuery.data]);

  const isLoading = subjectsQuery.isLoading || configQuery.isLoading;
  const isError = subjectsQuery.isError || configQuery.isError;

  if (isError) {
    return (
      <ErrorState
        message="Unable to load your overview."
        onRetry={() => {
          subjectsQuery.refetch();
          configQuery.refetch();
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <div className={styles.stack}>
        <SkeletonCard />
        <Skeleton height={90} />
      </div>
    );
  }

  if (!subjectsQuery.data || !configQuery.data) return null;

  return (
    <div className={styles.stack}>
      <OverallAttendanceCard
        percentage={overall?.percentage ?? null}
        attended={overall?.attended ?? 0}
        held={overall?.held ?? 0}
        target={configQuery.data.minimumAttendancePercentage}
        thresholds={configQuery.data.statusThresholds}
      />

      <div className={styles.breakdown}>
        {STATUS_ORDER.map((level) => (
          <div key={level} className={styles.breakdownItem} data-status={level}>
            <span className={styles.breakdownCount}>{statusCounts[level]}</span>
            <span className={styles.breakdownLabel}>{STATUS_LABEL[level]}</span>
          </div>
        ))}
      </div>

      <NeedsAttentionList subjects={subjectsQuery.data} />
    </div>
  );
}
