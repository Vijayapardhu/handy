// POST /api/import-students — body: { rows: [{ rollNumber, name, department, course, year, section, semesterId, collegeId }] }
//
// Bulk-creates NEW student accounts only — never touches an existing one.
// Editing a student who already exists is StudentDetailPage's job; importing
// is for onboarding a batch that has never signed in. A row whose roll number
// already has an account is skipped and reported, not merged over.
//
// New accounts use the same shared default password every other
// onboarding path in this system uses (ACCOUNT_PASSWORD in the root
// project's src/services/firebase/auth.ts, "Handy@123") — not a fresh
// per-student secret, so the student can sign in the same way the README
// documents for everyone else ("Continue as <roll number>"). Admin-imported
// accounts are marked profileComplete: true, the same precedent
// scripts/seed-students.mjs already set for admin-entered data.
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { requireAdmin, handleAdminError } from "./_admin.js";

const AUTH_EMAIL_DOMAIN = "handy.local";
const ACCOUNT_PASSWORD = "Handy@123";
const MAX_ROWS = 500;

function rollNumberToEmail(rollNumber) {
  return `${String(rollNumber).trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    await requireAdmin(req);

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length === 0) return res.status(400).json({ ok: false, error: "no_rows" });
    if (rows.length > MAX_ROWS) return res.status(400).json({ ok: false, error: "too_many_rows" });

    const auth = getAuth();
    const db = getFirestore();
    const now = new Date().toISOString();
    const results = [];

    for (const row of rows) {
      const rollNumber = String(row?.rollNumber ?? "").trim();
      if (!rollNumber) {
        results.push({ rollNumber: row?.rollNumber ?? "", status: "error", error: "missing_roll_number" });
        continue;
      }

      const email = rollNumberToEmail(rollNumber);
      const existing = await auth.getUserByEmail(email).catch(() => null);
      if (existing) {
        results.push({ rollNumber, status: "skipped", error: "already_exists" });
        continue;
      }

      try {
        const user = await auth.createUser({ email, password: ACCOUNT_PASSWORD });
        await db.doc(`students/${user.uid}`).set({
          uid: user.uid,
          rollNumber,
          name: String(row.name ?? ""),
          email,
          department: String(row.department ?? ""),
          course: String(row.course ?? ""),
          year: Number(row.year) || 1,
          section: String(row.section ?? ""),
          semesterId: String(row.semesterId ?? ""),
          collegeId: String(row.collegeId ?? ""),
          photoUrl: null,
          profileComplete: true,
          createdAt: now,
          updatedAt: now,
        });
        results.push({ rollNumber, status: "created", uid: user.uid });
      } catch (rowError) {
        results.push({ rollNumber, status: "error", error: String(rowError?.message ?? rowError) });
      }
    }

    return res.status(200).json({
      ok: true,
      created: results.filter((r) => r.status === "created").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "error").length,
      results,
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
