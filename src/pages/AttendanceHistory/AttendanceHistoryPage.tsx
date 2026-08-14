import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, CalendarOff, ShieldCheck, History, Download, Loader2 } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { MonthCalendar } from "@/components/attendance/MonthCalendar";
import { useAttendanceHistory } from "@/hooks/useAttendanceHistory";
import { useAttendanceMonth } from "@/hooks/useAttendanceMonth";
import { useActiveSubjectsMap } from "@/hooks/useActiveSubjectsMap";
import { useAuth } from "@/app/providers/AuthProvider";
import { getAttendanceForRange } from "@/services/attendance/attendanceService";
import { toCsv, downloadCsv } from "@/lib/utils/csv";
import { formatDisplayDate, todayIso, addDaysIso } from "@/lib/date";
import type { AttendanceStatus } from "@/types/attendance";
import { cn } from "@/lib/utils/cn";
import styles from "./AttendanceHistoryPage.module.css";

const EXPORT_WINDOW_DAYS = 730; // ~2 years — a single bounded query, generous enough to cover the whole course.

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  present: { label: "Present", icon: CheckCircle2, className: styles.present },
  absent: { label: "Absent", icon: XCircle, className: styles.absent },
  leave: { label: "Leave", icon: CalendarOff, className: styles.leave },
  excused: { label: "Excused", icon: ShieldCheck, className: styles.excused },
};

export function AttendanceHistoryPage() {
  const [params] = useSearchParams();
  const subjectId = params.get("subjectId") ?? undefined;
  const { student } = useAuth();
  const { records, isLoading, isError, hasMore, loadMore, reset } = useAttendanceHistory(subjectId);
  const subjectsMap = useActiveSubjectsMap();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const monthQuery = useAttendanceMonth(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    subjectId,
  );

  const subjectNameById = useMemo(() => {
    const map = new Map<string, string>();
    subjectsMap.bySubjectId.forEach((s, id) => map.set(id, s.shortName || s.name));
    return map;
  }, [subjectsMap.bySubjectId]);

  const groupedByDate = records.reduce<Record<string, typeof records>>((acc, r) => {
    (acc[r.date] ??= []).push(r);
    return acc;
  }, {});

  async function handleExport() {
    if (!student || isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const today = todayIso();
      const startIso = addDaysIso(today, -EXPORT_WINDOW_DAYS);
      const exportRecords = await getAttendanceForRange(student.id, startIso, today, subjectId);
      const rows = [...exportRecords]
        .reverse() // most recent first, matching the list view
        .map((r) => [r.date, subjectNameById.get(r.subjectId) ?? r.subjectId, STATUS_CONFIG[r.status].label]);
      const csv = toCsv(["Date", "Subject", "Status"], rows);
      downloadCsv(`handy-attendance-${today}.csv`, csv);
    } catch {
      setExportError("Couldn't export your history right now. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div>
      <TopHeader
        title="Attendance History"
        subtitle="Every recorded class, by date"
        back
        action={
          <button
            type="button"
            className={styles.exportButton}
            onClick={handleExport}
            disabled={isExporting}
            aria-label="Export as CSV"
          >
            {isExporting ? <Loader2 size={18} className={styles.exportSpinner} /> : <Download size={18} />}
          </button>
        }
      />

      {exportError && <p className={styles.exportError}>{exportError}</p>}

      <div className={styles.viewToggle}>
        <button className={cn(styles.toggleBtn, view === "list" && styles.toggleActive)} onClick={() => setView("list")}>
          List
        </button>
        <button
          className={cn(styles.toggleBtn, view === "calendar" && styles.toggleActive)}
          onClick={() => setView("calendar")}
        >
          Calendar
        </button>
      </div>

      {view === "list" && (
        <>
          {isError && <ErrorState message="Unable to load your attendance history." onRetry={reset} />}

          {!isError && isLoading && (
            <div className={styles.loadingStack}>
              <Skeleton height={20} className={styles.dateHeadingSkeleton} />
              <Skeleton height={50} />
              <Skeleton height={50} />
              <Skeleton height={20} className={styles.dateHeadingSkeleton} />
              <Skeleton height={50} />
            </div>
          )}

          {!isError && !isLoading && records.length === 0 && (
            <EmptyState icon={History} title="No history yet" description="Attendance records will appear here once classes are recorded." />
          )}

          {!isError && !isLoading && records.length > 0 && (
            <div className={styles.dateGroups}>
              {Object.entries(groupedByDate).map(([date, dayRecords]) => (
                <div key={date} className={styles.dateGroup}>
                  <p className={styles.dateHeading}>{formatDisplayDate(date)}</p>
                  <ul className={styles.recordList}>
                    {dayRecords.map((r) => {
                      const config = STATUS_CONFIG[r.status];
                      const Icon = config.icon;
                      const subjectName = subjectNameById.get(r.subjectId) ?? "Subject";
                      return (
                        <li key={r.id} className={styles.record}>
                          <span>{subjectName}</span>
                          <span className={cn(styles.statusChip, config.className)}>
                            <Icon size={13} /> {config.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {!isError && hasMore && records.length > 0 && (
            <div className={styles.loadMoreRow}>
              <Button variant="secondary" size="sm" onClick={loadMore}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      {view === "calendar" && (
        <>
          {monthQuery.isError && (
            <ErrorState message="Unable to load this month's attendance." onRetry={() => monthQuery.refetch()} />
          )}
          {!monthQuery.isError && monthQuery.isLoading && <Skeleton height={360} />}
          {!monthQuery.isError && !monthQuery.isLoading && (
            <MonthCalendar
              records={monthQuery.data ?? []}
              subjectNameById={subjectNameById}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
            />
          )}
        </>
      )}
    </div>
  );
}
