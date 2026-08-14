import { doc, getDocs, orderBy, query, setDoc, where } from "firebase/firestore";
import { leaveRequestsCol } from "@/services/firebase/collections";
import type { LeaveRequestDoc } from "@/types/leave";

/**
 * Leave *requests* (this file) are a distinct concept from the Leave
 * *Planner*'s impact calculation (lib/calculations/leave.ts) — computing that
 * a date is "safe" never implies approval (SRS §26).
 */
export async function getLeaveRequests(studentId: string): Promise<LeaveRequestDoc[]> {
  const q = query(
    leaveRequestsCol(),
    where("studentId", "==", studentId),
    orderBy("submittedAt", "desc"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export async function submitLeaveRequest(
  studentId: string,
  startDate: string,
  endDate: string,
  reason: string,
): Promise<void> {
  // Pre-generate the ref so the written document satisfies LeaveRequestDoc's
  // (converter-typed) shape, `id` included — addDoc can't be used here
  // because the Firestore converter's toFirestore() expects the full model.
  const ref = doc(leaveRequestsCol());
  const record: LeaveRequestDoc = {
    id: ref.id,
    studentId,
    startDate,
    endDate,
    reason,
    status: "pending",
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
  };
  await setDoc(ref, record);
  // Students cannot set `status` to anything but "pending" — Firestore
  // security rules reject writes that try to set status directly (SRS §36).
}
