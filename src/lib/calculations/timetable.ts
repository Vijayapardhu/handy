/**
 * Timetable version selection and change detection (SRS §19, §42, §54, §69).
 * Pure functions over plain data — no Firestore access here (see
 * services/timetable for the query layer that feeds these).
 */
import type { TimetableEntryDiff, TimetableEntryDoc, TimetableVersionDoc } from "@/types/timetable";

/**
 * Selects the single published version whose effective range contains `date`.
 *   published AND effectiveFrom <= date AND (effectiveUntil is null OR effectiveUntil >= date)
 * If several published versions overlap (shouldn't happen, but data can be
 * messy), the most recently published one wins.
 */
export function getActiveTimetableVersion(
  versions: TimetableVersionDoc[],
  date: string,
): TimetableVersionDoc | null {
  const candidates = versions.filter((v) => {
    if (v.status !== "published") return false;
    if (v.effectiveFrom > date) return false;
    if (v.effectiveUntil !== null && v.effectiveUntil < date) return false;
    return true;
  });
  if (candidates.length === 0) return null;
  return candidates.reduce((latest, v) =>
    (v.publishedAt ?? "") > (latest.publishedAt ?? "") ? v : latest,
  );
}

export function getEntriesForDay(
  entries: TimetableEntryDoc[],
  dayOfWeek: number,
): TimetableEntryDoc[] {
  return entries
    .filter((e) => e.active && e.dayOfWeek === dayOfWeek)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** Finds the next upcoming (or currently running) entry for "today" from `nowTime` onward. */
export function getNextEntry(
  entries: TimetableEntryDoc[],
  dayOfWeek: number,
  nowTime: string,
): TimetableEntryDoc | null {
  const today = getEntriesForDay(entries, dayOfWeek);
  return today.find((e) => e.endTime >= nowTime) ?? null;
}

export interface FreePeriod {
  periodNo: number;
  startTime: string;
  endTime: string;
}

/**
 * Periods that exist in the week's grid but have no class on `dayOfWeek`.
 *
 * The portal publishes a fixed period grid (1..7 here) and only sends rows for
 * periods that are actually taught, so a missing row *is* a free period. Times
 * are recovered from the same period on other days, since a period keeps its
 * slot all week — which is also why a period never taught on any day can't be
 * reported: nothing tells us when it would have been.
 */
export function getFreePeriods(entries: TimetableEntryDoc[], dayOfWeek: number): FreePeriod[] {
  const timesByPeriod = new Map<number, { startTime: string; endTime: string }>();
  for (const entry of entries) {
    if (entry.periodNo != null && !timesByPeriod.has(entry.periodNo)) {
      timesByPeriod.set(entry.periodNo, { startTime: entry.startTime, endTime: entry.endTime });
    }
  }

  const busy = new Set(
    entries.filter((e) => e.active && e.dayOfWeek === dayOfWeek).map((e) => e.periodNo),
  );

  return [...timesByPeriod.entries()]
    .filter(([periodNo]) => !busy.has(periodNo))
    .map(([periodNo, times]) => ({ periodNo, ...times }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** Free periods for the whole week, keyed by day — for "when can I get work done?". */
export function getWeeklyFreePeriods(entries: TimetableEntryDoc[]): Map<number, FreePeriod[]> {
  const taughtDays = [...new Set(entries.filter((e) => e.active).map((e) => e.dayOfWeek))].sort();
  return new Map(taughtDays.map((day) => [day, getFreePeriods(entries, day)]));
}

const FIELD_LABELS: Record<TimetableEntryDiff["changes"][number]["field"], string> = {
  startTime: "Start Time",
  endTime: "End Time",
  room: "Room",
  facultyId: "Faculty",
  subjectId: "Subject",
};

/**
 * Compares entries between two timetable versions for the same subject slot,
 * matched by (dayOfWeek, subjectId). Produces added/removed/changed summaries
 * for the "Timetable Updated" notification (SRS §22, §23, §54).
 */
export function diffTimetableEntries(
  previous: TimetableEntryDoc[],
  next: TimetableEntryDoc[],
  subjectNameById: Map<string, string>,
): TimetableEntryDiff[] {
  const diffs: TimetableEntryDiff[] = [];
  const key = (e: TimetableEntryDoc) => `${e.dayOfWeek}:${e.subjectId}`;
  const prevByKey = new Map(previous.filter((e) => e.active).map((e) => [key(e), e]));
  const nextByKey = new Map(next.filter((e) => e.active).map((e) => [key(e), e]));

  for (const [k, nextEntry] of nextByKey) {
    const subjectName = subjectNameById.get(nextEntry.subjectId) ?? "Unknown subject";
    const prevEntry = prevByKey.get(k);
    if (!prevEntry) {
      diffs.push({ kind: "added", subjectName, changes: [] });
      continue;
    }
    const changes: TimetableEntryDiff["changes"] = [];
    (Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>).forEach((field) => {
      if (prevEntry[field] !== nextEntry[field]) {
        changes.push({
          field,
          label: FIELD_LABELS[field],
          previous: String(prevEntry[field] ?? "—"),
          next: String(nextEntry[field] ?? "—"),
        });
      }
    });
    if (changes.length > 0) diffs.push({ kind: "changed", subjectName, changes });
  }

  for (const [k, prevEntry] of prevByKey) {
    if (!nextByKey.has(k)) {
      const subjectName = subjectNameById.get(prevEntry.subjectId) ?? "Unknown subject";
      diffs.push({ kind: "removed", subjectName, changes: [] });
    }
  }

  return diffs;
}
