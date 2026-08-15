// POST /api/post-announcement — body: { groupKey, title, body, important? }
//
// The admin-side twin of the root project's api/announce.js — same
// announcements doc shape, same notifications fan-out and FCM multicast
// batching, so the mobile app's existing announcement screen renders these
// with no changes. The one difference: the caller doesn't have to already be
// that group's class rep, since requireAdmin() already gates this endpoint.
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { requireAdmin, handleAdminError } from "./_admin.js";

const BATCH = 450;
const MAX_BODY = 4000;
const MAX_TITLE = 140;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const admin = await requireAdmin(req);
    const db = getFirestore();

    const groupKey = String(req.body?.groupKey ?? "").trim();
    const title = String(req.body?.title ?? "").trim();
    const body = String(req.body?.body ?? "").trim();
    const important = req.body?.important === true;

    if (!groupKey) return res.status(400).json({ ok: false, error: "missing_group" });
    if (!title) return res.status(400).json({ ok: false, error: "missing_title" });
    if (title.length > MAX_TITLE || body.length > MAX_BODY) {
      return res.status(400).json({ ok: false, error: "too_long" });
    }

    const now = new Date().toISOString();
    const announcement = await db.collection("announcements").add({
      groupKey,
      authorUid: admin.uid,
      authorName: admin.name || "Admin",
      authorRoll: "",
      title,
      body,
      media: [],
      links: [],
      important,
      createdAt: now,
    });

    const membersSnap = await db.collection("classGroupMembers").where("groupKey", "==", groupKey).get();
    const recipients = membersSnap.docs.map((d) => d.get("uid"));

    const preview = body.length > 120 ? `${body.slice(0, 117)}…` : body;
    const summary = preview || "Tap to read.";

    await Promise.all(
      recipients.map((uid) =>
        db.collection("notifications").add({
          userId: uid,
          type: "announcement",
          title,
          body: summary,
          actionUrl: null,
          announcementId: announcement.id,
          groupKey,
          read: false,
          createdAt: now,
        }),
      ),
    );

    const studentDocs = await Promise.all(recipients.map((uid) => db.doc(`students/${uid}`).get()));
    const tokens = studentDocs.flatMap((doc) => doc.data()?.fcmTokens ?? []);

    let delivered = 0;
    for (let i = 0; i < tokens.length; i += BATCH) {
      const result = await getMessaging().sendEachForMulticast({
        tokens: tokens.slice(i, i + BATCH),
        notification: { title, body: summary },
        data: { type: "announcement", announcementId: announcement.id, groupKey },
        android: {
          priority: important ? "high" : "normal",
          notification: {
            channelId: "handy_announcements",
            icon: "ic_notification",
            color: "#F97316",
            tag: `announcement-${announcement.id}`,
          },
        },
      });
      delivered += result.successCount;
    }

    return res.status(200).json({ ok: true, id: announcement.id, recipients: recipients.length, delivered });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
