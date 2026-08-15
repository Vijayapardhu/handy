// Vercel serverless function: POST /api/class-roster
//
// Body: { idToken, groupKey }
// Returns: { ok, groupKey, count, students: [{ rollNumber, name, section, ... }] }
//
// The roll of one class, for its rep.
//
// This has to be a server endpoint rather than a client query. firestore.rules
// lets a student read their own `classGroupMembers` row and nobody else's —
// deliberately, since a student who could list a group could enumerate a class.
// A rep legitimately needs the whole room, and the only way to grant that
// without widening the rule for everyone is to check the grant here.
//
// Personal detail is deliberately limited to what a roster is: who is in the
// room. Not mobile numbers, not attendance. A class rep is a student with a
// job, not an administrator, and "the export happened to include it" is how
// data gets somewhere nobody agreed to.
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { isClassRep, membersOf } from "./_classGroups.js";

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
    if (!groupKey) return res.status(400).json({ ok: false, error: "missing_group" });

    // Same answer whether the group exists or not, so a student cannot probe
    // for group keys. Mirrors /api/announce and /api/notes.
    if (!(await isClassRep(db, caller.uid, groupKey))) {
      return res.status(403).json({ ok: false, error: "not_a_class_rep" });
    }

    // The rep is in their own class, so no `except` here — a roster missing
    // the person who printed it is a roster somebody has to correct by hand.
    const uids = await membersOf(db, groupKey);
    const docs = await Promise.all(uids.map((uid) => db.doc(`students/${uid}`).get()));

    const students = docs
      .filter((doc) => doc.exists)
      .map((doc) => ({
        rollNumber: doc.get("rollNumber") ?? "",
        name: doc.get("name") ?? "",
        section: doc.get("section") ?? "",
        department: doc.get("department") ?? "",
        year: doc.get("year") ?? "",
      }))
      // Roll number is how a class is listed everywhere else it appears —
      // attendance sheets, exam halls — so it is the order that needs no
      // explanation.
      .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

    return res.status(200).json({
      ok: true,
      groupKey,
      count: students.length,
      students,
    });
  } catch (error) {
    console.error("[class-roster] failed:", error);
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
