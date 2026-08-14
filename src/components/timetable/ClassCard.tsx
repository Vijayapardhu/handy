import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatTime12h } from "@/lib/date";
import type { TimetableEntryDoc, TimetableEntryType } from "@/types/timetable";
import type { SubjectDoc } from "@/types/subject";
import styles from "./ClassCard.module.css";

const TYPE_LABELS: Record<TimetableEntryType, string> = {
  lecture: "Core",
  lab: "Lab",
  technical: "Technical",
  break: "Break",
  activity: "Activity",
};

export function ClassCard({ entry, subject }: { entry: TimetableEntryDoc; subject?: SubjectDoc }) {
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
        <span className={styles.timeEnd}>{formatTime12h(entry.endTime)}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <p className={styles.subjectName}>{subject?.name ?? "Unknown subject"}</p>
          <span className={styles.typeBadge}>{TYPE_LABELS[entry.type]}</span>
        </div>
        <p className={styles.faculty}>{entry.facultyName}</p>
        {entry.room && (
          <p className={styles.room}>
            <MapPin size={12} /> Room {entry.room}
          </p>
        )}
      </div>
    </Card>
  );
}
