import { useState } from "react";
import { Clock, Minus, PlayCircle } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useStudyTimer } from "@/hooks/useStudyTimer";
import { formatStudyTime } from "@/lib/studyTimer";
import type { SubjectDoc } from "@/types/subject";
import styles from "./StudyTimerCard.module.css";

/**
 * Start, pause and stop a study session for one subject. Placed on the
 * subject page rather than under Tasks: a study session is time spent on a
 * subject, not a thing that's due.
 *
 * Only one session runs at a time, module-wide (see lib/studyTimer.ts) —
 * starting one on a second subject switches to it. Two concurrent timers
 * would just be two wrong figures.
 */
export function StudyTimerCard({ subject }: { subject: SubjectDoc }) {
  const timer = useStudyTimer();
  const [lastSession, setLastSession] = useState<string | null>(null);

  const mine = timer.subjectId === subject.id;
  const elsewhere = timer.hasSession && !mine;

  function handleStartPause() {
    setLastSession(null);
    if (mine && timer.isRunning) {
      timer.pause();
    } else {
      timer.start(subject.id, subject.shortName || subject.name);
    }
  }

  function handleStop() {
    const total = timer.stop();
    setLastSession(`Studied ${formatStudyTime(total)}${subject.shortName ? ` of ${subject.shortName}` : ""}`);
  }

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <Clock size={16} className={mine && timer.isRunning ? styles.iconActive : styles.icon} />
        <span className={styles.label}>Study timer</span>
        {mine && <span className={styles.time}>{formatStudyTime(timer.elapsedSeconds)}</span>}
      </div>

      {elsewhere && (
        <p className={styles.hint}>
          A session is running on {timer.subjectName ?? "another subject"}. Starting one here will switch to it.
        </p>
      )}
      {lastSession && !mine && <p className={styles.hint}>{lastSession}</p>}

      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={handleStartPause} className={styles.startButton}>
          {mine && timer.isRunning ? (
            <>
              <Minus size={14} /> Pause
            </>
          ) : (
            <>
              <PlayCircle size={14} /> {mine ? "Resume" : "Start"}
            </>
          )}
        </Button>
        {mine && (
          <Button variant="ghost" size="sm" onClick={handleStop}>
            Stop
          </Button>
        )}
      </div>
    </Card>
  );
}
