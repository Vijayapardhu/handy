import { ClipboardList, MapPin } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { formatTime12h } from "@/lib/date";
import { AttendanceMarkButtons } from "./AttendanceMarkButtons";
import type { TimetableEntryDoc, TimetableEntryType } from "@/types/timetable";
import type { SubjectDoc } from "@/types/subject";
import type { MarkStatus } from "@/types/attendanceMark";
import { TASK_KIND_LABELS, type TaskDoc } from "@/types/task";
import styles from "./ClassCard.module.css";

const TYPE_LABELS: Record<TimetableEntryType, string> = {
  lecture: "Core",
  lab: "Lab",
  technical: "Technical",
  break: "Break",
  activity: "Activity",
};

export function ClassCard({
  entry,
  subject,
  tasks = [],
  mark,
  onMark,
  markBusy,
  endTime,
  periods = 1,
}: {
  entry: TimetableEntryDoc;
  subject?: SubjectDoc;
  /** Open tasks linked to this subject — "presentation in this class". */
  tasks?: TaskDoc[];
  /**
   * Self-marked attendance for this exact class, and the handlers to change
   * it. Undefined (not just null) means "don't offer marking at all" — the
   * caller only passes these for a class that has actually started, today.
   */
  mark?: MarkStatus | null;
  onMark?: (status: MarkStatus | null) => void;
  markBusy?: boolean;
  /**
   * Overrides `entry.endTime` — the caller passes the *last* period's end
   * time when this card represents a merged run of consecutive periods
   * (see classBlocksForDay), since `entry` itself is only ever the block's
   * first period.
   */
  endTime?: string;
  /** >1 when this card represents a merged run of consecutive same-subject periods. */
  periods?: number;
}) {
  if (entry.type === "break") {
    return (
      <div className={styles.breakRow}>
        <span>🍽️ {subject?.name ?? "Break"}</span>
        <span className={styles.breakDuration}>
          {formatTime12h(entry.startTime)} – {formatTime12h(entry.endTime)}
        </span>
      </div>
    );
  }

  return (
    <Card className={styles.card}>
      <div className={styles.timeCol}>
        <span className={styles.time}>{formatTime12h(entry.startTime)}</span>
        <span className={styles.timeEnd}>{formatTime12h(endTime ?? entry.endTime)}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <p className={styles.subjectName}>{subject?.name ?? "Unknown subject"}</p>
          <span className={styles.badgeGroup}>
            <span className={styles.typeBadge}>{TYPE_LABELS[entry.type]}</span>
            {periods > 1 && (
              <span className={styles.periodsBadge}>
                {periods} periods
              </span>
            )}
          </span>
        </div>
        <p className={styles.faculty}>{entry.facultyName}</p>
        {entry.room && (
          <p className={styles.room}>
            {/* The building matters as much as the room: "AGBI-2.1" and
                "RB-221" are in different places on campus. */}
            <MapPin size={12} /> {entry.room}
            {entry.block && <span className={styles.block}> · {entry.block}</span>}
          </p>
        )}

        {/* Why a student would look at this class today rather than just
            knowing when it is. */}
        {tasks.map((task) => (
          <p key={task.id} className={styles.task}>
            <ClipboardList size={12} /> {TASK_KIND_LABELS[task.kind]}: {task.title}
          </p>
        ))}

        {onMark && (
          <AttendanceMarkButtons
            current={mark ?? null}
            busy={markBusy}
            onMark={(status) => onMark(status)}
            onClear={() => onMark(null)}
          />
        )}
      </div>
    </Card>
  );
}
