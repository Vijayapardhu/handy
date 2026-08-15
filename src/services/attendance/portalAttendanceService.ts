import { getDocs, query, where } from "firebase/firestore";
import { attendanceCol } from "@/services/firebase/collections";
import type { AttendanceMarkDoc, MarkStatus } from "@/types/attendanceMark";
import type { AttendanceRecordDoc } from "@/types/attendance";

/**
 * The college's own day-by-day record, where it publishes one.
 *
 * AEC and ACET report which classes met on a given day and whether the student
 * was there; AUS reports running totals only. So for most students this
 * collection is empty and everything below quietly returns nothing.
 *
 * These are read-only to the student — `attendance` is `allow write: if false`
 * for every client — which is the difference from `attendanceMarks`, their own
 * editable note about a day.
 */
export async function getPortalRecordsForRange(
  studentId: string,
  startDateIso: string,
  endDateIso: string,
  subjectId?: string,
): Promise<AttendanceRecordDoc[]> {
  const clauses = [
    where("studentId", "==", studentId),
    where("date", ">=", startDateIso),
    where("date", "<=", endDateIso),
  ];
  if (subjectId) clauses.push(where("subjectId", "==", subjectId));

  try {
    const snapshot = await getDocs(query(attendanceCol(), ...clauses));
    return snapshot.docs.map((d) => d.data());
  } catch {
    // A student with none of these has nothing to show, not an error to see.
    return [];
  }
}

/** "leave"/"excused" have no equivalent a student can set, so they read as cancelled. */
function toMarkStatus(status: AttendanceRecordDoc["status"]): MarkStatus {
  if (status === "present") return "present";
  if (status === "absent") return "absent";
  return "cancelled";
}

/**
 * The college's records and the student's own notes, as one list.
 *
 * Where both describe the same subject on the same day, **the college's record
 * wins**. A self-mark is what a student remembered in the moment; the portal is
 * what the college has actually recorded against them, which is the thing that
 * decides whether they sit the exam. Showing the student's guess over the
 * college's record would be comforting and wrong.
 *
 * Portal records are given a `startTime` of "00:00" because the portal reports
 * a day, not a period — these campuses publish no timetable, so there is no
 * class time to attach. That keeps the id scheme intact without inventing a
 * precision the source does not have.
 */
export function mergeAttendance(
  marks: AttendanceMarkDoc[],
  records: AttendanceRecordDoc[],
): AttendanceMarkDoc[] {
  const portalKeys = new Set(records.map((r) => `${r.subjectId}_${r.date}`));

  const fromPortal: AttendanceMarkDoc[] = records.map((record) => ({
    id: record.id,
    studentId: record.studentId,
    subjectId: record.subjectId,
    date: record.date,
    status: toMarkStatus(record.status),
    startTime: "00:00",
    periods: 1,
  }));

  const ownNotes = marks.filter((mark) => !portalKeys.has(`${mark.subjectId}_${mark.date}`));

  return [...fromPortal, ...ownNotes].sort((a, b) => b.date.localeCompare(a.date));
}
