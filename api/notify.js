// Vercel serverless function: POST /api/notify
//
// Sends a web push to one student's devices and records the same message as a
// `notifications` document, so it appears in the in-app list whether or not
// the push was delivered (blocked permission, dead token, offline device).
//
// Body: { rollNumber | uid, title, body, type?, url? }
// Header: x-handy-key, same shared secret as /api/sync.
//
// The FCM tokens come from students/{uid}.fcmTokens, written by the student's
// own browser (services/notifications/pushService.ts).
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const AUTH_EMAIL_DOMAIN = process.env.VITE_AUTH_EMAIL_DOMAIN || "handy.local";

/** Must stay in sync with NotificationType in src/types/notification.ts. */
const VALID_TYPES = new Set(["timetable", "attendance", "target", "leave", "announcement"]);

function app() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  return initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-handy-key");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const expectedKey = process.env.HANDY_SYNC_API_KEY;
  if (!expectedKey) {
    console.error("[notify] HANDY_SYNC_API_KEY is not set — refusing every request");
    return res.status(500).json({ ok: false, error: "server_not_configured" });
  }
  if (req.headers["x-handy-key"] !== expectedKey) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const payload = typeof req.body === "string" ? safeParse(req.body) : req.body;
  const { rollNumber, uid: uidInput, title, body, type = "announcement", url = "/" } = payload ?? {};

  if (!title || !body || (!rollNumber && !uidInput)) {
    return res.status(400).json({ ok: false, error: "need uid or rollNumber, plus title and body" });
  }
  if (!VALID_TYPES.has(type)) {
    return res.status(400).json({ ok: false, error: `type must be one of ${[...VALID_TYPES].join(", ")}` });
  }

  try {
    app();
    const db = getFirestore();

    const uid = uidInput ?? (await uidForRollNumber(rollNumber));
    if (!uid) return res.status(404).json({ ok: false, error: "no_such_student" });

    const student = await db.doc(`students/${uid}`).get();
    if (!student.exists) return res.status(404).json({ ok: false, error: "no_such_student" });

    // Written first and unconditionally: the in-app list is the reliable
    // channel, push is the best-effort one on top of it.
    await db.collection("notifications").add({
      userId: uid,
      type,
      title,
      body,
      actionUrl: url,
      read: false,
      createdAt: new Date().toISOString(),
    });

    const tokens = student.get("fcmTokens") ?? [];
    if (tokens.length === 0) {
      return res.status(200).json({ ok: true, uid, stored: true, pushed: 0, reason: "no_registered_devices" });
    }

    const result = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { url, tag: type },
      webpush: {
        fcmOptions: { link: url },
        notification: { icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" },
      },
    });

    const dead = pruneable(tokens, result.responses);
    if (dead.length > 0) {
      // Uninstalled apps and cleared site data leave tokens that will never
      // deliver again; keeping them means every future send reports failures.
      await db.doc(`students/${uid}`).update({ fcmTokens: FieldValue.arrayRemove(...dead) });
      console.log("[notify] pruned", dead.length, "dead token(s) for", uid);
    }

    return res.status(200).json({
      ok: true,
      uid,
      stored: true,
      pushed: result.successCount,
      failed: result.failureCount,
      pruned: dead.length,
    });
  } catch (error) {
    console.error("[notify] failed:", error);
    return res.status(500).json({ ok: false, error: String(error?.message ?? error) });
  }
}

function safeParse(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function uidForRollNumber(rollNumber) {
  const email = `${String(rollNumber).trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
  try {
    return (await getAuth().getUserByEmail(email)).uid;
  } catch (error) {
    if (error?.code === "auth/user-not-found") return null;
    throw error;
  }
}

/** Only these two codes mean the token is permanently gone; the rest are transient. */
function pruneable(tokens, responses) {
  const dead = [];
  responses.forEach((response, i) => {
    const code = response.error?.code;
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      dead.push(tokens[i]);
    }
  });
  return dead;
}
