import { WEEKDAY_LABELS } from "@/lib/date";
import { cn } from "@/lib/utils/cn";
import styles from "./DayTabs.module.css";

interface DayTabsProps {
  dates: string[]; // 7 ISO dates
  selected: string;
  onSelect: (date: string) => void;
  todayIso: string;
}

export function DayTabs({ dates, selected, onSelect, todayIso }: DayTabsProps) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Day of week">
      {dates.map((date) => {
        const d = new Date(date + "T00:00:00");
        const isToday = date === todayIso;
        const isSelected = date === selected;
        return (
          <button
            key={date}
            role="tab"
            aria-selected={isSelected}
            className={cn(styles.tab, isSelected && styles.selected)}
            onClick={() => onSelect(date)}
          >
            <span className={styles.weekday}>{WEEKDAY_LABELS[d.getDay()]}</span>
            <span className={styles.dayNum}>{d.getDate()}</span>
            {isToday && <span className={styles.todayDot} />}
          </button>
        );
      })}
    </div>
  );
}
