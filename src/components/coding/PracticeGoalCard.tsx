import { useEffect, useState } from "react";
import { CalendarClock, Check, Minus, Plus, Target } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { formatTime12h, WEEKDAY_LABELS } from "@/lib/date";
import type { FreePeriod } from "@/lib/calculations/timetable";
import type { WeeklyProgress } from "@/lib/calculations/coding";
import styles from "./PracticeGoalCard.module.css";

/** Enough slots to be a suggestion, few enough to still read as one. */
const MAX_SUGGESTIONS = 4;

/**
 * The weekly practice target, and the free periods to actually hit it in.
 *
 * The two halves belong together: "5 problems a week" is a wish, and "5
 * problems a week, and you have a free period Tuesday at 11:10" is a plan.
 * The free periods come from the same timetable calculation the deadlines tab
 * already runs, so this is the student's real week rather than generic advice.
 *
 * The ring is the same component the app's flagship attendance number draws
 * — a goal met is meant to feel like the same kind of win.
 */
export function PracticeGoalCard({
  progress,
  freeByDay,
  onSave,
  saving,
}: {
  progress: WeeklyProgress;
  freeByDay: Map<number, FreePeriod[]> | null;
  onSave: (target: number) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState(progress.target);

  // A refresh elsewhere (or another device) can change the stored target
  // underneath an untouched card.
  useEffect(() => setDraft(progress.target), [progress.target]);

  const dirty = draft !== progress.target;

  const suggestions = freeByDay
    ? [...freeByDay.entries()]
        .flatMap(([day, periods]) => periods.map((period) => ({ day, period })))
        .slice(0, MAX_SUGGESTIONS)
    : [];

  return (
    <Card className={styles.card}>
      <div className={styles.head}>
        <p className={styles.title}>
          <Target size={15} /> Weekly practice goal
        </p>
        {progress.met && (
          <span className={styles.met}>
            <Check size={12} /> Met
          </span>
        )}
      </div>

      {progress.target > 0 ? (
        <div className={styles.top}>
          <div className={styles.countBlock}>
            <p className={styles.count}>
              {progress.solved}
              <span className={styles.of}>/ {progress.target}</span>
            </p>
            <p className={styles.hint}>
              {progress.met
                ? "Goal met — anything else this week is a bonus."
                : `${progress.remaining} to go, ${progress.daysLeft} ${progress.daysLeft === 1 ? "day" : "days"} left.`}
            </p>
          </div>
          <ProgressRing
            percent={progress.percent}
            size={68}
            strokeWidth={7}
            color={progress.met ? "var(--status-good)" : "var(--color-primary)"}
          >
            <span className={styles.ringPercent}>{progress.percent}%</span>
          </ProgressRing>
        </div>
      ) : (
        <p className={styles.hint}>
          No goal yet. Pick a number you'd actually hit in a normal week — three is a real goal,
          twenty is a New Year's resolution.
        </p>
      )}

      <div className={styles.stepper}>
        <button
          type="button"
          className={styles.stepButton}
          onClick={() => setDraft((value) => Math.max(0, value - 1))}
          aria-label="Lower the weekly goal"
        >
          <Minus size={14} />
        </button>
        <span className={styles.stepValue}>{draft === 0 ? "None" : draft}</span>
        <button
          type="button"
          className={styles.stepButton}
          onClick={() => setDraft((value) => Math.min(50, value + 1))}
          aria-label="Raise the weekly goal"
        >
          <Plus size={14} />
        </button>
        {dirty && (
          <Button size="sm" loading={saving} onClick={() => onSave(draft)}>
            Save
          </Button>
        )}
      </div>

      {/* Only worth showing while there is still something to do this week. */}
      {suggestions.length > 0 && !progress.met && progress.target > 0 && (
        <div className={styles.slots}>
          <p className={styles.slotsTitle}>
            <CalendarClock size={13} /> Free periods you could use
          </p>
          <div className={styles.slotGrid}>
            {suggestions.map(({ day, period }) => (
              <span key={`${day}-${period.periodNo}`} className={styles.slot}>
                <strong>{WEEKDAY_LABELS[day]}</strong> {formatTime12h(period.startTime)}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
