// POST /api/list-admins — no body.
//
// The admins collection has no client `list`/`read-all` rule at all (see
// firestore.rules — only a narrow self-read exists), so this is the only way
// the /admins page can see the roster.
import { getFirestore } from "firebase-admin/firestore";
import { requireAdmin, handleAdminError } from "./_admin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    await requireAdmin(req);
    const db = getFirestore();
    const snap = await db.collection("admins").orderBy("grantedAt", "desc").get();
    const admins = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.status(200).json({ ok: true, admins });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
