// Vercel serverless function: POST /api/sync
//
// Receives a capture from the "Handy College Sync" browser extension and
// writes it with the Firebase Admin SDK.
//
// Why this exists: writing from the extension directly meant the extension had
// to authenticate *as the student*, which meant knowing their password —
// which is why every account had to share one, and why a student who changed
// theirs could no longer be synced from a laptop they'd never signed into.
// Doing the write here removes student credentials from the sync path
// entirely: any copy of the extension, on any machine, can keep any student's
// data current just by seeing their portal page.
//
// The service-account key lives only in this function's environment. It must
// never ship inside the extension — it grants full, rule-bypassing access to
// the whole project, and an extension is just files on every user's disk.
//
// Env vars:
//   FIREBASE_SERVICE_ACCOUNT  the service-account JSON, as a single string
//                             (falls back to Application Default Credentials)
//   HANDY_SYNC_API_KEY        shared secret the extension sends as x-handy-key
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { publishSharedTimetable } from "./_sharedTimetable.js";
import {
  buildImportDocs,
  buildStudentStub,
  buildTimetableDocs,
  selfImportSemesterId,
  selfTimetableVersionId,
} from "../extension/src/snapshotMapping.js";

/** Must match ACCOUNT_PASSWORD in src/services/firebase/auth.ts. */
const ACCOUNT_PASSWORD = "Handy@123";
const AUTH_EMAIL_DOMAIN = process.env.VITE_AUTH_EMAIL_DOMAIN || "handy.local";

// Generous enough that no real student notices (a capture syncs twice — once
// for attendance, once when the timetable lands), tight enough that a loop
// or a script can't hammer one account.
const RATE_LIMIT_MAX = 40;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function app() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  return initializeApp({
    credential: raw ? cert(JSON.parse(raw)) : applicationDefault(),
  });
}

export default async function handler(req, res) {
  // The extension calls this from its service worker; host_permissions covers
  // the request itself, but the preflight for x-handy-key still needs answering.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-handy-key");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const expectedKey = process.env.HANDY_SYNC_API_KEY;
  if (!expectedKey) {
    console.error("[sync] HANDY_SYNC_API_KEY is not set — refusing every request");
    return res.status(500).json({ ok: false, error: "server_not_configured" });
  }
  if (req.headers["x-handy-key"] !== expectedKey) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const snapshot = typeof req.body === "string" ? safeParse(req.body) : req.body;
  const rollNumber = snapshot?.rollNumber;
  if (!rollNumber || !Array.isArray(snapshot?.attendance?.subjects)) {
    return res.status(400).json({ ok: false, error: "invalid_snapshot" });
  }

  try {
    app();
    const db = getFirestore();

    if (!(await withinRateLimit(db, rollNumber))) {
      return res.status(429).json({ ok: false, error: "rate_limited" });
    }

    const uid = await ensureAuthUser(rollNumber);
    const written = await writeSnapshot(db, uid, rollNumber, snapshot);

    // Everything past this point is best-effort and happens after the write,
    // so no messaging failure can cost a student their sync.
    let shared = null;
    if (snapshot.timetable) {
      shared = await publishSharedTimetable(db, {
        timetable: snapshot.timetable,
        section: snapshot.timetable.name,
        syncedBy: uid,
      }).catch((error) => {
        console.error("[sync] shared timetable failed for", rollNumber, error);
        return null;
      });
    }

    await notifyDevices(db, uid, { ...written, shared }).catch((error) =>
      console.error("[sync] push failed for", rollNumber, error),
    );

    return res.status(200).json({ ok: true, uid, ...written, shared });
  } catch (error) {
    console.error("[sync] failed for", rollNumber, error);
    return res.status(500).json({ ok: false, error: String(error?.message ?? error) });
  }
}

/**
 * Pushes to the student's own devices after a successful sync.
 *
 * Attendance and the timetable get *separate* notifications on separate
 * channels. They are different things that change at different times for
 * different reasons: attendance moves every week and is worth glancing at,
 * a timetable moves rarely and means rearranging your day. One combined
 * "something changed" made both easy to ignore, and gave a student no way to
 * silence the noisy one while keeping the important one.
 *
 * Every message carries a data payload the phone acts on: its background
 * handler refreshes the home-screen widgets without the app being opened,
 * which is the only way a widget can be current for someone who syncs on a
 * laptop and never launches Handy. `priority: high` is what gets that
 * delivered to a dozing device rather than held until it next wakes.
 */
