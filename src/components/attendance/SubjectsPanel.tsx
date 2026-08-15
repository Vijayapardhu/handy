import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { SubjectRow } from "@/components/attendance/SubjectRow";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSubjectsWithAttendance } from "@/hooks/useSubjects";
import { cn } from "@/lib/utils/cn";
import styles from "./SubjectsPanel.module.css";

type Filter = "all" | "attention" | "good";

/**
 * The subject list + filters + insights (SRS §9). Used both as the
 * "Subjects" tab inside OverallAttendancePage and could be reused standalone
 * — kept header-free so callers control their own page chrome.
 */
export function SubjectsPanel() {
  const { data: subjects, isLoading, isError, refetch } = useSubjectsWithAttendance();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (!subjects) return [];
    if (filter === "attention") {
      return subjects.filter((s) => s.status === "critical" || s.status === "low");
    }
    if (filter === "good") {
      return subjects.filter((s) => s.status === "good" || s.status === "excellent");
    }
    return subjects;
  }, [subjects, filter]);

  const needAttentionCount = subjects?.filter((s) => s.status === "critical" || s.status === "low").length ?? 0;
  const goodCount = subjects?.filter((s) => s.status === "good" || s.status === "excellent").length ?? 0;

  return (
    <div>
      <div className={styles.filters}>
        {(["all", "attention", "good"] as Filter[]).map((f) => (
          <button
            key={f}
            className={cn(styles.filterChip, filter === f && styles.filterChipActive)}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All Subjects" : f === "attention" ? "Needs Attention" : "On Track"}
          </button>
        ))}
      </div>

      {isError && <ErrorState message="Unable to load your subjects. Please try again." onRetry={refetch} />}

      {!isError && isLoading && (
        <div className={styles.loadingStack}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!isError && !isLoading && filtered.length === 0 && (
        <EmptyState
          title="No subjects here"
          description={
            filter === "all"
              ? "Your subjects for this semester haven't been published yet."
              : "No subjects match this filter right now."
          }
        />
      )}

      {!isError && !isLoading && filtered.length > 0 && (
        <Card padded={false} className={styles.list}>
          {filtered.map((subject) => (
            <div key={subject.subjectId} className={styles.rowWrap}>
              <SubjectRow subject={subject} />
            </div>
          ))}
        </Card>
      )}

      {!isError && !isLoading && subjects && subjects.length > 0 && (
        <div className={styles.insights}>
          <div className={styles.insightCard}>
            <TrendingDown size={16} className={styles.insightIconBad} />
            <div>
              <p className={styles.insightValue}>{needAttentionCount} subjects need attention</p>
              <p className={styles.insightLabel}>Improve to avoid shortage</p>
            </div>
          </div>
          <div className={styles.insightCard}>
            <TrendingUp size={16} className={styles.insightIconGood} />
            <div>
              <p className={styles.insightValue}>You&rsquo;re doing great in {goodCount} subjects</p>
              <p className={styles.insightLabel}>Keep up the good work!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
