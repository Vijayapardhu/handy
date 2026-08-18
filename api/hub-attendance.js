// Vercel serverless function: POST /api/hub-attendance
//
// Body:    { idToken }
// Returns: { ok, linked, snapshot? }
//
// Reads back what hub-connect.js stored, silently refreshes the Maya token
// when it's within a minute of its hour-long expiry (decrypting the stored
// password only for that one re-login call), then fetches and aggregates
// attendance for every course the login response named.
//
// `linked: false` (not an error) is the answer for a student who has never
// connected the Hub — same shape ConnectPortalPage expects from its own
// "nothing yet" state, so the card can render a connect prompt rather than an
// error state.
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import {
  hubSecureLogin,
  hubFetchCourseModules,
  aggregateHubCourse,
  decryptHubPassword,
  InvalidHubCredentialsError,
} from "./_hubPortal.js";

/** Refresh a little before the token actually dies, not exactly on the second. */
const EXPIRY_BUFFER_MS = 60_000;

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

  app();
  const db = getFirestore();

  let caller;
  try {
    caller = await getAuth().verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }

  const ref = db.doc(`hubAccounts/${caller.uid}`);
  const snap = await ref.get();
  if (!snap.exists) return res.status(200).json({ ok: true, linked: false });

  let account = snap.data();

  if (!account.token || !account.tokenExp || account.tokenExp - EXPIRY_BUFFER_MS <= Date.now()) {
    try {
      const password = decryptHubPassword(account.encPassword);
      const fresh = await hubSecureLogin(account.rollNumber, password);
      account = {
        ...account,
        hubStudentId: fresh.studentId,
        hubName: fresh.name,
        token: fresh.token,
        tokenExp: fresh.tokenExp,
        courses: fresh.courses,
        updatedAt: new Date().toISOString(),
      };
      await ref.set(account, { merge: true });
    } catch (error) {
      if (error instanceof InvalidHubCredentialsError) {
        // The stored password no longer works — the student changed it on the
        // Hub since connecting. Drop it so they're asked to reconnect instead
        // of this failing the same way silently forever.
        await ref.delete();
        return res.status(200).json({ ok: true, linked: false, error: "credentials_stale" });
      }
      console.error(`[hub-attendance] refresh failed for ${account.rollNumber}:`, error?.message ?? error);
      return res.status(502).json({
        ok: false,
        error: "hub_failed",
        message: "Could not reach the Hub. Try again shortly.",
      });
    }
  }

  const courses = account.courses ?? [];
  const results = await Promise.all(
    courses.map((course) =>
      hubFetchCourseModules({
        studentId: account.hubStudentId,
        rollNumber: account.rollNumber,
        batchId: course.batchId,
        technologyId: course.technologyId,
      })
        .then((rows) => aggregateHubCourse(rows))
        .catch((error) => {
          console.error(
            `[hub-attendance] course fetch failed for ${account.rollNumber}/${course.batchId}:`,
            error?.message ?? error,
          );
          return null;
        }),
    ),
  );

  const hubCourses = results.filter(Boolean);
  const totalSessions = hubCourses.reduce((sum, c) => sum + c.totalSessions, 0);
  const attendedSessions = hubCourses.reduce((sum, c) => sum + c.attendedSessions, 0);

  return res.status(200).json({
    ok: true,
    linked: true,
    snapshot: {
      studentName: account.hubName ?? null,
      rollNumber: account.rollNumber,
      courses: hubCourses,
      totalSessions,
      attendedSessions,
      percentage: totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 10000) / 100 : null,
      fetchedAt: new Date().toISOString(),
    },
  });
}

function safeParse(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
