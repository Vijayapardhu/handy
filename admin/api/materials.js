// POST /api/materials — body: { action: "upload"|"link"|"delete", data? / id? }
//
// "upload": { fileName, contentType, fileBase64, title, description, subjectId?, semesterId?, section? }
// "link":   { title, description, url, type: "link"|"video", subjectId?, semesterId?, section? }
//
// File uploads go to Vercel Blob (public access — study materials aren't
// sensitive the way announcement attachments' R2-signed-URL scheme assumes).
// Requires BLOB_READ_WRITE_TOKEN, provisioned via the Vercel Marketplace —
// see admin/.env.example. The base64 payload is capped well under Vercel's
// request-body ceiling; this is meant for lecture notes and slide decks, not
// video, which should go through the "link" action (e.g. a Drive/YouTube URL)
// instead.
import { getFirestore } from "firebase-admin/firestore";
import { put, del } from "@vercel/blob";
import { requireAdmin, handleAdminError } from "./_admin.js";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB decoded

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const admin = await requireAdmin(req);
    const db = getFirestore();
    const now = new Date().toISOString();
    const { action, data, id } = req.body ?? {};

    if (action === "upload") {
      const { fileName, contentType, fileBase64, title, description, subjectId, semesterId, section } = data ?? {};
      if (!fileName || !fileBase64 || !title) {
        return res.status(400).json({ ok: false, error: "missing_fields" });
      }

      const buffer = Buffer.from(fileBase64, "base64");
      if (buffer.byteLength > MAX_UPLOAD_BYTES) {
        return res.status(400).json({ ok: false, error: "file_too_large" });
      }

      const pathname = `materials/${Date.now()}-${fileName}`.replace(/\s+/g, "-");
      const blob = await put(pathname, buffer, {
        access: "public",
        contentType: contentType || "application/octet-stream",
      });

      const ref = db.collection("materials").doc();
      await ref.set({
        title,
        description: description ?? "",
        type: "pdf",
        url: blob.url,
        fileKey: blob.pathname,
        subjectId: subjectId || null,
        semesterId: semesterId || null,
        section: section || null,
        visible: true,
        uploadedBy: admin.uid,
        uploadedAt: now,
      });

      return res.status(200).json({ ok: true, id: ref.id, url: blob.url });
    }

    if (action === "link") {
      const { title, description, url, type, subjectId, semesterId, section } = data ?? {};
      if (!title || !url) return res.status(400).json({ ok: false, error: "missing_fields" });
      if (!/^https?:\/\//i.test(url)) return res.status(400).json({ ok: false, error: "invalid_url" });

      const ref = db.collection("materials").doc();
      await ref.set({
        title,
        description: description ?? "",
        type: type === "video" ? "video" : "link",
        url,
        fileKey: null,
        subjectId: subjectId || null,
        semesterId: semesterId || null,
        section: section || null,
        visible: true,
        uploadedBy: admin.uid,
        uploadedAt: now,
      });

      return res.status(200).json({ ok: true, id: ref.id });
    }

    if (action === "delete") {
      if (!id) return res.status(400).json({ ok: false, error: "missing_id" });
      const ref = db.doc(`materials/${id}`);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });

      const fileKey = snap.get("fileKey");
      if (fileKey) {
        await del(fileKey).catch(() => {
          // A blob that's already gone shouldn't block removing the record.
        });
      }
      await ref.delete();
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: "unknown_action" });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
