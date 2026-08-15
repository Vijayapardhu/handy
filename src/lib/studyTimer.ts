/**
 * A study session, persisted to localStorage. Mirrors
 * mobile/lib/data/study_timer.dart's model minus the lock-screen notification
 * — that part is a device capability a browser tab doesn't have, so it's
 * intentionally not attempted here. A tab reload restores correctly anyway,
 * since elapsed time is derived from a stored timestamp rather than ticked
 * live: `accumulated + (now - startedAt)` is correct the instant the page
 * comes back, no explicit "restore" step needed.
 *
 * Only one session runs at a time, module-wide — starting a session on a
 * second subject implicitly ends whatever was running on the first, the same
 * rule mobile's singleton `studyTimer` enforces.
 */

const STORAGE_KEY = "handy.studyTimer";

interface StudyTimerState {
  subjectId: string | null;
  subjectName: string | null;
  startedAt: string | null; // ISO timestamp, or null while paused
  accumulatedSeconds: number;
}

function emptyState(): StudyTimerState {
  return { subjectId: null, subjectName: null, startedAt: null, accumulatedSeconds: 0 };
}

function load(): StudyTimerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return { ...emptyState(), ...JSON.parse(raw) };
  } catch {
    return emptyState();
  }
}

let state: StudyTimerState = load();
const listeners = new Set<() => void>();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

export function subscribeStudyTimer(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStudyTimerSnapshot(): StudyTimerState {
  return state;
}

/** Elapsed seconds right now — a function, not a stored field, since it changes every second while running. */
export function studyTimerElapsedSeconds(s: StudyTimerState = state): number {
  if (!s.startedAt) return s.accumulatedSeconds;
  return s.accumulatedSeconds + Math.floor((Date.now() - new Date(s.startedAt).getTime()) / 1000);
}

/** Starting on a different subject than the one currently running ends that session first, dropping its time. */
export function startStudyTimer(subjectId: string, subjectName: string): void {
  if (state.subjectId && state.subjectId !== subjectId) {
    state = emptyState();
  }
  state = { subjectId, subjectName, startedAt: new Date().toISOString(), accumulatedSeconds: state.accumulatedSeconds };
  save();
}

export function pauseStudyTimer(): void {
  if (!state.startedAt) return;
  state = { ...state, accumulatedSeconds: studyTimerElapsedSeconds(), startedAt: null };
  save();
}

/** Ends the session and returns how long it ran, so the caller can tell the student. */
export function stopStudyTimer(): number {
  const total = studyTimerElapsedSeconds();
  state = emptyState();
  save();
  return total;
}

/** "1:04:12" past an hour, "4:12" under it. */
export function formatStudyTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}
