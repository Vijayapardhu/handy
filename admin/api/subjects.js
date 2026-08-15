// POST /api/subjects — body: { action: "create"|"update"|"delete", id?, data? }
//
// Real, college-wide subjects only — never the self-<uid> namespace every
// synced student's own subjects live in (collegePortalImportService.ts). A
// semesterId starting with "self-" is rejected outright, the same fence
// firestore.rules already puts around student-written subjects, mirrored here
// so an admin can't accidentally collide with (or shadow) a student's own
// private data by choosing an unlucky semesterId.
//
// Delete is a soft delete (active:false) — the same convention the sync
// pipeline already uses for subjects a student's portal no longer lists.
import { getFirestore } from "firebase-admin/firestore";
import { requireAdmin, handleAdminError } from "./_admin.js";
import { isSelfNamespace } from "./_guards.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    await requireAdmin(req);
    const db = getFirestore();
    const { action } = req.body ?? {};
    const now = new Date().toISOString();

    if (action === "create") {
      const data = req.body?.data ?? {};
      if (isSelfNamespace(data.semesterId)) {
        return res.status(400).json({ ok: false, error: "self_namespace_reserved" });
      }
      if (!data.code || !data.name || !data.semesterId) {
        return res.status(400).json({ ok: false, error: "missing_fields" });
      }
      const ref = db.collection("subjects").doc();
      await ref.set({
        code: String(data.code),
        name: String(data.name),
        shortName: String(data.shortName ?? data.name).slice(0, 20),
        facultyId: String(data.facultyId ?? ""),
        facultyName: String(data.facultyName ?? ""),
        semesterId: String(data.semesterId),
        department: String(data.department ?? ""),
        targetAttendance: data.targetAttendance ?? null,
        icon: data.icon ?? "book",
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      return res.status(200).json({ ok: true, id: ref.id });
    }

    if (action === "update") {
      const id = String(req.body?.id ?? "");
      const data = req.body?.data ?? {};
      if (!id) return res.status(400).json({ ok: false, error: "missing_id" });

      const ref = db.doc(`subjects/${id}`);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });
      if (isSelfNamespace(snap.get("semesterId"))) {
        return res.status(403).json({ ok: false, error: "cannot_edit_self_namespace" });
      }
      if (data.semesterId && isSelfNamespace(data.semesterId)) {
        return res.status(400).json({ ok: false, error: "self_namespace_reserved" });
      }

      await ref.update({ ...data, updatedAt: now });
      return res.status(200).json({ ok: true });
    }

    if (action === "delete") {
      const id = String(req.body?.id ?? "");
      if (!id) return res.status(400).json({ ok: false, error: "missing_id" });

      const ref = db.doc(`subjects/${id}`);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });
      if (isSelfNamespace(snap.get("semesterId"))) {
        return res.status(403).json({ ok: false, error: "cannot_edit_self_namespace" });
      }

      await ref.update({ active: false, updatedAt: now });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: "unknown_action" });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
