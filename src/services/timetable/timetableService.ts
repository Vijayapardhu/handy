import { getDocs, query, where } from "firebase/firestore";
import { timetableEntriesCol, timetableVersionsCol } from "@/services/firebase/collections";
import { getActiveTimetableVersion } from "@/lib/calculations/timetable";
import type { TimetableEntryDoc, TimetableVersionDoc } from "@/types/timetable";

export async function getPublishedVersions(
  semesterId: string,
  department: string,
  section: string,
): Promise<TimetableVersionDoc[]> {
  const q = query(
    timetableVersionsCol(),
    where("semesterId", "==", semesterId),
    where("department", "==", department),
    where("section", "==", section),
    where("status", "==", "published"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export async function getEntriesForVersion(versionId: string): Promise<TimetableEntryDoc[]> {
  const q = query(timetableEntriesCol(), where("timetableVersionId", "==", versionId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

/**
 * The single entry point every timetable UI should call (SRS §19, §42):
 * resolves the version whose effective range covers `date`, then its entries.
 * Returns `{ version: null, entries: [] }` when nothing has been published
 * yet for that range — callers render the "no timetable available" empty
 * state (SRS §50) rather than guessing.
 */
export async function getActiveTimetable(
  semesterId: string,
  department: string,
  section: string,
  date: string,
): Promise<{ version: TimetableVersionDoc | null; entries: TimetableEntryDoc[] }> {
  const versions = await getPublishedVersions(semesterId, department, section);
  const version = getActiveTimetableVersion(versions, date);
  if (!version) return { version: null, entries: [] };
  const entries = await getEntriesForVersion(version.id);
  return { version, entries };
}
