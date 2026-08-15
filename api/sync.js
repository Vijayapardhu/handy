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
import { syncGroupMemberships } from "./_classGroups.js";
import { publishSharedTimetable } from "./_sharedTimetable.js";
import {
  buildDailyAttendanceDocs,
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
    const result = await ingestSnapshot(db, uid, rollNumber, snapshot);

    return res.status(200).json({ ok: true, uid, ...result });
  } catch (error) {
    console.error("[sync] failed for", rollNumber, error);
    return res.status(500).json({ ok: false, error: String(error?.message ?? error) });
  }
}

/**
 * Everything that happens to a snapshot once we know whose it is.
 *
 * Exported because the extension is no longer the only way a snapshot arrives:
 * /api/verify scrapes AEC and ACET server-side and produces the same shape.
 * Sharing this rather than writing a second pipeline is what makes those
 * campuses get subjects, attendance history, class groups, widgets and push
 * for free — and it means a fix here reaches both, instead of one path quietly
 * drifting behind the other.
 *
 * Everything after the write is best-effort: no messaging failure can cost a
 * student their sync.
 */
export async function ingestSnapshot(db, uid, rollNumber, snapshot) {
  const written = await writeSnapshot(db, uid, rollNumber, snapshot);

  let shared = null;
  if (snapshot.timetable) {
    // Which rooms this student sits in, so a class rep's announcement can
    // find them. Derived from the portal's own timetable rather than stored
    // against the student: a membership list a student can edit is a
    // membership list a student can join.
    await syncGroupMemberships(db, uid, snapshot.timetable).catch((error) =>
      console.error("[ingest] group membership failed for", rollNumber, error),
    );

    shared = await publishSharedTimetable(db, {
      timetable: snapshot.timetable,
      section: snapshot.timetable.name,
      syncedBy: uid,
    }).catch((error) => {
      console.error("[ingest] shared timetable failed for", rollNumber, error);
      return null;
    });
  }

  await notifyDevices(db, uid, { ...written, shared }).catch((error) =>
    console.error("[ingest] push failed for", rollNumber, error),
  );

  await pruneNotifications(db, uid).catch((error) =>
    console.error("[ingest] prune failed for", rollNumber, error),
  );

  return { ...written, shared };
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

  // No early return on an empty token list. The inbox record is worth writing
  // whether or not a device is registered to receive it — a student who signs
  // in on a phone later should still find what happened while they had none.

  // A student who has turned "new data" off still gets their widgets
  // refreshed — that is a silent data message, not an interruption. Only the
  // visible half is suppressed.
  const wanted = student.data()?.notifyNewData != false;

  const subjects = written?.subjectCount ?? 0;
  const messages = [];

  // Only when the figures actually moved. A single visit to the portal syncs
  // several times over half a minute and every one of them carries the same
  // attendance; announcing each was three identical alerts for no news.
  if (wanted && subjects > 0 && written?.attendanceChanged) {
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
  if (wanted && written?.shared?.changed) {
    messages.push({
      channel: "handy_timetable",
      type: "timetable",
      title: "Your timetable changed",
      body: `Version ${written.shared.version}. ${written.shared.changes.length} slot${
        written.shared.changes.length === 1 ? "" : "s"
      } moved.`,
      tag: `timetable-${written.shared.version}`,
      timetableId: written.shared.timetableId,
      version: written.shared.version,
    });
  }

  if (messages.length === 0) {
    // Nothing worth interrupting for, but the widgets still need the new
    // figures — so a silent data-only message goes out instead.
    messages.push({ channel: null, type: "sync", title: null, body: null, tag: null });
  }

  let result;
  for (const message of messages) {
    // Recorded before it is sent, and regardless of whether it is sent at all.
    // A push is gone the moment it is swiped away, and a student who clears
    // their shade on the bus has no way back to what it said — so the inbox
    // holds the copy that lasts. Silent data messages have no title and are
    // not news, so they are not recorded.
    if (message.title) {
      await db.collection("notifications").add({
        userId: uid,
        type: message.type,
        title: message.title,
        body: message.body,
        actionUrl: null,
        // Carried as fields rather than left to be parsed back out of the
        // body: the inbox needs to open the right timetable version, and
        // recovering an id by regexing a sentence is a bug waiting for the
        // first reworded sentence.
        timetableId: message.timetableId ?? null,
        version: message.version ?? null,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    if (tokens.length === 0) continue;

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
  // again; keeping them means every future send reports failures. Nothing was
  // sent when there are no tokens, so there is no result to read.
  if (!result) return;

  const dead = tokens.filter((_, i) => {
    const code = result.responses[i]?.error?.code;
    return code === "messaging/registration-token-not-registered"
      || code === "messaging/invalid-registration-token";
  });
  if (dead.length > 0) {
    await db.doc(`students/${uid}`).update({ fcmTokens: FieldValue.arrayRemove(...dead) });
  }
}

/**
 * Drops notifications this student has already read and stopped caring about.
 *
 * Nothing else deleted from this collection, so it grew for the life of the
 * account — a student syncing daily for three years accumulates a thousand
 * "Attendance updated" records they read once. Done on sync because that is
 * the only moment the server is already touching this student, and it costs
 * one query.
 *
 * Only *read* ones, and only past the cutoff: an unread notification is still
 * doing its job however old it is, and deleting it would lose the one thing
 * the inbox exists to keep.
 */
const NOTIFICATION_TTL_DAYS = 45;

async function pruneNotifications(db, uid) {
  const cutoff = new Date(Date.now() - NOTIFICATION_TTL_DAYS * 24 * 60 * 60 * 1000)
    .toISOString();

  const stale = await db
    .collection("notifications")
    .where("userId", "==", uid)
    .where("read", "==", true)
    .where("createdAt", "<", cutoff)
    // Bounded, so one sync can never turn into a thousand deletes; the next
    // sync takes the next batch.
    .limit(100)
    .get();

  if (stale.empty) return;
  const batch = db.batch();
  stale.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
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
export async function withinRateLimit(db, rollNumber) {
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
export async function ensureAuthUser(rollNumber) {
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

  // Did the numbers actually move?
  //
  // One visit to the portal produces several syncs — the profile capture, a
  // retry, and again when the timetable lands and the merged snapshot is
  // resent — and every one of them carries the same attendance. Notifying on
  // each meant three identical "Attendance updated" alerts in half a minute
  // for a figure that had not changed once. "Attendance updated" has to mean
  // the attendance updated.
  const attendanceChanged = await hasAttendanceMoved(db, uid, summaries);

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

  // Per-day records, where the portal reports days rather than only totals.
  // Merged rather than replaced: each sync brings today and yesterday, and
  // overwriting the collection would throw away every day before those.
  const daily = buildDailyAttendanceDocs(uid, snapshot, now);
  for (const record of daily) {
    batch.set(db.collection("attendance").doc(record.id), record, { merge: true });
  }

  await batch.commit();
  return { subjectCount: subjects.length, slotCount, dailyCount: daily.length, attendanceChanged };
}

/**
 * Whether any subject's attended/held differs from what is already stored.
 *
 * Compared per subject rather than on the totals: a student who attends one
 * class and misses another leaves the total unmoved while two subjects have
 * genuinely changed, and they would want telling.
 *
 * A first sync counts as changed — there is nothing to compare against, and
 * the arrival of a student's figures is exactly the moment worth announcing.
 */
async function hasAttendanceMoved(db, uid, summaries) {
  const existing = await db
    .collection("attendanceSummaries")
    .where("studentId", "==", uid)
    .get();

  if (existing.empty) return true;

  const before = new Map(existing.docs.map((d) => [d.id, d.data()]));
  if (before.size !== summaries.length) return true;

  return summaries.some((summary) => {
    const previous = before.get(summary.id);
    return (
      !previous ||
      previous.attended !== summary.doc.attended ||
      previous.held !== summary.doc.held
    );
  });
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
