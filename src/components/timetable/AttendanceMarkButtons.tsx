import { CheckCircle2, XCircle, CalendarOff } from "@/components/ui/icons";
import type { MarkStatus } from "@/types/attendanceMark";
import styles from "./AttendanceMarkButtons.module.css";

const OPTIONS: { status: MarkStatus; label: string; Icon: typeof CheckCircle2 }[] = [
  { status: "present", label: "Present", Icon: CheckCircle2 },
  { status: "absent", label: "Missed", Icon: XCircle },
  { status: "cancelled", label: "Cancelled", Icon: CalendarOff },
];

/**
 * Inline self-marking — the entire fix for "Attendance History shows
 * nothing": the official `attendance` collection is never written for a real
 * student, so this is the only place a mark actually gets created. Shown only
 * for a class that has already started, today (see TimetablePage), mirroring
 * mobile's Today-timeline rule — marking a class that hasn't happened yet
 * isn't a record, it's a guess.
 *
 * Tapping the already-active status again clears the mark — the same
 * toggle-off mobile uses, so a mis-tap costs one more tap to undo, not a
 * confirmation dialog.
 */
export function AttendanceMarkButtons({
  current,
  onMark,
  onClear,
  busy,
}: {
  current: MarkStatus | null;
  onMark: (status: MarkStatus) => void;
  onClear: () => void;
  busy?: boolean;
}) {
  return (
    <div className={styles.row} role="group" aria-label="Mark your attendance for this class">
      {OPTIONS.map(({ status, label, Icon }) => {
        const active = current === status;
        return (
          <button
            key={status}
            type="button"
            className={styles.btn}
            data-active={active}
            data-status={status}
            disabled={busy}
            aria-pressed={active}
            onClick={() => (active ? onClear() : onMark(status))}
          >
            <Icon size={14} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
