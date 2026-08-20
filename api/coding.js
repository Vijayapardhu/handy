// Vercel serverless function: POST /api/coding
//
// Body:    { idToken, action, ... }
// Actions: profile | link | settings | contests | daily | leaderboard
//
// One endpoint rather than six files, because Vercel counts functions and a
// practice tracker is not worth half the project's budget. Every action is a
// short read; the only slow one (`profile` with forceRefresh) is the five-site
// fan-out in _codingPlatforms.js.
//
// Authorised like /api/hub-connect: the student's own Firebase ID token. The
// documents this writes decide leaderboard position, so `totalSolved`,
// `peerKey` and the stats snapshot are written *here* with the Admin SDK and
// nowhere else — a client that could set its own solved count would be a
// client that could win. Firestore rules give the client read-only access to
// its own profile document (see firestore.rules).
//
// No password is ever involved. Every platform is read from its public
// profile using a handle the student typed, which is why this can live behind
// a plain ID token and does not need the encrypted-credential machinery
// api/_hubPortal.js has.
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import {
  PLATFORM_IDS,
  fetchAllPlatforms,
  fetchContests,
  fetchDailyProblem,
} from "./_codingPlatforms.js";
import { withinRateLimit } from "./sync.js";

/**
 * How long a stats snapshot is served before a load pays for the five-site
 * fan-out again. Practice counts move a few times a day at most, and the
 * explicit Refresh button bypasses this anyway.
 */
const STATS_TTL_MS = 30 * 60_000;

/** Shared across every student, so these are cached hard. */
const CONTESTS_TTL_MS = 6 * 60 * 60_000;
const DAILY_TTL_MS = 60 * 60_000;

/** How many classmates a leaderboard shows. Beyond this nobody is reading. */
const LEADERBOARD_LIMIT = 25;

/** Every platform's handle rules are looser than this; nothing legitimate is excluded. */
const HANDLE_PATTERN = /^[A-Za-z0-9_.@-]{1,40}$/;

function app() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  return initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
}

