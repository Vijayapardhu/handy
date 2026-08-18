import { useMemo, useState } from "react";
import { TrendingUp } from "@/components/ui/icons";
import { TopHeader } from "@/components/layout/TopHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { useAuth } from "@/app/providers/AuthProvider";
import { useCollegeConfig } from "@/hooks/useCollegeConfig";
import { useOverallAttendanceTrend } from "@/hooks/useOverallAttendanceTrend";
import { getAttendanceStatus } from "@/lib/calculations/attendance";
import { formatDisplayDate, formatShortDate, todayIso } from "@/lib/date";
import { cn } from "@/lib/utils/cn";
import styles from "./AttendanceTrendPage.module.css";

const RANGES = [
  { days: 7, label: "7 Days" },
  { days: 30, label: "30 Days" },
  { days: 90, label: "90 Days" },
] as const;

/**
 * Day-by-day attendance percentage tracker — reached from the "Needs
 * Attention" tip on Home. A chart for the shape of the trend, a list below
 * it for the actual numbers behind each day.
 */
export function AttendanceTrendPage() {
  const { student } = useAuth();
  const configQuery = useCollegeConfig(student?.collegeId);
  const [days, setDays] = useState<number>(30);
  const trendQuery = useOverallAttendanceTrend(days);

  const isLoading = trendQuery.isLoading || configQuery.isLoading;
  const isError = trendQuery.isError || configQuery.isError;

  // TrendChart renders one label per point, sized to ~8 (SubjectDetailPage's
  // weekly view) — at 30 or 90 daily points every label truncates to an
  // unreadable "20…" fragment. Thinning to roughly 6 evenly-spaced labels
  // (always including the most recent day) keeps the axis legible without
  // changing the chart component every other page's trend already relies on.
  const chartPoints: TrendPoint[] = useMemo(() => {
    const data = trendQuery.data ?? [];
    const stride = Math.max(1, Math.ceil(data.length / 6));
    return data.map((p, i) => ({
      label: i % stride === 0 || i === data.length - 1 ? formatShortDate(p.date) : "",
      value: p.percentage,
    }));
  }, [trendQuery.data]);

  // Newest first, and only days that actually had a class — a chart shows the
  // gaps as gaps, but a list of "no classes" rows would just be scroll noise.
  const dayRows = useMemo(
    () => [...(trendQuery.data ?? [])].filter((p) => p.held > 0).reverse(),
    [trendQuery.data],
  );

  const target = configQuery.data?.minimumAttendancePercentage ?? 75;
  const thresholds = configQuery.data?.statusThresholds;
  const today = todayIso();

  return (
    <div className="page-narrow">
      <TopHeader title="Attendance Trend" subtitle="Day by day, across every subject" back />

      <div className={styles.rangeTabs} role="tablist" aria-label="Date range">
        {RANGES.map((r) => (
          <button
            key={r.days}
            type="button"
            role="tab"
            aria-selected={days === r.days}
            className={cn(styles.rangeTab, days === r.days && styles.rangeTabActive)}
            onClick={() => setDays(r.days)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className={styles.stack}>
          <Skeleton height={180} />
          <Skeleton height={220} />
        </div>
      )}

      {!isLoading && isError && (
        <ErrorState
          message="Unable to load your attendance trend."
          onRetry={() => {
            trendQuery.refetch();
            configQuery.refetch();
          }}
        />
      )}

      {!isLoading && !isError && (
        <div className={styles.stack}>
          <Card className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <TrendingUp size={16} />
              <span>{RANGES.find((r) => r.days === days)?.label} trend</span>
            </div>
            <TrendChart points={chartPoints} target={target} height={160} />
          </Card>

          {dayRows.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No attendance marked yet"
              description="Mark a class present or absent and it'll start showing up here, day by day."
            />
          ) : (
            <div className={styles.dayList}>
              {dayRows.map((point) => {
                const status = thresholds ? getAttendanceStatus(point.percentage, thresholds) : "na";
                return (
                  <Card key={point.date} padded={false} className={styles.dayRow}>
                    <div className={styles.dayRowBody}>
                      <span className={styles.dayDate}>
                        {point.date === today ? "Today" : formatDisplayDate(point.date)}
                      </span>
                      <span className={styles.dayMeta}>
                        {point.attended}/{point.held} classes attended
                      </span>
                    </div>
                    <span className={styles.dayPercentage} data-status={status}>
                      {point.percentage === null ? "N/A" : `${point.percentage.toFixed(0)}%`}
                    </span>
                    <StatusBadge status={status} className={styles.dayBadge} />
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
