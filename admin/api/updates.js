// POST /api/updates — body: { action: "create", data, notifyStudents? }
//
// Release/changelog records. `notifyStudents` reuses the same bulk-notify
// path as api/notify.js (type: "announcement", target: all) rather than
// duplicating the FCM-batching logic a third time in this file.
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { requireAdmin, handleAdminError } from "./_admin.js";

const BATCH = 450;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const admin = await requireAdmin(req);
    const db = getFirestore();
    const { action, data, notifyStudents } = req.body ?? {};

    if (action !== "create") return res.status(400).json({ ok: false, error: "unknown_action" });

    const { version, platform, changelog, downloadUrl, minSupportedVersion } = data ?? {};
    if (!version || !platform || !downloadUrl) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }
    if (!["android", "extension", "web"].includes(platform)) {
      return res.status(400).json({ ok: false, error: "invalid_platform" });
    }

    const now = new Date().toISOString();
    const ref = db.collection("appUpdates").doc();
    await ref.set({
      version: String(version),
      platform,
      changelog: changelog ?? "",
      downloadUrl: String(downloadUrl),
      minSupportedVersion: minSupportedVersion || null,
      notifiedStudents: notifyStudents === true,
      publishedAt: now,
      publishedBy: admin.uid,
    });

    let delivered = 0;
    let recipients = 0;
    if (notifyStudents === true) {
      const title = `Handy ${version} is out`;
      const body = changelog ? String(changelog).slice(0, 300) : `A new ${platform} update is available.`;

      const studentsSnap = await db.collection("students").get();
      recipients = studentsSnap.size;

      for (let i = 0; i < studentsSnap.docs.length; i += 400) {
        const batch = db.batch();
        for (const doc of studentsSnap.docs.slice(i, i + 400)) {
          batch.set(db.collection("notifications").doc(), {
            userId: doc.id,
            type: "announcement",
            title,
            body,
            actionUrl: downloadUrl,
            read: false,
            createdAt: now,
          });
        }
        await batch.commit();
      }

      const tokens = studentsSnap.docs.flatMap((d) => d.data()?.fcmTokens ?? []);
      for (let i = 0; i < tokens.length; i += BATCH) {
        const result = await getMessaging().sendEachForMulticast({
          tokens: tokens.slice(i, i + BATCH),
          notification: { title, body },
          data: { type: "announcement" },
          android: { notification: { channelId: "handy_push", icon: "ic_notification", color: "#F97316" } },
        });
        delivered += result.successCount;
      }
    }

    return res.status(200).json({ ok: true, id: ref.id, recipients, delivered });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
