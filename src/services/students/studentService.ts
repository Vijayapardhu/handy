import { getDoc, setDoc, updateDoc } from "firebase/firestore";
import { studentDocRef } from "@/services/firebase/collections";
import { rollNumberToEmail } from "@/services/firebase/auth";
import type { StudentDoc } from "@/types/student";

/** Student doc id === Firebase Auth uid (see services/firebase/auth.ts for the login flow). */
export async function getStudentProfile(uid: string): Promise<StudentDoc | null> {
  const snapshot = await getDoc(studentDocRef(uid));
  return snapshot.exists() ? snapshot.data() : null;
}

/**
 * Creates the minimal `students/{uid}` doc right after self-registration
 * (see AuthProvider.signUp) — everything real (name, course, attendance...)
 * gets filled in by the mandatory "Connect College Portal" step that follows
 * (collegePortalImportService.importCollegePortalSnapshot), which is exactly
 * why `profileComplete` starts false. firestore.rules only allows this
 * shape at create time (see the `students` match block).
 */
export async function createStudentStub(uid: string, rollNumber: string): Promise<StudentDoc> {
  const now = new Date().toISOString();
  const doc: StudentDoc = {
    id: uid,
    uid,
    rollNumber,
    name: "",
    email: rollNumberToEmail(rollNumber),
    department: "",
    course: "",
    year: 0,
    section: "",
    semesterId: "",
    collegeId: "",
    photoUrl: null,
    profileComplete: false,
    createdAt: now,
    updatedAt: now,
  };
  // The converter strips `id` on write — it's the document's own key.
  await setDoc(studentDocRef(uid), doc);
  return doc;
}

/**
 * Idempotent version of the above, for the recovery case: signup creates the
 * Auth account and the stub in two steps, so a crash/offline moment between
 * them leaves an account whose `students/{uid}` doc never got written. Every
 * write path that assumes the doc exists (notably the portal import, which
 * uses `update`) calls this first rather than failing on a missing document.
 */
export async function ensureStudentStub(uid: string, rollNumber: string): Promise<StudentDoc> {
  const existing = await getStudentProfile(uid);
  return existing ?? (await createStudentStub(uid, rollNumber));
}

/** Students may only edit the limited personal fields SRS §27 calls out — never roll number, course, or year. */
export type EditablePersonalFields = Pick<StudentDoc, "photoUrl">;

export async function updatePersonalInfo(
  uid: string,
  fields: Partial<EditablePersonalFields>,
): Promise<void> {
  await updateDoc(studentDocRef(uid), { ...fields, updatedAt: new Date().toISOString() });
}
