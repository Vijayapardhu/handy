import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getStudyTimerSnapshot,
  pauseStudyTimer,
  startStudyTimer,
  stopStudyTimer,
  studyTimerElapsedSeconds,
  subscribeStudyTimer,
} from "@/lib/studyTimer";

/** Ticks a re-render every second while a session is running, so the displayed elapsed time stays live. */
export function useStudyTimer() {
  const snapshot = useSyncExternalStore(subscribeStudyTimer, getStudyTimerSnapshot);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!snapshot.startedAt) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [snapshot.startedAt]);

  return {
    subjectId: snapshot.subjectId,
    subjectName: snapshot.subjectName,
    isRunning: Boolean(snapshot.startedAt),
    hasSession: Boolean(snapshot.subjectId),
    elapsedSeconds: studyTimerElapsedSeconds(snapshot),
    start: startStudyTimer,
    pause: pauseStudyTimer,
    stop: stopStudyTimer,
  };
}
