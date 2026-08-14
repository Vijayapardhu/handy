import { Link } from "react-router-dom";
import { ArrowRight, CalendarX2 } from "lucide-react";
import { ClassCard } from "@/components/timetable/ClassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useActiveTimetable } from "@/hooks/useTimetable";
import { useActiveSubjectsMap } from "@/hooks/useActiveSubjectsMap";
import { getEntriesForDay } from "@/lib/calculations/timetable";
import { dayOfWeekFromIso, todayIso } from "@/lib/date";
import { ROUTES } from "@/constants/routes";
import styles from "./TodayTimetablePreview.module.css";

const PREVIEW_LIMIT = 4;

export function TodayTimetablePreview() {
  const today = todayIso();
  const timetableQuery = useActiveTimetable(today);
  const subjectsMap = useActiveSubjectsMap();

  const dayEntries = timetableQuery.data
    ? getEntriesForDay(timetableQuery.data.entries, dayOfWeekFromIso(today)).filter((e) => e.type !== "break")
    : [];

  return (
    <div>
      {timetableQuery.isError && (
        <ErrorState message="Unable to load today's timetable." onRetry={() => timetableQuery.refetch()} />
      )}

      {!timetableQuery.isError && timetableQuery.isLoading && (
        <div className={styles.stack}>
          <Skeleton height={64} />
          <Skeleton height={64} />
        </div>
      )}

      {!timetableQuery.isError && !timetableQuery.isLoading && !timetableQuery.data?.version && (
        <EmptyState icon={CalendarX2} title="No timetable available" description="Nothing published yet." />
      )}

      {!timetableQuery.isError && !timetableQuery.isLoading && timetableQuery.data?.version && dayEntries.length === 0 && (
        <EmptyState title="No classes today" description="Enjoy the day off!" />
      )}

      {!timetableQuery.isError &&
        !timetableQuery.isLoading &&
        dayEntries.slice(0, PREVIEW_LIMIT).map((entry) => (
          <ClassCard key={entry.id} entry={entry} subject={subjectsMap.bySubjectId.get(entry.subjectId)} />
        ))}

      {dayEntries.length > PREVIEW_LIMIT && (
        <p className={styles.moreNote}>+{dayEntries.length - PREVIEW_LIMIT} more today</p>
      )}

      <Link to={ROUTES.timetable} className={styles.link}>
        View Full Timetable <ArrowRight size={14} />
      </Link>
    </div>
  );
}
