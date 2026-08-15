// POST /api/grant-admin — body: { email, name }
//
// Self-service continuation of scripts/grant-admin.mjs, once at least one
// admin already exists to call it. Same two rules as the bootstrap script:
// creates a brand-new Firebase Auth user (never repurposes an existing
// student account — admin identity is deliberately separate), and refuses an
// email on the synthetic student domain, since that domain means "student
// account" everywhere else in this codebase.
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { requireAdmin, generatePassword, handleAdminError } from "./_admin.js";

const STUDENT_EMAIL_DOMAIN = "handy.local";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const caller = await requireAdmin(req);

    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const name = String(req.body?.name ?? "").trim();
    if (!email || !name) return res.status(400).json({ ok: false, error: "missing_fields" });
    if (email.endsWith(`@${STUDENT_EMAIL_DOMAIN}`)) {
      return res.status(400).json({ ok: false, error: "student_domain_reserved" });
    }

    const auth = getAuth();
    const existing = await auth.getUserByEmail(email).catch(() => null);
    if (existing) return res.status(409).json({ ok: false, error: "email_in_use" });

    const password = generatePassword();
    const user = await auth.createUser({ email, password, displayName: name });

    const db = getFirestore();
    await db.doc(`admins/${user.uid}`).set({
      uid: user.uid,
      email,
      name,
      active: true,
      grantedAt: new Date().toISOString(),
      grantedBy: caller.uid,
    });

    return res.status(200).json({ ok: true, uid: user.uid, password });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
