import { deleteDoc, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { attendanceMarksCol } from "@/services/firebase/collections";
import {
  attendanceMarkId,
  legacyAndroidMarkId,
  type AttendanceMarkDoc,
  type MarkStatus,
} from "@/types/attendanceMark";
import { dedupeMarks } from "@/lib/calculations/attendanceMarks";

/**
 * Reads/writes for the student's own attendance marks. Sibling to
 * attendanceService.ts, deliberately not merged into it — that file's
 * functions all read the official, admin-only `attendance` collection; this
 * one is the entire other half of the story, a collection the student fully
 * owns.
 */

/** Sets (creates or edits) a mark. Re-marking the same class overwrites the previous status. */
export async function setMark(
  studentId: string,
  subjectId: string,
  date: string,
  startTime: string,
  status: MarkStatus,
  periods: number = 1,
): Promise<void> {
  const id = attendanceMarkId(studentId, subjectId, date, startTime);
  const mark: AttendanceMarkDoc = {
    id,
    studentId,
    subjectId,
    date,
    startTime,
    status,
    periods,
    // Written so a duplicate can be settled by recency rather than by a
    // coin toss — the app has always sent this, and until now the web did not.
    updatedAt: new Date().toISOString(),
  };
  await setDoc(doc(attendanceMarksCol(), id), mark);
  // Best effort: an older Android build may hold the same class under its own
  // id, and the read path collapses that anyway.
  await deleteLegacy(studentId, subjectId, date, startTime);
}

/** Clears a mark entirely — tapping the same status again is "I didn't mean to mark this." */
export async function clearMark(studentId: string, subjectId: string, date: string, startTime: string): Promise<void> {
  const id = attendanceMarkId(studentId, subjectId, date, startTime);
  // Both, and the second is not optional: deleting only the canonical document
  // would leave an older Android one behind, and the mark the student just
  // cleared would reappear on the next read as though the click never happened.
  await Promise.all([
    deleteDoc(doc(attendanceMarksCol(), id)),
    deleteLegacy(studentId, subjectId, date, startTime),
  ]);
}

async function deleteLegacy(
  studentId: string,
  subjectId: string,
  date: string,
  startTime: string,
): Promise<void> {
  try {
    await deleteDoc(doc(attendanceMarksCol(), legacyAndroidMarkId(studentId, subjectId, date, startTime)));
  } catch {
    // Nothing there to delete is the common case, and not worth failing a mark over.
  }
}

/** Every mark in a date range (inclusive), across all subjects — backs the History page. */
export async function getMarksForRange(
  studentId: string,
  startDateIso: string,
  endDateIso: string,
  subjectId?: string,
): Promise<AttendanceMarkDoc[]> {
  const clauses = [
    where("studentId", "==", studentId),
    where("date", ">=", startDateIso),
    where("date", "<=", endDateIso),
  ];
  if (subjectId) clauses.push(where("subjectId", "==", subjectId));
  const snapshot = await getDocs(query(attendanceMarksCol(), ...clauses));
  return dedupeMarks(snapshot.docs.map((d) => d.data()));
}

/** Every mark for one subject, unbounded by date — used by the per-subject history list. */
export async function getMarksForSubject(studentId: string, subjectId: string): Promise<AttendanceMarkDoc[]> {
  const q = query(attendanceMarksCol(), where("studentId", "==", studentId), where("subjectId", "==", subjectId));
  const snapshot = await getDocs(q);
  return dedupeMarks(snapshot.docs.map((d) => d.data()));
}

/** Every mark for one student, unbounded — the History page's "List view" wants full history, not a range. */
export async function getAllMarks(studentId: string): Promise<AttendanceMarkDoc[]> {
  const q = query(attendanceMarksCol(), where("studentId", "==", studentId));
  const snapshot = await getDocs(q);
  return dedupeMarks(snapshot.docs.map((d) => d.data()));
}
