// POST /api/students — body: { uid, updates } | { uids, updates }
//
// Edits one student's profile fields, or the same fields across several at
// once (StudentsPage's multi-select "move to section/semester"). Either way
// the actual allow-list enforcement is sanitizeStudentUpdate() (_guards.js) —
// see that file's tests for why this is the real mechanism behind "the admin
// cannot change a student's attendance."
import { getFirestore } from "firebase-admin/firestore";
import { requireAdmin, handleAdminError } from "./_admin.js";
import { sanitizeStudentUpdate } from "./_guards.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    await requireAdmin(req);

    const single = typeof req.body?.uid === "string" ? req.body.uid.trim() : "";
    const many = Array.isArray(req.body?.uids) ? req.body.uids.map((u) => String(u).trim()).filter(Boolean) : [];
    const uids = single ? [single] : many;
    if (uids.length === 0) return res.status(400).json({ ok: false, error: "missing_uid" });

    const result = sanitizeStudentUpdate(req.body?.updates);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });

    const db = getFirestore();

    // Chunked batched writes — Firestore batches cap at 500 operations, and
    // a bulk move is exactly the kind of action that could exceed one.
    for (let i = 0; i < uids.length; i += 400) {
      const batch = db.batch();
      for (const uid of uids.slice(i, i + 400)) {
        batch.update(db.doc(`students/${uid}`), result.clean);
      }
      await batch.commit();
    }

    return res.status(200).json({ ok: true, updated: uids.length });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
