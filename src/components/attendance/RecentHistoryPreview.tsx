import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, XCircle, CalendarOff, ShieldCheck, History } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAttendanceHistory } from "@/hooks/useAttendanceHistory";
import { useActiveSubjectsMap } from "@/hooks/useActiveSubjectsMap";
import { formatShortDate } from "@/lib/date";
import type { AttendanceStatus } from "@/types/attendance";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/constants/routes";
import styles from "./RecentHistoryPreview.module.css";

const STATUS_ICON: Record<AttendanceStatus, typeof CheckCircle2> = {
  present: CheckCircle2,
  absent: XCircle,
  leave: CalendarOff,
  excused: ShieldCheck,
};

const PREVIEW_LIMIT = 8;

export function RecentHistoryPreview() {
  const { records, isLoading, isError, reset } = useAttendanceHistory();
  const subjectsMap = useActiveSubjectsMap();

  return (
    <div>
      {isError && <ErrorState message="Unable to load your recent history." onRetry={reset} />}

      {!isError && isLoading && (
        <div className={styles.stack}>
          <Skeleton height={44} />
          <Skeleton height={44} />
          <Skeleton height={44} />
        </div>
      )}

      {!isError && !isLoading && records.length === 0 && (
        <EmptyState icon={History} title="No history yet" description="Recorded classes will appear here." />
      )}

      {!isError && !isLoading && records.length > 0 && (
        <ul className={styles.list}>
          {records.slice(0, PREVIEW_LIMIT).map((r) => {
            const Icon = STATUS_ICON[r.status];
            const subjectName =
              subjectsMap.bySubjectId.get(r.subjectId)?.shortName ??
              subjectsMap.bySubjectId.get(r.subjectId)?.name ??
              "Subject";
            return (
              <li key={r.id} className={styles.row}>
                <span className={styles.date}>{formatShortDate(r.date)}</span>
                <span className={styles.subject}>{subjectName}</span>
                <span className={cn(styles.statusChip, styles[r.status])}>
                  <Icon size={12} />
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Link to={ROUTES.attendanceHistory} className={styles.link}>
        View Full History <ArrowRight size={14} />
      </Link>
    </div>
  );
}
