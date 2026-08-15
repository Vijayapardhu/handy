import { doc, getDoc, getDocs, query, runTransaction, where } from "firebase/firestore";
import { db } from "@/app/config/firebase";
import {
  attendanceCol,
  attendanceSummariesCol,
  COLLECTIONS,
} from "@/services/firebase/collections";
import { ATTENDED_STATUSES } from "@/lib/calculations/attendance";
import type { AttendanceRecordDoc, AttendanceStatus, AttendanceSummaryDoc } from "@/types/attendance";

/**
 * Small, single-query read for the home page and subjects list (SRS §62):
 * one equality filter on studentId, no composite index required.
 */
export async function getAttendanceSummaries(studentId: string): Promise<AttendanceSummaryDoc[]> {
  const q = query(attendanceSummariesCol(), where("studentId", "==", studentId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export async function getAttendanceSummaryForSubject(
  studentId: string,
  subjectId: string,
): Promise<AttendanceSummaryDoc | null> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.attendanceSummaries, `${studentId}_${subjectId}`));
  return snapshot.exists() ? (snapshot.data() as AttendanceSummaryDoc) : null;
}

/**
 * Records one attendance outcome and keeps the per-subject summary in sync in
 * the same transaction, so readers never see a partial update (SRS §33, §62).
 *
 * NOT wired to any student-facing button in this V1 — firestore.rules denies
 * `attendance`/`attendanceSummaries` writes to authenticated students outright
 * (SRS §25, §36: official attendance is never client-writable). This function
 * is the shape a trusted caller (Admin SDK import job, or a future Cloud
 * Function backing a live "Mark Present" session) should use; calling it from
 * a student session will fail with `permission-denied`, by design.
 */
export async function recordAttendance(
  studentId: string,
  subjectId: string,
  date: string,
  status: AttendanceStatus,
  timetableEntryId: string | null,
): Promise<void> {
  const recordRef = doc(attendanceCol());
  const summaryRef = doc(db, COLLECTIONS.attendanceSummaries, `${studentId}_${subjectId}`);

  await runTransaction(db, async (tx) => {
    const summarySnap = await tx.get(summaryRef);
    const now = new Date().toISOString();
    const current = summarySnap.exists()
      ? (summarySnap.data() as AttendanceSummaryDoc)
      : { id: `${studentId}_${subjectId}`, studentId, subjectId, attended: 0, held: 0, updatedAt: now };

    const record: AttendanceRecordDoc = {
      id: recordRef.id,
      studentId,
      subjectId,
      timetableEntryId,
      date,
      status,
      source: "manual",
      recordedAt: now,
      updatedAt: now,
    };
    tx.set(recordRef, record);

    tx.set(summaryRef, {
      ...current,
      held: current.held + 1,
      attended: current.attended + (ATTENDED_STATUSES.has(status) ? 1 : 0),
      updatedAt: now,
    });
  });
}
