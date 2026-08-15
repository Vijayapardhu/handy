// POST /api/notify — body: { target, title, body }
// target: { type: "student", uid }
//       | { type: "students", uids: string[] }
//       | { type: "cohort", section?, department?, year? }
//       | { type: "all" }
//
// The bulk-capable sibling of the root project's api/notify.js, which is
// strictly one recipient per call. Recipients for "cohort"/"all" are resolved
// by querying `students` with the Admin SDK (bypasses rules, same as every
// other admin write). Every notification is written with type: "announcement"
// — the one existing NotificationType that already renders safely everywhere
// (general push channel, no special tap-deep-link expectations the way
// "timetable" has) without touching the type union or any client code.
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { requireAdmin, handleAdminError } from "./_admin.js";

const BATCH = 450;
const MAX_BODY = 4000;
const MAX_TITLE = 140;

async function resolveRecipients(db, target) {
  if (target?.type === "student") {
    const uid = String(target.uid ?? "").trim();
    return uid ? [uid] : [];
  }

  if (target?.type === "students") {
    // StudentsPage's multi-select "notify selected" — an explicit list
    // rather than a filter, so it works for a hand-picked set that doesn't
    // share a single section/department/year.
    const uids = Array.isArray(target.uids) ? target.uids.map((u) => String(u).trim()).filter(Boolean) : [];
    return [...new Set(uids)];
  }

  let q = db.collection("students");
  if (target?.type === "cohort") {
    if (target.section) q = q.where("section", "==", target.section);
    if (target.department) q = q.where("department", "==", target.department);
    if (target.year) q = q.where("year", "==", Number(target.year));
  }
  // target.type === "all" falls through with no filter.
  const snap = await q.get();
  return snap.docs.map((d) => d.id);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    await requireAdmin(req);
    const db = getFirestore();

    const title = String(req.body?.title ?? "").trim();
    const body = String(req.body?.body ?? "").trim();
    if (!title) return res.status(400).json({ ok: false, error: "missing_title" });
    if (title.length > MAX_TITLE || body.length > MAX_BODY) {
      return res.status(400).json({ ok: false, error: "too_long" });
    }

    const recipients = await resolveRecipients(db, req.body?.target);
    if (recipients.length === 0) return res.status(400).json({ ok: false, error: "no_recipients" });

    const now = new Date().toISOString();

    // Chunked writes — Firestore batches cap at 500 operations.
    for (let i = 0; i < recipients.length; i += 400) {
      const batch = db.batch();
      for (const uid of recipients.slice(i, i + 400)) {
        batch.set(db.collection("notifications").doc(), {
          userId: uid,
          type: "announcement",
          title,
          body,
          actionUrl: null,
          read: false,
          createdAt: now,
        });
      }
      await batch.commit();
    }

    const studentDocs = await Promise.all(recipients.map((uid) => db.doc(`students/${uid}`).get()));
    const tokens = studentDocs.flatMap((doc) => doc.data()?.fcmTokens ?? []);

    let delivered = 0;
    for (let i = 0; i < tokens.length; i += BATCH) {
      const result = await getMessaging().sendEachForMulticast({
        tokens: tokens.slice(i, i + BATCH),
        notification: { title, body },
        data: { type: "announcement" },
        android: { notification: { channelId: "handy_push", icon: "ic_notification", color: "#F97316" } },
      });
      delivered += result.successCount;
    }

    return res.status(200).json({ ok: true, recipients: recipients.length, delivered });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
