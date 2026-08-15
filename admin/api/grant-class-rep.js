// POST /api/grant-class-rep — body: { uid, groupKey, revoke? }
//
// The UI equivalent of scripts/grant-class-rep.mjs — same write, same doc
// shape (classReps/{uid}_{groupKey}), so api/_classGroups.js's isClassRep()
// on the student-facing side needs no changes at all. Kept as a document
// rather than deleted on revoke, same reasoning as the script: a withdrawn
// grant should leave a trace.
import { getFirestore } from "firebase-admin/firestore";
import { requireAdmin, handleAdminError } from "./_admin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const admin = await requireAdmin(req);

    const uid = String(req.body?.uid ?? "").trim();
    const groupKey = String(req.body?.groupKey ?? "").trim();
    const revoke = req.body?.revoke === true;
    if (!uid || !groupKey) return res.status(400).json({ ok: false, error: "missing_fields" });

    const db = getFirestore();

    const membership = await db.doc(`classGroupMembers/${uid}_${groupKey}`).get();
    if (!membership.exists) {
      return res.status(400).json({ ok: false, error: "not_in_group" });
    }

    const student = await db.doc(`students/${uid}`).get();
    if (!student.exists) return res.status(404).json({ ok: false, error: "student_not_found" });

    await db.doc(`classReps/${uid}_${groupKey}`).set(
      {
        uid,
        rollNumber: student.get("rollNumber") ?? "",
        groupKey,
        subjectCode: groupKey.split("-")[1] ?? "",
        active: !revoke,
        updatedAt: new Date().toISOString(),
        updatedByAdmin: admin.uid,
      },
      { merge: true },
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
