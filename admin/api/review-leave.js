// POST /api/review-leave — body: { leaveId, decision: "approved" | "rejected" }
//
// Writes only status/reviewedAt/reviewedBy. Confirmed safe against the
// "admin cannot touch attendance" guarantee before this was built:
// leaveRequests is advisory only — leaveImpactService.ts on the student side
// projects "what would attendance become if I take this day," it never writes
// back to attendance or attendanceSummaries regardless of a request's status.
import { getFirestore } from "firebase-admin/firestore";
import { requireAdmin, handleAdminError } from "./_admin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const admin = await requireAdmin(req);

    const leaveId = String(req.body?.leaveId ?? "").trim();
    const decision = req.body?.decision;
    if (!leaveId) return res.status(400).json({ ok: false, error: "missing_leave_id" });
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ ok: false, error: "invalid_decision" });
    }

    const db = getFirestore();
    const ref = db.doc(`leaveRequests/${leaveId}`);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });

    await ref.update({
      status: decision,
      reviewedAt: new Date().toISOString(),
      reviewedBy: admin.uid,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
