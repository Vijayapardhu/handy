// POST /api/timetables — body: { entity: "version"|"entry", action, id?, data?, force? }
//
// Same self-<uid> fence as subjects.js, for the same reason: real,
// college-wide timetables only. A version's status starts "draft"; publishing
// is a separate action (isAdmin() already lets the panel read a draft, since
// it needs to see one before publishing it — see firestore.rules).
//
// Entry create/update runs a same-day, same-version, overlapping-time check
// and returns it as a warning rather than a hard block (?force=true bypasses
// it) — this is deliberately not a scheduling solver, just enough to catch
// the "typed 10:30 instead of 10:00" mistake before it ships to fifty phones.
import { getFirestore } from "firebase-admin/firestore";
import { requireAdmin, handleAdminError } from "./_admin.js";
import { isSelfNamespace } from "./_guards.js";

function timesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

async function findOverlaps(db, entry, excludeId) {
  const snap = await db
    .collection("timetableEntries")
    .where("timetableVersionId", "==", entry.timetableVersionId)
    .where("dayOfWeek", "==", entry.dayOfWeek)
    .get();

  return snap.docs
    .filter((d) => d.id !== excludeId && d.get("active") !== false)
    .filter((d) => timesOverlap(entry.startTime, entry.endTime, d.get("startTime"), d.get("endTime")))
    .map((d) => ({ id: d.id, subjectId: d.get("subjectId"), startTime: d.get("startTime"), endTime: d.get("endTime") }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const admin = await requireAdmin(req);
    const db = getFirestore();
    const { entity, action, id, data, force } = req.body ?? {};
    const now = new Date().toISOString();

    if (entity === "version") {
      if (action === "create") {
        if (isSelfNamespace(data?.semesterId)) {
          return res.status(400).json({ ok: false, error: "self_namespace_reserved" });
        }
        const ref = db.collection("timetableVersions").doc();
        await ref.set({
          semesterId: String(data.semesterId ?? ""),
          department: String(data.department ?? ""),
          section: String(data.section ?? ""),
          versionNumber: Number(data.versionNumber ?? 1),
          effectiveFrom: String(data.effectiveFrom ?? now.slice(0, 10)),
          effectiveUntil: null,
          status: "draft",
          publishedAt: null,
          publishedBy: null,
          createdAt: now,
        });
        return res.status(200).json({ ok: true, id: ref.id });
      }

      if (action === "publish") {
        const ref = db.doc(`timetableVersions/${id}`);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });
        if (isSelfNamespace(snap.get("semesterId"))) {
          return res.status(403).json({ ok: false, error: "cannot_edit_self_namespace" });
        }
        await ref.update({ status: "published", publishedAt: now, publishedBy: admin.uid });
        return res.status(200).json({ ok: true });
      }

      if (action === "archive") {
        const ref = db.doc(`timetableVersions/${id}`);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });
        if (isSelfNamespace(snap.get("semesterId"))) {
          return res.status(403).json({ ok: false, error: "cannot_edit_self_namespace" });
        }
        await ref.update({ status: "archived", effectiveUntil: now.slice(0, 10) });
        return res.status(200).json({ ok: true });
      }
    }

    if (entity === "entry") {
      if (action === "create" || action === "update") {
        const entry = {
          timetableVersionId: String(data.timetableVersionId ?? ""),
          dayOfWeek: Number(data.dayOfWeek),
          startTime: String(data.startTime ?? ""),
          endTime: String(data.endTime ?? ""),
          subjectId: String(data.subjectId ?? ""),
          facultyId: String(data.facultyId ?? ""),
          facultyName: String(data.facultyName ?? ""),
          room: data.room ?? null,
          block: data.block ?? null,
          periodNo: data.periodNo ?? null,
          type: data.type ?? "lecture",
          active: true,
        };
        if (entry.timetableVersionId.startsWith("self-")) {
          // timetableEntries carry no semesterId of their own; every
          // self-imported version is id'd `self-<uid>-tt<n>`
          // (selfTimetableVersionId), the same prefix fence firestore.rules
          // checks on the student-write side.
          return res.status(403).json({ ok: false, error: "cannot_edit_self_namespace" });
        }

        if (!force) {
          const overlaps = await findOverlaps(db, entry, action === "update" ? id : null);
          if (overlaps.length > 0) {
            return res.status(200).json({ ok: true, warning: "overlap", overlaps });
          }
        }

        const ref = action === "create" ? db.collection("timetableEntries").doc() : db.doc(`timetableEntries/${id}`);
        await ref.set(entry, { merge: action === "update" });
        return res.status(200).json({ ok: true, id: ref.id });
      }

      if (action === "delete") {
        await db.doc(`timetableEntries/${id}`).update({ active: false });
        return res.status(200).json({ ok: true });
      }
    }

    return res.status(400).json({ ok: false, error: "unknown_action" });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
