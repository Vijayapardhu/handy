import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, MapPin, ChevronRight, CalendarDays, PlayCircle, ArrowRight } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatTime12h } from "@/lib/date";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { TimetableEntryDoc } from "@/types/timetable";
import type { SubjectDoc } from "@/types/subject";
import styles from "./NextClassCard.module.css";

interface NextClassCardProps {
  entry: TimetableEntryDoc | null;
  subject: SubjectDoc | null | undefined;
  /** The class right after `entry` — shown only while `entry` is running. */
  after?: TimetableEntryDoc | null;
  afterSubject?: SubjectDoc | null;
  onMarkPresent?: () => void;
  marking?: boolean;
}

function todayAt(hhmm: string, base: Date): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

/** "45 min" close up, "1 h 20 min" further out — matches mobile's _relative(). */
function relative(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * SRS §8.4 — only the next relevant class, resolved from the active timetable
 * version. Ticks every 20s (matching mobile's today_screen.dart) so the
 * countdown and the in-progress bar stay live without a manual refresh —
 * this is the one card on the home screen that changes while you're looking
 * at it.
 */
export function NextClassCard({ entry, subject, after, afterSubject, onMarkPresent, marking }: NextClassCardProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!entry) return;
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, [entry]);

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
        (() => {
          const start = todayAt(entry.startTime, now);
          const end = todayAt(entry.endTime, now);
          const running = now >= start && now < end;
          const progress = running ? ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100 : 0;
          const countdownLabel = running
            ? `Ongoing · ends in ${relative(end.getTime() - now.getTime())}`
            : `Starts in ${relative(start.getTime() - now.getTime())}`;

          return (
            <div className={cn(styles.body, running && styles.running)}>
              <div className={styles.topRow}>
                <span className={cn(styles.countdown, running && styles.countdownRunning)}>
                  {running ? <PlayCircle size={13} /> : <Clock size={13} />}
                  {countdownLabel}
                </span>
              </div>

              <div className={styles.mainRow}>
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

              {running && after && (
                <p className={styles.thenLine}>
                  <ArrowRight size={13} /> Then {afterSubject?.shortName || afterSubject?.name || "your next class"} at{" "}
                  {formatTime12h(after.startTime)}
                </p>
              )}

              {running && <ProgressBar value={progress} className={styles.progressBar} />}
            </div>
          );
        })()
      )}
    </Card>
  );
}
