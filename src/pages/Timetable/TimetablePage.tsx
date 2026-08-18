import { useMemo, useState } from "react";
import { RefreshCcw, CalendarX2, CalendarSearch, MessageSquarePlus } from "@/components/ui/icons";
import { TopHeader } from "@/components/layout/TopHeader";
import { DayTabs } from "@/components/timetable/DayTabs";
import { ClassCard } from "@/components/timetable/ClassCard";
import { FreePeriodRow } from "@/components/timetable/FreePeriodRow";
import { ReportChangeForm } from "@/components/timetable/ReportChangeForm";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useActiveTimetable } from "@/hooks/useTimetable";
import { useActiveSubjectsMap } from "@/hooks/useActiveSubjectsMap";
import { useTasks } from "@/hooks/useTasks";
import { useMarksForRange, useSetAttendanceMark } from "@/hooks/useAttendanceMarks";
import { classBlockEndTime, classBlockPeriods, classBlocksForDay, getFreePeriods } from "@/lib/calculations/timetable";
import { addDaysIso, dayOfWeekFromIso, formatDisplayDate, nowTimeHHmm, todayIso } from "@/lib/date";
import type { MarkStatus } from "@/types/attendanceMark";
import styles from "./TimetablePage.module.css";

function weekDates(anchor: string): string[] {
  const anchorDow = dayOfWeekFromIso(anchor);
  // Week starts Monday for display, matching the reference mockup.
  const mondayOffset = anchorDow === 0 ? -6 : 1 - anchorDow;
  const monday = addDaysIso(anchor, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
}

export function TimetablePage() {
  const today = todayIso();
  const [selectedDate, setSelectedDate] = useState(today);
  const [showJumpToDate, setShowJumpToDate] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const timetableQuery = useActiveTimetable(selectedDate);
  const subjectsMap = useActiveSubjectsMap();
  const tasksQuery = useTasks();
  // Marking only ever applies to today (see AttendanceMarkButtons) — a
  // browsed past/future day never fetches marks at all, since there is
  // nothing to show or do with them here; Attendance History is where a past
  // mark is reviewed.
  const isToday = selectedDate === today;
  const marksQuery = useMarksForRange(selectedDate, selectedDate, undefined, isToday);
  const { set: setMark, clear: clearMark } = useSetAttendanceMark();

  const dates = useMemo(() => weekDates(selectedDate), [selectedDate]);
  const dayBlocks = useMemo(() => {
    if (!timetableQuery.data) return [];
    return classBlocksForDay(timetableQuery.data.entries, dayOfWeekFromIso(selectedDate));
  }, [timetableQuery.data, selectedDate]);

  /**
   * Classes and free periods merged into one time-ordered list, so the day
   * reads as a day rather than as a list of classes with silent holes in it.
   * Consecutive same-subject periods are merged into one block (classBlocksForDay).
   */
  const dayItems = useMemo(() => {
    if (!timetableQuery.data) return [];
    const dayOfWeek = dayOfWeekFromIso(selectedDate);
    const free = getFreePeriods(timetableQuery.data.entries, dayOfWeek);

    const items = [
      ...dayBlocks.map((block) => ({ kind: "class" as const, at: block.entries[0].startTime, block })),
      ...free.map((f) => ({ kind: "free" as const, at: f.startTime, free: f })),
    ];
    return items.sort((a, b) => a.at.localeCompare(b.at));
  }, [timetableQuery.data, selectedDate, dayBlocks]);

  /** Open tasks grouped by subject, so each class can show its own. */
  const openTasksBySubject = useMemo(() => {
    const bySubject = new Map<string, typeof tasks>();
    const tasks = (tasksQuery.data ?? []).filter((t) => !t.done && t.subjectId);
    for (const task of tasks) {
      const list = bySubject.get(task.subjectId!) ?? [];
      list.push(task);
      bySubject.set(task.subjectId!, list);
    }
    return bySubject;
  }, [tasksQuery.data]);

  /** Keyed the same way a mark's own doc id is built — subjectId + startTime, date is already fixed to "today". */
  const marksByKey = useMemo(() => {
    const byKey = new Map<string, MarkStatus>();
    for (const m of marksQuery.data ?? []) byKey.set(`${m.subjectId}_${m.startTime}`, m.status);
    return byKey;
  }, [marksQuery.data]);

  const currentTime = nowTimeHHmm();

  const isViewingPast = selectedDate !== today;

  return (
    <div>
      <TopHeader
        title="Timetable"
        subtitle="Your class schedule at a glance"
        action={
          <button
            className={styles.jumpButton}
            onClick={() => setShowJumpToDate((v) => !v)}
            aria-label="Jump to a date"
          >
            <CalendarSearch size={16} />
          </button>
        }
      />

      {showJumpToDate && (
        <label className={styles.jumpRow}>
          <span>Jump to date</span>
          <input
            type="date"
            className={styles.jumpInput}
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setShowJumpToDate(false);
            }}
          />
        </label>
      )}

      {timetableQuery.data?.version && (
        <div className={styles.versionBanner}>
          <span>
            Version {timetableQuery.data.version.versionNumber} · {isViewingPast ? "Viewing" : "Active"}
          </span>
          <span className={styles.versionRange}>
            {formatDisplayDate(timetableQuery.data.version.effectiveFrom)}
            {timetableQuery.data.version.effectiveUntil
              ? ` – ${formatDisplayDate(timetableQuery.data.version.effectiveUntil)}`
              : " onward"}
          </span>
        </div>
      )}

      {isViewingPast && (
        <button className={styles.backToTodayBtn} onClick={() => setSelectedDate(today)}>
          ← Back to today
        </button>
      )}

      <DayTabs dates={dates} selected={selectedDate} onSelect={setSelectedDate} todayIso={today} />

      {timetableQuery.isError && (
        <ErrorState
          message="Unable to load your timetable. Please check your connection and try again."
          onRetry={() => timetableQuery.refetch()}
        />
      )}

      {!timetableQuery.isError && timetableQuery.isLoading && (
        <div className={styles.loadingStack}>
          <Skeleton height={70} />
          <Skeleton height={70} />
          <Skeleton height={70} />
        </div>
      )}

      {!timetableQuery.isError && !timetableQuery.isLoading && !timetableQuery.data?.version && (
        <EmptyState
          icon={CalendarX2}
          title="No timetable available"
          description="No timetable has been published for this date yet."
        />
      )}

      {!timetableQuery.isError &&
        !timetableQuery.isLoading &&
        timetableQuery.data?.version &&
        dayBlocks.length === 0 && (
          <EmptyState title="No classes" description="Nothing scheduled on this day." />
        )}

      {!timetableQuery.isError && !timetableQuery.isLoading && dayBlocks.length > 0 && (
        // Wrapper exists so the day's classes can lay out in columns on wider
        // screens; on mobile it's still a plain stack.
        <div className={styles.classList}>
          {dayItems.map((item) => {
            if (item.kind === "free") {
              return <FreePeriodRow key={`free-${item.free.periodNo}`} free={item.free} />;
            }

            const firstEntry = item.block.entries[0];
            const periods = classBlockPeriods(item.block);

            // Marking is only ever offered for a class that has actually
            // started, today — marking a class that hasn't happened yet is a
            // guess, not a record (mirrors mobile's Today-timeline rule). A
            // merged block is marked once, for all its periods together —
            // mirrors mobile's _MarkRow, which writes one mark carrying the
            // block's period count rather than one mark per period.
            const hasStarted = isToday && firstEntry.startTime <= currentTime;
            const key = `${firstEntry.subjectId}_${firstEntry.startTime}`;

            return (
              <ClassCard
                key={firstEntry.id}
                entry={firstEntry}
                endTime={classBlockEndTime(item.block)}
                periods={periods}
                subject={subjectsMap.bySubjectId.get(firstEntry.subjectId)}
                tasks={openTasksBySubject.get(firstEntry.subjectId) ?? []}
                mark={hasStarted ? (marksByKey.get(key) ?? null) : undefined}
                markBusy={setMark.isPending || clearMark.isPending}
                onMark={
                  hasStarted
                    ? (status) => {
                        const vars = { subjectId: firstEntry.subjectId, date: selectedDate, startTime: firstEntry.startTime };
                        if (status === null) clearMark.mutate(vars);
                        else setMark.mutate({ ...vars, status, periods });
                      }
                    : undefined
                }
              />
            );
          })}
        </div>
      )}

      <div className={styles.updateBanner}>
        <RefreshCcw size={16} />
        <div className={styles.updateBannerText}>
          <p className={styles.updateBannerTitle}>Timetable can change frequently</p>
          <p className={styles.updateBannerSubtitle}>
            {timetableQuery.data?.version?.publishedAt
              ? `Last published ${formatDisplayDate(timetableQuery.data.version.publishedAt.slice(0, 10))}`
              : "Check back for updates"}
          </p>
        </div>
        <button className={styles.checkButton} onClick={() => timetableQuery.refetch()}>
          Check for Updates
        </button>
      </div>

      {!showReportForm ? (
        <Button variant="secondary" fullWidth className={styles.reportCta} onClick={() => setShowReportForm(true)}>
          <MessageSquarePlus size={16} /> Report a Change
        </Button>
      ) : (
        <ReportChangeForm
          timetableVersionId={timetableQuery.data?.version?.id ?? null}
          subjects={[...subjectsMap.bySubjectId.values()]}
          onClose={() => setShowReportForm(false)}
        />
      )}
    </div>
  );
}