function safeParse(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

/**
 * Who counts as "my class" on the leaderboard.
 *
 * Built from the student document rather than anything the client sends: the
 * portal decides which section a student is in, and a peer group a student
 * could type is a peer group a student could pick to top.
 */
function peerKeyFor(student) {
  const parts = [student?.collegeId, student?.department, student?.year, student?.section];
  if (parts.some((part) => part === undefined || part === null || part === "")) return null;
  return parts.map((part) => String(part).trim().toUpperCase()).join("|");
}

function emptyProfile(uid) {
  return {
    id: uid,
    studentId: uid,
    handles: {},
    stats: [],
    recent: [],
    totalSolved: 0,
    weeklyTarget: 0,
    shareToLeaderboard: true,
    peerKey: null,
    refreshedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

/** Strips the handles that came back blank — an empty string is "unlinked", not a handle. */
function cleanHandles(raw) {
  const handles = {};
  for (const platform of PLATFORM_IDS) {
    const value = String(raw?.[platform] ?? "").trim();
    if (!value) continue;
    if (!HANDLE_PATTERN.test(value)) throw new Error(`invalid_handle_${platform}`);
    handles[platform] = value;
  }
  return handles;
}

/**
 * Re-reads every linked platform and writes the snapshot back.
 *
 * `peerKey` is refreshed on the same write: a student who changes section
 * mid-year should move to the new class's board without anyone touching the
 * document by hand.
 */
async function refreshProfile(db, uid, profile) {
  const { stats, recent, totalSolved } = await fetchAllPlatforms(profile.handles);
  const studentSnap = await db.doc(`students/${uid}`).get();

  const updated = {
    ...profile,
    stats,
    recent,
    totalSolved,
    peerKey: studentSnap.exists ? peerKeyFor(studentSnap.data()) : profile.peerKey,
    refreshedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.doc(`codingProfiles/${uid}`).set(updated, { merge: true });
  return updated;
}

/** A shared, TTL'd Firestore cache for the two feeds that are the same for everyone. */
async function cached(db, key, ttlMs, produce) {
  const ref = db.doc(`codingCache/${key}`);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : null;
  if (data && Date.now() - (data.fetchedAt ?? 0) < ttlMs) {
    return { value: data.value ?? null, cached: true };
  }

  const value = await produce();
  // A failed fetch keeps serving the stale copy rather than replacing good
  // data with null — an upcoming contest list from this morning still beats
  // an empty one.
  if (value === null && data) return { value: data.value ?? null, cached: true, stale: true };

  await ref.set({ value, fetchedAt: Date.now() });
  return { value, cached: false };
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

  const uid = caller.uid;
  const action = String(payload?.action ?? "profile");

  try {
    switch (action) {
      case "profile":
        return res.status(200).json(await handleProfile(db, uid, Boolean(payload?.forceRefresh)));
      case "link":
        return res.status(200).json(await handleLink(db, uid, payload?.handles));
      case "settings":
        return res.status(200).json(await handleSettings(db, uid, payload));
      case "contests": {
        const result = await cached(db, "contests", CONTESTS_TTL_MS, () => fetchContests());
        return res.status(200).json({ ok: true, contests: result.value ?? [], cached: result.cached });
      }
      case "daily": {
        const result = await cached(db, "daily", DAILY_TTL_MS, () => fetchDailyProblem());
        return res.status(200).json({ ok: true, daily: result.value ?? null, cached: result.cached });
      }
      case "leaderboard":
        return res.status(200).json(await handleLeaderboard(db, uid));
      default:
        return res.status(400).json({ ok: false, error: "unknown_action" });
    }
  } catch (error) {
    const message = error?.message ?? "unknown";
    if (message.startsWith("invalid_handle_")) {
      return res.status(400).json({ ok: false, error: message });
    }
    console.error(`[coding] ${action} failed for ${uid}:`, message);
    return res.status(500).json({ ok: false, error: "coding_failed" });
  }
}

async function readProfile(db, uid) {
  const snap = await db.doc(`codingProfiles/${uid}`).get();
  return snap.exists ? { ...emptyProfile(uid), ...snap.data() } : null;
}

async function handleProfile(db, uid, forceRefresh) {
  const profile = await readProfile(db, uid);
  // Nothing linked yet: an empty profile, not an error — the client renders
  // the connect card off `linked: false`, the same beat as hub-attendance.js.
  if (!profile || Object.keys(profile.handles ?? {}).length === 0) {
    return { ok: true, linked: false, profile: profile ?? emptyProfile(uid) };
  }

  const fresh = profile.refreshedAt && Date.now() - Date.parse(profile.refreshedAt) < STATS_TTL_MS;
  if (fresh && !forceRefresh) {
    return { ok: true, linked: true, profile, cached: true };
  }

  // Only the paths that actually leave for five other sites are rate limited.
  if (!(await withinRateLimit(db, `coding_${uid}`))) {
    return { ok: true, linked: true, profile, cached: true, rateLimited: true };
  }

  return { ok: true, linked: true, profile: await refreshProfile(db, uid, profile) };
}

async function handleLink(db, uid, rawHandles) {
  const handles = cleanHandles(rawHandles);
  const existing = (await readProfile(db, uid)) ?? emptyProfile(uid);
  const profile = { ...existing, handles, updatedAt: new Date().toISOString() };

  if (Object.keys(handles).length === 0) {
    // Unlinking everything clears the snapshot too, so a stale solved count
    // cannot linger on a leaderboard for an account that has left.
    const cleared = { ...profile, stats: [], recent: [], totalSolved: 0, refreshedAt: null };
    await db.doc(`codingProfiles/${uid}`).set(cleared, { merge: true });
    return { ok: true, linked: false, profile: cleared };
  }

  await db.doc(`codingProfiles/${uid}`).set(profile, { merge: true });
  return { ok: true, linked: true, profile: await refreshProfile(db, uid, profile) };
}

async function handleSettings(db, uid, payload) {
  const existing = (await readProfile(db, uid)) ?? emptyProfile(uid);
  const updates = { updatedAt: new Date().toISOString() };

  if (payload?.weeklyTarget !== undefined) {
    const target = Number(payload.weeklyTarget);
    // A target nobody could hit is a target nobody sets on purpose.
    updates.weeklyTarget = Number.isFinite(target) ? Math.min(200, Math.max(0, Math.round(target))) : 0;
  }
  if (payload?.shareToLeaderboard !== undefined) {
    updates.shareToLeaderboard = Boolean(payload.shareToLeaderboard);
  }

  await db.doc(`codingProfiles/${uid}`).set({ ...existing, ...updates }, { merge: true });
  return { ok: true, profile: { ...existing, ...updates } };
}

/**
 * The class board.
 *
 * Read server-side and returned already trimmed to name, roll number and
 * total — a classmate's handles, streaks and solve log are none of the
 * reader's business, and shipping the whole document would hand them over.
 * Opting out (`shareToLeaderboard: false`) removes the row entirely rather
 * than hiding it in the client.
 */
async function handleLeaderboard(db, uid) {
  const profile = await readProfile(db, uid);
  if (!profile?.peerKey) return { ok: true, entries: [], peerKey: null };

  const snapshot = await db
    .collection("codingProfiles")
    .where("peerKey", "==", profile.peerKey)
    .where("shareToLeaderboard", "==", true)
    .orderBy("totalSolved", "desc")
    .limit(LEADERBOARD_LIMIT)
    .get();

  const students = await Promise.all(
    snapshot.docs.map((doc) => db.doc(`students/${doc.id}`).get()),
  );

  const entries = snapshot.docs.map((doc, index) => {
    const student = students[index].exists ? students[index].data() : null;
    return {
      rollNumber: student?.rollNumber ?? "—",
      name: student?.name ?? "Classmate",
      totalSolved: doc.data().totalSolved ?? 0,
      isMe: doc.id === uid,
    };
  });

  return { ok: true, entries, peerKey: profile.peerKey, sharing: profile.shareToLeaderboard !== false };
}
