import { useMemo, useState } from "react";
import { RefreshCcw, CalendarX2, CalendarSearch, MessageSquarePlus } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { DayTabs } from "@/components/timetable/DayTabs";
import { ClassCard } from "@/components/timetable/ClassCard";
import { ReportChangeForm } from "@/components/timetable/ReportChangeForm";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useActiveTimetable } from "@/hooks/useTimetable";
import { useActiveSubjectsMap } from "@/hooks/useActiveSubjectsMap";
import { getEntriesForDay } from "@/lib/calculations/timetable";
import { addDaysIso, dayOfWeekFromIso, formatDisplayDate, todayIso } from "@/lib/date";
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

  const dates = useMemo(() => weekDates(selectedDate), [selectedDate]);
  const dayEntries = useMemo(() => {
    if (!timetableQuery.data) return [];
    return getEntriesForDay(timetableQuery.data.entries, dayOfWeekFromIso(selectedDate));
  }, [timetableQuery.data, selectedDate]);

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
        dayEntries.length === 0 && (
          <EmptyState title="No classes" description="Nothing scheduled on this day." />
        )}

      {!timetableQuery.isError && !timetableQuery.isLoading && dayEntries.length > 0 && (
        // Wrapper exists so the day's classes can lay out in columns on wider
        // screens; on mobile it's still a plain stack.
        <div className={styles.classList}>
          {dayEntries.map((entry) => (
            <ClassCard key={entry.id} entry={entry} subject={subjectsMap.bySubjectId.get(entry.subjectId)} />
          ))}
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
