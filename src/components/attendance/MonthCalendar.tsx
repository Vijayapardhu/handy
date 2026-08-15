import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, CalendarOff } from "@/components/ui/icons";
import { addMonths, format, getDaysInMonth, startOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils/cn";
import { dominantMarkStatus } from "@/lib/calculations/attendanceMarks";
import type { AttendanceMarkDoc, MarkStatus } from "@/types/attendanceMark";
import styles from "./MonthCalendar.module.css";

const WEEKDAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

const STATUS_ICON: Record<MarkStatus, typeof CheckCircle2> = {
  present: CheckCircle2,
  absent: XCircle,
  cancelled: CalendarOff,
};

/** Only present/absent appear here — the two colours that can ever actually appear on a day cell. See below. */
const LEGEND_STATUSES: MarkStatus[] = ["present", "absent"];

const STATUS_LABEL: Record<MarkStatus, string> = {
  present: "Present",
  absent: "Missed",
  cancelled: "Cancelled",
};

interface MonthCalendarProps {
  records: AttendanceMarkDoc[];
  subjectNameById: Map<string, string>;
  month: Date;
  onMonthChange: (month: Date) => void;
}

export function MonthCalendar({ records, subjectNameById, month, onMonthChange }: MonthCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const recordsByDate = useMemo(() => {
    const map = new Map<string, AttendanceMarkDoc[]>();
    records.forEach((r) => {
      const list = map.get(r.date) ?? [];
      list.push(r);
      map.set(r.date, list);
    });
    return map;
  }, [records]);

  const daysInMonth = getDaysInMonth(month);
  const firstOfMonth = startOfMonth(month);
  const leadingBlanks = firstOfMonth.getDay();
  const monthPrefix = format(month, "yyyy-MM");
  const today = format(new Date(), "yyyy-MM-dd");

  const cells: Array<{ dateIso: string | null; day: number | null }> = [
    ...Array.from({ length: leadingBlanks }, () => ({ dateIso: null, day: null })),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return { dateIso: `${monthPrefix}-${String(day).padStart(2, "0")}`, day };
    }),
  ];

  const selectedRecords = selectedDate ? recordsByDate.get(selectedDate) ?? [] : [];

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <button className={styles.navBtn} onClick={() => onMonthChange(subMonths(month, 1))} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <span className={styles.monthLabel}>{format(month, "MMMM yyyy")}</span>
        <button
          className={styles.navBtn}
          onClick={() => onMonthChange(addMonths(month, 1))}
          aria-label="Next month"
          disabled={format(month, "yyyy-MM") >= format(new Date(), "yyyy-MM")}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className={styles.weekdays}>
        {WEEKDAY_HEADERS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>

      <div className={styles.grid}>
        {cells.map((cell, i) => {
          if (!cell.dateIso) return <span key={`blank-${i}`} className={styles.blank} />;
          const dayRecords = recordsByDate.get(cell.dateIso) ?? [];
          const status = dominantMarkStatus(dayRecords);
          const isToday = cell.dateIso === today;
          const isSelected = cell.dateIso === selectedDate;
          const isFuture = cell.dateIso > today;
          return (
            <button
              key={cell.dateIso}
              className={cn(styles.day, isToday && styles.today, isSelected && styles.selected)}
              data-status={status ?? "none"}
              disabled={isFuture}
              onClick={() => setSelectedDate(isSelected ? null : cell.dateIso)}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className={styles.legend}>
        {LEGEND_STATUSES.map((status) => (
          <span key={status} className={styles.legendItem}>
            <span className={styles.legendDot} data-status={status} />
            {STATUS_LABEL[status]}
          </span>
        ))}
      </div>

      {selectedDate && (
        <div className={styles.detail}>
          <p className={styles.detailDate}>{format(new Date(selectedDate + "T00:00:00"), "EEEE, d MMM yyyy")}</p>
          {selectedRecords.length === 0 ? (
            <p className={styles.detailEmpty}>No classes recorded on this day.</p>
          ) : (
            <ul className={styles.detailList}>
              {selectedRecords.map((r) => {
                const Icon = STATUS_ICON[r.status];
                return (
                  <li key={r.id} className={styles.detailRow}>
                    <span>{subjectNameById.get(r.subjectId) ?? "Subject"}</span>
                    <span className={styles.detailStatus} data-status={r.status}>
                      <Icon size={13} /> {STATUS_LABEL[r.status]}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
