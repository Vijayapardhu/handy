import { useMemo } from "react";
import { CalendarDays } from "@/components/ui/icons";
import { ClassCard } from "@/components/timetable/ClassCard";
import { useActiveSubjectsMap } from "@/hooks/useActiveSubjectsMap";
import { useMarksForRange, useSetAttendanceMark } from "@/hooks/useAttendanceMarks";
import { classBlockEndTime, classBlockPeriods, classBlocksForDay } from "@/lib/calculations/timetable";
import { dayOfWeekFromIso, nowTimeHHmm, todayIso } from "@/lib/date";
import type { TimetableEntryDoc } from "@/types/timetable";
import type { MarkStatus } from "@/types/attendanceMark";
import styles from "./TodayAttendanceList.module.css";

/**
 * Every one of today's classes, present/absent marking right there on Home —
 * not just the single "next" class NextClassCard highlights above this.
 * Reuses TimetablePage's exact ClassCard + AttendanceMarkButtons pipeline
 * (same mark keying, same "only a class that's already started" rule) so
 * marking a class looks and behaves identically whichever screen it's done
 * from.
 */
export function TodayAttendanceList({ entries }: { entries: TimetableEntryDoc[] }) {
  const today = todayIso();
  const currentTime = nowTimeHHmm();
  const subjectsMap = useActiveSubjectsMap();
  const marksQuery = useMarksForRange(today, today);
  const { set: setMark, clear: clearMark } = useSetAttendanceMark();

  // Breaks are filtered out before blocking, not after — classBlocksForDay
  // merges on subjectId adjacency, and a break entry sitting between two
  // lecture rows would otherwise change what counts as "adjacent".
  const blocks = useMemo(() => {
    const dayOfWeek = dayOfWeekFromIso(today);
    return classBlocksForDay(
      entries.filter((e) => e.type !== "break"),
      dayOfWeek,
    );
  }, [entries, today]);

  const marksByKey = useMemo(() => {
    const byKey = new Map<string, MarkStatus>();
    for (const m of marksQuery.data ?? []) byKey.set(`${m.subjectId}_${m.startTime}`, m.status);
    return byKey;
  }, [marksQuery.data]);

  if (blocks.length === 0) return null;

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <CalendarDays size={16} />
        <p className={styles.title}>Today&rsquo;s Classes</p>
      </div>

      <div className={styles.list}>
        {blocks.map((block) => {
          const firstEntry = block.entries[0];
          const periods = classBlockPeriods(block);
          const hasStarted = firstEntry.startTime <= currentTime;
          const key = `${firstEntry.subjectId}_${firstEntry.startTime}`;
          return (
            <ClassCard
              key={firstEntry.id}
              entry={firstEntry}
              endTime={classBlockEndTime(block)}
              periods={periods}
              subject={subjectsMap.bySubjectId.get(firstEntry.subjectId)}
              mark={hasStarted ? (marksByKey.get(key) ?? null) : undefined}
              markBusy={setMark.isPending || clearMark.isPending}
              onMark={
                hasStarted
                  ? (status) => {
                      const vars = { subjectId: firstEntry.subjectId, date: today, startTime: firstEntry.startTime };
                      if (status === null) clearMark.mutate(vars);
                      else setMark.mutate({ ...vars, status, periods });
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
