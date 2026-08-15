// Vercel serverless function: POST /api/announce
//
// A class rep posts to their room, and everyone in it hears about it.
//
// Body: { idToken, groupKey, title, body, media?, links?, important? }
//
// Authorised by the student's own Firebase ID token, not by the shared sync
// key. That distinction matters: the sync key lives inside a browser
// extension on every user's disk, and a capability that reaches every phone in
// a room must not rest on a secret that is effectively public. The token
// proves who is asking, and `classReps` says whether they may.
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

import { isClassRep, membersOf } from "./_classGroups.js";
import { publicUrl, r2Config } from "./_r2.js";

/** Firebase caps a multicast at 500. */
const BATCH = 450;

/** Enough for a paragraph and a list of what to bring; not enough for an essay. */
const MAX_BODY = 4000;
const MAX_TITLE = 140;
const MAX_ATTACHMENTS = 10;

function app() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  return initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const payload = typeof req.body === "string" ? safeParse(req.body) : req.body;
  const idToken = (req.headers.authorization ?? "").replace(/^Bearer /, "") || payload?.idToken;
  if (!idToken) return res.status(401).json({ ok: false, error: "missing_token" });

  try {
    app();
    const db = getFirestore();

    let caller;
    try {
      caller = await getAuth().verifyIdToken(idToken);
    } catch {
      return res.status(401).json({ ok: false, error: "invalid_token" });
    }

    const groupKey = String(payload?.groupKey ?? "").trim();
    const title = String(payload?.title ?? "").trim();
    const body = String(payload?.body ?? "").trim();

    if (!groupKey) return res.status(400).json({ ok: false, error: "missing_group" });
    if (!title) return res.status(400).json({ ok: false, error: "missing_title" });
    if (title.length > MAX_TITLE || body.length > MAX_BODY) {
      return res.status(400).json({ ok: false, error: "too_long" });
    }

    if (!(await isClassRep(db, caller.uid, groupKey))) {
      // Deliberately the same answer whether the group exists or not: a
      // student probing for group keys learns nothing either way.
      return res.status(403).json({ ok: false, error: "not_a_class_rep" });
    }

    const media = normaliseAttachments(payload?.media);
    const links = normaliseLinks(payload?.links);

    const student = await db.doc(`students/${caller.uid}`).get();
    const now = new Date().toISOString();

    const announcement = await db.collection("announcements").add({
      groupKey,
      authorUid: caller.uid,
      authorName: student.get("name") ?? "Class rep",
      authorRoll: student.get("rollNumber") ?? "",
      title,
      body,
      media,
      links,
      important: payload?.important === true,
      createdAt: now,
    });

    const recipients = await membersOf(db, groupKey, { except: caller.uid });
    const delivered = await notify(db, {
      recipients,
      announcementId: announcement.id,
      groupKey,
      title,
      body,
      important: payload?.important === true,
      hasMedia: media.length > 0,
      now,
    });

    return res.status(200).json({
      ok: true,
      id: announcement.id,
      recipients: recipients.length,
      delivered,
    });
  } catch (error) {
    console.error("[announce] failed:", error);
    return res.status(500).json({ ok: false, error: String(error?.message ?? error) });
  }
}

/**
 * Attachments arrive as R2 object keys, never as URLs the client chose.
 *
 * A client-supplied URL would let a post point anywhere — someone else's
 * bucket, a tracking pixel, a phishing page dressed as a lecture slide — and
 * every phone in the room would load it. The key is the only thing taken from
 * the client, and it can only name something inside our own bucket.
 *
 * The `url` written alongside it is computed *here*, from that key and our own
 * configured base, so the app has something to render without carrying bucket
 * configuration of its own — and without any URL the client sent ever reaching
 * a reader's screen. The key is kept too: it is what survives the public base
 * ever changing, and what a cleanup job would delete by.
 */
function normaliseAttachments(media) {
  if (!Array.isArray(media)) return [];
  const config = r2Config();
  return media
    .slice(0, MAX_ATTACHMENTS)
    .map((item) => ({
      key: String(item?.key ?? "").trim(),
      kind: ["image", "video", "file"].includes(item?.kind) ? item.kind : "file",
      name: String(item?.name ?? "").trim().slice(0, 120),
      size: Number(item?.size) || 0,
    }))
    // "..' cannot climb out of the bucket, but it has no business in a key we
    // generated either — its presence means the client did not send back what
    // /api/upload-url handed it.
    .filter((item) => item.key.length > 0 && !item.key.includes(".."))
    .map((item) => ({ ...item, url: config ? publicUrl(config, item.key) : null }));
}

/**
 * Links are kept as links and opened in a browser, which is the honest thing
 * to do with someone else's URL — the app never renders a page it did not
 * write. Only http(s): a javascript: or intent: URL in a class announcement
 * has no legitimate use.
 */
function normaliseLinks(links) {
  if (!Array.isArray(links)) return [];
  return links
    .slice(0, MAX_ATTACHMENTS)
    .map((item) => ({
      url: String(item?.url ?? "").trim(),
      label: String(item?.label ?? "").trim().slice(0, 120),
    }))
    .filter((item) => /^https?:\/\//i.test(item.url));
}

async function notify(db, { recipients, announcementId, groupKey, title, body, important, hasMedia, now }) {
  if (recipients.length === 0) return 0;

  const preview = body.length > 120 ? `${body.slice(0, 117)}…` : body;
  const summary = preview || (hasMedia ? "Tap to see the attachment." : "Tap to read.");

  // An inbox record each, written whether or not a device can receive the
  // push — an announcement swiped away on the bus must still be findable.
  await Promise.all(
    recipients.map((uid) =>
      db.collection("notifications").add({
        userId: uid,
        type: "announcement",
        title,
        body: summary,
        // The web reads this to know where a notification goes; the mobile app
        // routes on announcementId below. Both are written so neither client
        // needs to know how the other one navigates.
        actionUrl: `/announcements/${announcementId}`,
        announcementId,
        groupKey,
        read: false,
        createdAt: now,
      }),
    ),
  );

  const docs = await Promise.all(recipients.map((uid) => db.doc(`students/${uid}`).get()));
  const tokens = docs.flatMap((doc) => doc.data()?.fcmTokens ?? []);
  if (tokens.length === 0) return 0;

  let delivered = 0;
  for (let i = 0; i < tokens.length; i += BATCH) {
    const result = await getMessaging().sendEachForMulticast({
      tokens: tokens.slice(i, i + BATCH),
      notification: { title, body: summary },
      data: { type: "announcement", announcementId, groupKey },
      android: {
        priority: important ? "high" : "normal",
        notification: {
          channelId: "handy_announcements",
          icon: "ic_notification",
          color: "#F97316",
          // One notification per announcement, so a device with two tokens
          // does not show it twice.
          tag: `announcement-${announcementId}`,
        },
      },
    });
    delivered += result.successCount;
  }

  return delivered;
}

function safeParse(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
