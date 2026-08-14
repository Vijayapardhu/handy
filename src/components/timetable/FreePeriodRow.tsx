import { Coffee } from "lucide-react";
import { formatTime12h } from "@/lib/date";
import type { FreePeriod } from "@/lib/calculations/timetable";
import styles from "./FreePeriodRow.module.css";

/**
 * A gap in the day. Shown rather than skipped because a free period is
 * information a student plans around — it's when coursework actually gets
 * done, and the day reads wrong without it.
 */
export function FreePeriodRow({ free }: { free: FreePeriod }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>
        <Coffee size={13} /> Free period
      </span>
      <span className={styles.time}>
        {formatTime12h(free.startTime)} – {formatTime12h(free.endTime)}
      </span>
    </div>
  );
}
