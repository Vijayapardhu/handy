import { useState } from "react";
import { Flame, X } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { formatDisplayDate, formatShortDate } from "@/lib/date";
import type { ActivityDay } from "@/lib/calculations/coding";
import { PLATFORM_BRAND } from "@/constants/codingBrand";
import { PLATFORM_META } from "@/types/coding";
import styles from "./StreakHeatmap.module.css";

/**
 * Twelve weeks of practice, one square per day.
 *
 * Built from LeetCode's submission calendar plus anything logged in the solve
 * log, so a student who practises on Codeforces and writes it down still has
 * a streak. The gaps are the point — this is the one view that shows the
 * weeks nothing happened, which is what a "247 problems solved" total hides.
 *
 * Tapping (or clicking) a day opens which platform(s) it actually came from —
 * a day with zero never lists a platform, and a platform only appears once
 * something real is attributed to it (its own calendar, a recent solve, or a
 * logged solution).
 */
export function StreakHeatmap({
  days,
  streak,
  longest,
}: {
  days: ActivityDay[];
  streak: number;
  longest: number;
}) {
  const [selected, setSelected] = useState<ActivityDay | null>(null);
  const activeDays = days.filter((day) => day.count > 0).length;

  return (
    <Card className={styles.card}>
      <div className={styles.head}>
        <p className={styles.title}>
          <Flame size={15} className={streak > 0 ? styles.flameLit : styles.flameOut} />
          {streak > 0 ? `${streak}-day streak` : "No streak yet"}
        </p>
        <p className={styles.sub}>
          {activeDays} active {activeDays === 1 ? "day" : "days"}
          {longest > 0 && ` · best ${longest}`}
        </p>
      </div>

      {/* Column-major: each column is a week, so the rows line up as weekdays
          the way every practice heatmap a student has already seen does. */}
      <div
        className={styles.grid}
        role="group"
        aria-label={`Practice activity, ${activeDays} active days in the last ${days.length}. Select a day for details.`}
      >
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            className={styles.cell}
            data-level={day.level}
            data-selected={selected?.date === day.date || undefined}
            title={`${formatShortDate(day.date)} — ${day.count === 0 ? "nothing" : `${day.count} solved`}`}
            aria-label={`${formatDisplayDate(day.date)}, ${day.count === 0 ? "nothing solved" : `${day.count} solved`}`}
            onClick={() => setSelected((current) => (current?.date === day.date ? null : day))}
          />
        ))}
      </div>

      <div className={styles.legend}>
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} className={styles.cell} data-level={level} />
        ))}
        <span>More</span>
      </div>

      {selected && <DayDetail day={selected} onClose={() => setSelected(null)} />}
    </Card>
  );
}

function DayDetail({ day, onClose }: { day: ActivityDay; onClose: () => void }) {
  return (
    <div className={styles.detail}>
      <div className={styles.detailHead}>
        <p className={styles.detailDate}>{formatDisplayDate(day.date)}</p>
        <button type="button" className={styles.detailClose} onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      {day.platforms.length === 0 ? (
        <p className={styles.detailEmpty}>Nothing submitted this day.</p>
      ) : (
        <ul className={styles.detailList}>
          {day.platforms.map((entry) => (
            <li key={entry.platform} className={styles.detailRow}>
              <span
                className={styles.detailDot}
                style={{ background: PLATFORM_BRAND[entry.platform].color }}
                aria-hidden="true"
              />
              <div className={styles.detailBody}>
                <p className={styles.detailPlatform}>
                  {PLATFORM_META[entry.platform].label}
                  <span className={styles.detailCount}>
                    {entry.count} {entry.count === 1 ? "submission" : "submissions"}
                  </span>
                </p>
                {entry.titles.length > 0 && (
                  <p className={styles.detailTitles}>{entry.titles.join(", ")}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
