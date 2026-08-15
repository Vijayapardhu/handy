// POST /api/reset-password — body: { uid }
//
// The one channel this system has for "I forgot my password": handy.local
// isn't a real mailbox, so there was never an automated reset (see the root
// README's "no password reset" note). An admin resetting it and relaying the
// new one out of band is the closest equivalent — deliberately manual, since
// there is no delivery channel to automate it through.
import { getAuth } from "firebase-admin/auth";
import { requireAdmin, generatePassword, handleAdminError } from "./_admin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    await requireAdmin(req);

    const uid = String(req.body?.uid ?? "").trim();
    if (!uid) return res.status(400).json({ ok: false, error: "missing_uid" });

    const password = generatePassword();
    await getAuth().updateUser(uid, { password });

    // Never logged — this is the only place the new password exists outside
    // the response the admin's own browser just received.
    return res.status(200).json({ ok: true, password });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
