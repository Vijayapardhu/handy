import { getDoc } from "firebase/firestore";
import { academicRecordDocRef } from "@/services/firebase/collections";
import type { AcademicRecordDoc } from "@/types/academicRecord";

/**
 * Read-only from the client — written exclusively by api/verify.js during an
 * AEC/ACET/AGBS portal sign-in (see firestore.rules). Null covers both "never
 * signed in since this existed" and "AUS, which has no equivalent scrape" —
 * the page itself is what tells those two apart for the student.
 */
export async function getAcademicRecord(uid: string): Promise<AcademicRecordDoc | null> {
  const snapshot = await getDoc(academicRecordDocRef(uid));
  return snapshot.exists() ? snapshot.data() : null;
}
