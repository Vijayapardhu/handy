// POST /api/academic — body: { entity: "college"|"semester"|"faculty", action, id?, data? }
//
// Colleges, semesters and faculty, consolidated into one endpoint the same
// way timetables.js handles both versions and entries — three small,
// structurally identical CRUD surfaces don't each need their own file.
import { getFirestore } from "firebase-admin/firestore";
import { requireAdmin, handleAdminError } from "./_admin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    await requireAdmin(req);
    const db = getFirestore();
    const { entity, action, id, data } = req.body ?? {};

    if (entity === "college") {
      // Singleton-per-college config (CollegeConfigDoc) — id is the
      // collegeId, action is always "update" (upsert), never create/delete;
      // a college's config always exists once seeded and is never removed
      // from the admin panel.
      if (action !== "update" || !id) return res.status(400).json({ ok: false, error: "invalid_request" });
      await db.doc(`colleges/${id}`).set(data ?? {}, { merge: true });
      return res.status(200).json({ ok: true });
    }

    if (entity === "semester") {
      if (action === "create") {
        if (!data?.label || !data?.startDate) return res.status(400).json({ ok: false, error: "missing_fields" });
        const ref = db.collection("semesters").doc();
        await ref.set({
          label: String(data.label),
          startDate: String(data.startDate),
          endDate: data.endDate || null,
          active: true,
        });
        return res.status(200).json({ ok: true, id: ref.id });
      }
      if (action === "archive") {
        if (!id) return res.status(400).json({ ok: false, error: "missing_id" });
        await db.doc(`semesters/${id}`).update({ active: false });
        return res.status(200).json({ ok: true });
      }
    }

    if (entity === "faculty") {
      if (action === "create") {
        if (!data?.name || !data?.department) return res.status(400).json({ ok: false, error: "missing_fields" });
        const ref = db.collection("faculty").doc();
        await ref.set({
          name: String(data.name),
          department: String(data.department),
          email: data.email || null,
          active: true,
        });
        return res.status(200).json({ ok: true, id: ref.id });
      }
      if (action === "archive") {
        if (!id) return res.status(400).json({ ok: false, error: "missing_id" });
        await db.doc(`faculty/${id}`).update({ active: false });
        return res.status(200).json({ ok: true });
      }
    }

    return res.status(400).json({ ok: false, error: "unknown_action" });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
