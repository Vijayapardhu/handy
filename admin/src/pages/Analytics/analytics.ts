import { getDocs, query, where } from "firebase/firestore";
import type { CollectionReference, Query } from "firebase/firestore";
import { studentsCol, attendanceSummariesCol, classGroupMembersCol, classRepsCol } from "@/services/firebase/collections";
import type { StudentDoc } from "@/types/student";

/** Firestore caps an `in` clause at 30 values — every chunked lookup in this file respects that. */
const IN_CHUNK = 30;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function whereInChunked<T>(col: CollectionReference<T>, field: string, values: string[]) {
  const unique = [...new Set(values)];
  if (unique.length === 0) return [] as T[];
  const results = await Promise.all(
    chunk(unique, IN_CHUNK).map(async (group) => {
      const snap = await getDocs(query(col, where(field, "in", group)) as Query<T>);
      return snap.docs.map((d) => d.data());
    }),
  );
  return results.flat();
}

export interface StudentAttendance {
  student: StudentDoc;
  attended: number;
  held: number;
  percentage: number | null;
}

const BANDS = [
  { label: "< 50%", min: 0, max: 50 },
  { label: "50–64%", min: 50, max: 65 },
  { label: "65–74%", min: 65, max: 75 },
  { label: "75–84%", min: 75, max: 85 },
  { label: "85–100%", min: 85, max: 101 },
];

/**
 * Everything the Analytics page shows for one cohort (a semesterId), in one
 * pass. Bounded by the cohort's own size rather than the whole student body —
 * scoping to a semester is what keeps this to a handful of chunked reads
 * instead of an unbounded collection scan, the same reasoning behind the
 * existing Subjects/Timetables pages requiring a semester id before they
 * query anything.
 */
export async function loadCohortAnalytics(semesterId: string) {
  const studentsSnap = await getDocs(query(studentsCol(), where("semesterId", "==", semesterId)));
  const students = studentsSnap.docs.map((d) => d.data());
  if (students.length === 0) return null;

  const uids = students.map((s) => s.uid);

  const summaries = await whereInChunked(attendanceSummariesCol(), "studentId", uids);
  const bySt = new Map<string, { attended: number; held: number }>();
  for (const s of summaries) {
    const row = bySt.get(s.studentId) ?? { attended: 0, held: 0 };
    row.attended += s.attended;
    row.held += s.held;
    bySt.set(s.studentId, row);
  }

  const attendance: StudentAttendance[] = students.map((student) => {
    const row = bySt.get(student.uid);
    const percentage = row && row.held > 0 ? (row.attended / row.held) * 100 : null;
    return { student, attended: row?.attended ?? 0, held: row?.held ?? 0, percentage };
  });

  const distribution = BANDS.map((band) => ({
    label: band.label,
    count: attendance.filter((a) => a.percentage !== null && a.percentage >= band.min && a.percentage < band.max).length,
  }));

  const atRisk = attendance
    .filter((a) => a.percentage !== null && a.percentage < 75)
    .sort((a, b) => (a.percentage ?? 0) - (b.percentage ?? 0));

  const byDepartment = groupCount(students, (s) => s.department || "Unknown");
  const bySection = groupCount(students, (s) => s.section || "Unknown");

  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const month = 30 * 24 * 60 * 60 * 1000;
  const freshness = { thisWeek: 0, thisMonth: 0, older: 0, never: 0 };
  for (const s of students) {
    if (!s.profileComplete || !s.updatedAt) {
      freshness.never++;
      continue;
    }
    const age = now - new Date(s.updatedAt).getTime();
    if (age <= week) freshness.thisWeek++;
    else if (age <= month) freshness.thisMonth++;
    else freshness.older++;
  }

  const memberships = await whereInChunked(classGroupMembersCol(), "uid", uids);
  const groupKeys = [...new Set(memberships.map((m) => m.groupKey))];
  const reps = await whereInChunked(classRepsCol(), "groupKey", groupKeys);
  const groupsWithActiveRep = new Set(reps.filter((r) => r.active).map((r) => r.groupKey));

  return {
    cohortSize: students.length,
    attendance,
    distribution,
    atRisk,
    byDepartment,
    bySection,
    freshness,
    classRepCoverage: { totalGroups: groupKeys.length, groupsWithRep: groupsWithActiveRep.size },
  };
}

function groupCount<T>(items: T[], keyOf: (item: T) => string): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}