async function notifyDevices(db, uid, written) {
  const student = await db.doc(`students/${uid}`).get();
  const tokens = student.data()?.fcmTokens ?? [];
  if (tokens.length === 0) return;

  const subjects = written?.subjectCount ?? 0;
  const messages = [];

  if (subjects > 0) {
    messages.push({
      channel: "handy_attendance",
      type: "attendance",
      title: "Attendance updated",
      body: `Across ${subjects} subject${subjects === 1 ? "" : "s"}.`,
      // Replaces the previous attendance notification rather than stacking a
      // fresh one on every sync.
      tag: "attendance",
    });
  }

  // Only for the student who synced, and only when it actually moved —
  // everyone else on this timetable is told by publishSharedTimetable.
  if (written?.shared?.changed) {
    messages.push({
      channel: "handy_timetable",
      type: "timetable",
      title: "Your timetable changed",
      body: `Version ${written.shared.version}. ${written.shared.changes.length} slot${
        written.shared.changes.length === 1 ? "" : "s"
      } moved.`,
      tag: `timetable-${written.shared.version}`,
    });
  }

  if (messages.length === 0) {
    // Nothing worth interrupting for, but the widgets still need the new
    // figures — so a silent data-only message goes out instead.
    messages.push({ channel: null, type: "sync", title: null, body: null, tag: null });
  }

  let result;
  for (const message of messages) {
    result = await getMessaging().sendEachForMulticast({
      tokens,
      ...(message.title
        ? { notification: { title: message.title, body: message.body } }
        : {}),
      data: { type: message.type, subjects: String(subjects) },
      android: {
        priority: "high",
        ...(message.channel
          ? {
              notification: {
                channelId: message.channel,
                icon: "ic_notification",
                color: "#F97316",
                tag: message.tag,
              },
            }
          : {}),
      },
      apns: { payload: { aps: { "content-available": 1 } } },
    });
  }

  // Uninstalled apps and restored devices leave tokens that will never deliver
  // again; keeping them means every future send reports failures.
  const dead = tokens.filter((_, i) => {
    const code = result.responses[i]?.error?.code;
    return code === "messaging/registration-token-not-registered"
      || code === "messaging/invalid-registration-token";
  });
  if (dead.length > 0) {
    await db.doc(`students/${uid}`).update({ fcmTokens: FieldValue.arrayRemove(...dead) });
  }
}

function safeParse(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

/**
 * Fixed-window counter per roll number, kept in Firestore so it survives the
 * function going cold — an in-memory limiter would reset on every new
 * instance and protect nothing.
 */
async function withinRateLimit(db, rollNumber) {
  const ref = db.doc(`syncRateLimits/${rollNumber}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists ? snap.data() : null;
    const fresh = !data || now - data.windowStart > RATE_LIMIT_WINDOW_MS;
    const count = fresh ? 1 : data.count + 1;

    if (!fresh && count > RATE_LIMIT_MAX) return false;
    tx.set(ref, { windowStart: fresh ? now : data.windowStart, count });
    return true;
  });
}

/** Creates the student's Firebase Auth account the first time their roll number is seen. */
async function ensureAuthUser(rollNumber) {
  const auth = getAuth();
  const email = `${rollNumber.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
  try {
    const user = await auth.getUserByEmail(email);
    return user.uid;
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    const user = await auth.createUser({ email, password: ACCOUNT_PASSWORD });
    return user.uid;
  }
}

/**
 * Same documents the web app's importCollegePortalSnapshot() writes — this
 * shares the mapping module with the extension rather than restating it, and
 * collegePortalImportService.test.ts asserts that module agrees with the
 * TypeScript one.
 */
async function writeSnapshot(db, uid, rollNumber, snapshot) {
  const now = new Date().toISOString();
  const semesterId = selfImportSemesterId(uid);
  const batch = db.batch();

  const studentRef = db.doc(`students/${uid}`);
  const existingStudent = await studentRef.get();
  if (!existingStudent.exists) {
    batch.set(
      studentRef,
      buildStudentStub(uid, rollNumber, `${rollNumber.toLowerCase()}@${AUTH_EMAIL_DOMAIN}`, now),
    );
  }

  const { studentUpdate, subjects, summaries } = buildImportDocs(uid, snapshot, now);
  batch.set(studentRef, studentUpdate, { merge: true });

  for (const subject of subjects) batch.set(db.doc(`subjects/${subject.id}`), subject.doc);
  for (const summary of summaries) {
    batch.set(db.doc(`attendanceSummaries/${summary.id}`), summary.doc);
  }

  // Subjects a previous sync left behind: the portal's list changes each
  // semester and nothing else would ever retire the old rows.
  const importedIds = new Set(subjects.map((s) => s.id));
  const previousSubjects = await db.collection("subjects").where("semesterId", "==", semesterId).get();
  for (const doc of previousSubjects.docs) {
    if (doc.get("active") === true && !importedIds.has(doc.id)) {
      batch.update(doc.ref, { active: false, updatedAt: now });
    }
  }

  let slotCount = 0;
  if (snapshot.timetable) {
    slotCount = await appendTimetable(db, batch, uid, snapshot, semesterId, now);
  }

  await batch.commit();
  return { subjectCount: subjects.length, slotCount };
}

async function appendTimetable(db, batch, uid, snapshot, semesterId, now) {
  const versionId = selfTimetableVersionId(uid, snapshot.timetable.ttNo);
  const existingVersions = await db
    .collection("timetableVersions")
    .where("semesterId", "==", semesterId)
    .get();
  const existing = existingVersions.docs.find((d) => d.id === versionId);

  const { version, entries } = buildTimetableDocs(uid, snapshot.timetable, {
    department: snapshot.branch ?? "",
    // Keep the date this version was first seen; moving it forward on every
    // sync would hide the timetable from every earlier date.
    effectiveFrom: existing?.get("effectiveFrom") ?? now.slice(0, 10),
    now,
  });

  batch.set(db.doc(`timetableVersions/${version.id}`), version.doc);
  for (const entry of entries) batch.set(db.doc(`timetableEntries/${entry.id}`), entry.doc);

  // A different ttNo means a new semester or section; the old version has to
  // stop being "published" or getActiveTimetableVersion() could still pick it.
  for (const doc of existingVersions.docs) {
    if (doc.id !== version.id && doc.get("status") === "published") {
      batch.update(doc.ref, { status: "archived", effectiveUntil: now.slice(0, 10) });
    }
  }

  return entries.length;
}
