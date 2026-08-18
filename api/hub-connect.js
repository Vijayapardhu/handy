// Vercel serverless function: /api/hub-connect
//
//   POST   { idToken, rollNumber, password } → { ok, linked: true }
//   DELETE { idToken }                       → { ok, linked: false }
//
// First-time (and re-)login to Aditya University's Maya Hub platform. On
// success the password is encrypted and stored under hubAccounts/{uid} — a
// collection with no Firestore rule at all (default-deny; see the note in
// firestore.rules), reachable only from here and hub-attendance.js with the
// Admin SDK — so hub-attendance.js can silently refresh the hour-long Maya
// token without asking the student to sign in again every session.
//
// Authorised like /api/notes and /api/announce: the student's own Firebase ID
// token, never a shared key — this is the student's own Hub credential, not
// anything an admin or classmate should be able to set on their behalf.
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { hubSecureLogin, InvalidHubCredentialsError, encryptHubPassword } from "./_hubPortal.js";
import { withinRateLimit } from "./sync.js";

function app() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  return initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

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

  if (req.method === "DELETE") {
    await db.doc(`hubAccounts/${caller.uid}`).delete();
    return res.status(200).json({ ok: true, linked: false });
  }

  const rollNumber = String(payload?.rollNumber ?? "").trim().toUpperCase();
  const password = String(payload?.password ?? "");
  if (!rollNumber || !password) {
    return res.status(400).json({ ok: false, error: "missing_credentials" });
  }

  // Keyed separately from the campus-portal rate limit (a "hub_" prefix on
  // the same syncRateLimits collection) so trying both in one session doesn't
  // share a budget.
  if (!(await withinRateLimit(db, `hub_${rollNumber}`))) {
    return res.status(429).json({ ok: false, error: "rate_limited" });
  }

  try {
    const result = await hubSecureLogin(rollNumber, password);
    const now = new Date().toISOString();

    await db.doc(`hubAccounts/${caller.uid}`).set({
      rollNumber: result.rollNumber,
      hubStudentId: result.studentId,
      hubName: result.name,
      encPassword: encryptHubPassword(password),
      token: result.token,
      tokenExp: result.tokenExp,
      courses: result.courses,
      updatedAt: now,
    });

    return res.status(200).json({ ok: true, linked: true });
  } catch (error) {
    if (error instanceof InvalidHubCredentialsError) {
      return res.status(401).json({ ok: false, error: "invalid_credentials", message: error.message });
    }
    console.error(`[hub-connect] failed for ${rollNumber}:`, error?.message ?? error);
    return res.status(502).json({
      ok: false,
      error: "hub_failed",
      message: error?.message ?? "Could not reach the Hub. Try again shortly.",
    });
  }
}

function safeParse(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
