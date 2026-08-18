// Vercel serverless function: POST /api/verify
//
// Body:    { rollNumber, password, campus, turnstileToken? }
// Returns: { ok, uid, token, name, cgpa, grades, attendance, ... }
//
// Signing in for AEC and ACET students, whose portal has no captcha and can be
// read server-side. The portal login *is* the check: if Campus Connect accepts
// the credentials and returns data, the student is who they say they are, and a
// Handy account is created for them on the spot.
//
// AUS is not handled here. Its portal enforces a domain-locked Cloudflare
// Turnstile server-side, so a server can never sign in on a student's behalf —
// those students use the browser extension, which reads pages they have already
// opened and never sees a password. `turnstileToken` is still accepted so the
// contract does not change if the college ever allows our domain.
//
// The password exists only as a local const for the length of this request. It
// is never written to Firestore, never logged, and never included in an alert.
//
// The scraped data goes through ingestSnapshot — the same pipeline the
// extension's /api/sync uses — so an AEC/ACET student gets subjects, attendance
// history, widgets and push exactly as an AUS student does, from one code path.
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { CAMPUSES, InvalidCredentialsError, scrapeCampus } from "./_campusPortal.js";
import { toSnapshot } from "./_portalSnapshot.js";
import { ensureAuthUser, ingestSnapshot, withinRateLimit } from "./sync.js";

/** Origins allowed to call this. A password crosses it, so it is not "*". */
const ALLOWED_ORIGINS = [
  "https://handy.vijayaapardhu.dev",
  "https://handy-aus.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function app() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  return initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
}

/**
 * Whether a campus has been switched off, e.g. because the portal changed and
 * the scraper is returning nonsense.
 *
 * Fails **open**: if the config document cannot be read, students keep working.
 * A lock is a maintenance convenience, and a database blip should not become an
 * outage for everyone.
 */
async function isCampusLocked(db, campus) {
  try {
    const doc = await db.doc(`appConfig/campus_${campus}`).get();
    return doc.exists && doc.get("locked") === true;
  } catch (error) {
    console.error("[verify] campus lock check failed, allowing:", error.message);
    return false;
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const payload = typeof req.body === "string" ? safeParse(req.body) : req.body;
  const rollNumber = String(payload?.rollNumber ?? "").trim().toUpperCase();
  const password = String(payload?.password ?? "");
  const campus = String(payload?.campus ?? "").trim().toUpperCase();

  if (!rollNumber || !password) {
    return res.status(400).json({ ok: false, error: "missing_credentials" });
  }

  if (campus === "AUS") {
    // Not a failure to fix — a different route. Said plainly so the app can
    // show the student the extension rather than a retry button.
    return res.status(409).json({
      ok: false,
      error: "use_extension",
      message:
        "Aditya University accounts sync through the Handy browser extension on a laptop, " +
        "which never needs your college password.",
    });
  }

  if (!CAMPUSES[campus]) {
    return res.status(400).json({ ok: false, error: "unsupported_campus" });
  }

  try {
    app();
    const db = getFirestore();

    if (await isCampusLocked(db, campus)) {
      return res.status(403).json({ ok: false, error: "campus_locked", isLocked: true });
    }

    // Shared with /api/sync, so a student cannot dodge the ceiling by using
    // whichever entry point happens to be untouched.
    if (!(await withinRateLimit(db, rollNumber))) {
      return res.status(429).json({ ok: false, error: "rate_limited" });
    }

    const data = await scrapeCampus({ campus, rollNumber, password });

    // Signing in worked but nothing came back. Treated as a failure rather than
    // written: an empty snapshot would overwrite a good earlier sync with
    // zeroes, which looks to the student like their attendance was wiped.
    if (data.subjects.length === 0 && data.grades.length === 0) {
      return res.status(502).json({
        ok: false,
        error: "portal_returned_nothing",
        message: "Signed in, but the portal returned no attendance or marks. Try again shortly.",
      });
    }

    const snapshot = toSnapshot({ campus, rollNumber, data });
    const uid = await ensureAuthUser(rollNumber);
    const written = await ingestSnapshot(db, uid, rollNumber, snapshot);

    // Semester grades and CGPA — scraped right alongside attendance, but until
    // now discarded the moment this response was sent. AEC/ACET/AGBS expose no
    // ongoing grades endpoint the way attendance has one, so a sign-in (or a
    // student re-entering their password from the Grades page to refresh) is
    // the only moment this data is ever available at all; not persisting it
    // here would mean it never existed anywhere past this one response.
    if (data.grades.length > 0) {
      try {
        await db.doc(`academicRecords/${uid}`).set({
          studentId: uid,
          campus,
          cgpa: data.cgpa,
          grades: data.grades,
          capturedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        // Best-effort: a write failure here shouldn't fail a sign-in that
        // otherwise worked, it just means the Grades page stays on whatever
        // it last had (or empty, the first time).
        console.error(`[verify] academicRecords write failed for ${rollNumber}:`, error.message);
      }
    }

    // A custom token rather than the Handy password. The client exchanges it
    // for a session with signInWithCustomToken, so no password for the account
    // we just created ever has to travel back over the wire or be typed.
    const token = await getAuth().createCustomToken(uid);

    return res.status(200).json({
      ok: true,
      uid,
      token,
      ...written,
      // The §3 shape, so this is still a drop-in for the reference API.
      name: data.name,
      cgpa: data.cgpa,
      academicStats: data.academicStats,
      grades: data.grades,
      attendance: data.attendance,
      overall: data.overall,
      subjects: data.subjects,
      schedule: data.schedule,
      exams: data.exams,
      features: data.features,
    });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return res.status(401).json({ ok: false, error: "invalid_credentials", message: error.message });
    }

    // Roll number only. The password is not passed to this path at all — see
    // the note in _campusPortal.js about the parameter that should not exist.
    console.error(`[verify] ${campus} failed for ${rollNumber}:`, error?.message ?? error);
    await alert(campus, rollNumber, error?.message ?? String(error));

    return res.status(500).json({
      ok: false,
      error: "portal_failed",
      message: error?.message ?? "The college portal could not be reached.",
    });
  }
}

/** Best-effort shout when a scrape breaks, so a portal change is noticed the same day. */
async function alert(campus, rollNumber, message) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: `Handy scraper error: ${campus}`,
            description: `**Error:** ${message}\n**Roll:** ${rollNumber}`,
            color: 0xdc2626,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (error) {
    console.error("[verify] alert failed:", error.message);
  }
}

function safeParse(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
