// POST /api/revoke-admin — body: { uid }
//
// Sets active:false rather than deleting the doc or the Auth user — same
// audit-trail reasoning as classReps' revoke. Self-revoke is blocked outright
// so a solo admin can't lock themselves out by mistake.
import { getFirestore } from "firebase-admin/firestore";
import { requireAdmin, handleAdminError } from "./_admin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const caller = await requireAdmin(req);

    const uid = String(req.body?.uid ?? "").trim();
    if (!uid) return res.status(400).json({ ok: false, error: "missing_uid" });
    if (uid === caller.uid) return res.status(400).json({ ok: false, error: "cannot_revoke_self" });

    const db = getFirestore();
    await db.doc(`admins/${uid}`).update({ active: false });

    return res.status(200).json({ ok: true });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
