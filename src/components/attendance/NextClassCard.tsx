import { Link } from "react-router-dom";
import { Clock, MapPin, ChevronRight, CalendarDays } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatTime12h } from "@/lib/date";
import { ROUTES } from "@/constants/routes";
import type { TimetableEntryDoc } from "@/types/timetable";
import type { SubjectDoc } from "@/types/subject";
import styles from "./NextClassCard.module.css";

interface NextClassCardProps {
  entry: TimetableEntryDoc | null;
  subject: SubjectDoc | null | undefined;
  onMarkPresent?: () => void;
  marking?: boolean;
}

/** SRS §8.4 — only the next relevant class, resolved from the active timetable version. */
export function NextClassCard({ entry, subject, onMarkPresent, marking }: NextClassCardProps) {
  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Next Class</h2>
        <Link to={ROUTES.timetable} className={styles.todayLink}>
          Today <CalendarDays size={14} />
        </Link>
      </div>

      {!entry ? (
        <EmptyState
          icon={CalendarDays}
          title="No more classes today"
          description="You're done for the day, or nothing has been published yet."
        />
      ) : (
        <div className={styles.body}>
          <div className={styles.iconWrap}>
            <CalendarDays size={20} />
          </div>
          <div className={styles.info}>
            <p className={styles.subjectName}>{subject?.name ?? "Loading…"}</p>
            <p className={styles.faculty}>{entry.facultyName}</p>
            <div className={styles.metaRow}>
              <span className={styles.metaItem}>
                <Clock size={13} />
                {formatTime12h(entry.startTime)} – {formatTime12h(entry.endTime)}
              </span>
              {entry.room && (
                <span className={styles.metaItem}>
                  <MapPin size={13} />
                  Room {entry.room}
                </span>
              )}
            </div>
          </div>
          {onMarkPresent && (
            <Button size="sm" onClick={onMarkPresent} loading={marking}>
              Mark Present <ChevronRight size={14} />
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
