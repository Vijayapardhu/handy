// Shared timetables: one student's sync tells everyone on that timetable.
//
// The problem this solves is a real one and nothing else in Handy addresses
// it. A timetable belongs to a *section*, not to a person — fifty students sit
// in T6(CA3) — but only the handful who open the portal ever see that it
// changed. Everyone else keeps turning up to a room that moved, because they
// have not synced in a fortnight and have no reason to think they should.
//
// So the first student through the door publishes for the rest. When a sync
// carries a timetable whose content differs from the one on record, this
// stores the new version alongside the old and pushes every other student
// registered against that timetable id. What arrives is not "open the app and
// check" — it names the timetable, the version, and what actually moved.
//
// Versions are kept, not overwritten. A diff needs both sides, and "what
// changed" is the only useful form of this notification.
import { FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { createHash } from "node:crypto";

/** How many past versions to keep per timetable. Enough for a diff and a look back. */
const KEEP_VERSIONS = 6;

/** Push to at most this many devices in one call; Firebase caps a multicast at 500. */
const BATCH = 450;

/**
 * A stable fingerprint of what a timetable *says*, ignoring how it was
 * delivered.
 *
 * Slots are sorted before hashing because the portal does not promise an
 * order, and an unsorted hash would report a change every time it shuffled
 * them — fifty students would get a notification saying nothing moved.
 */
export function timetableFingerprint(timetable) {
  const slots = (timetable?.slots ?? [])
    .map((s) => [
      s.dayOfWeek,
      s.startTime,
      s.endTime,
      s.subjectCode ?? "",
      s.room ?? "",
      s.facultyName ?? "",
    ].join("|"))
    .sort();

  return createHash("sha1").update(slots.join("\n")).digest("hex").slice(0, 16);
}

/** Slots keyed by when they happen, so two versions can be compared position by position. */
function bySlot(timetable) {
  const map = new Map();
  for (const slot of timetable?.slots ?? []) {
    map.set(`${slot.dayOfWeek}@${slot.startTime}`, slot);
  }
  return map;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * What moved between two versions, as plain data the app can render.
 *
 * Deliberately computed here rather than on the phone: the phone only ever
 * holds the version it last synced, so it has nothing to compare against —
 * which is the whole reason a student who has not synced is the one who needs
 * this most.
 */
export function diffTimetables(previous, next) {
  const before = bySlot(previous);
  const after = bySlot(next);
  const changes = [];

  for (const [key, slot] of after) {
    const old = before.get(key);
    const [day, time] = key.split("@");
    const where = `${DAYS[Number(day)] ?? "?"} ${time}`;

    if (!old) {
      changes.push({ kind: "added", where, to: describe(slot) });
      continue;
    }
    if (describe(old) !== describe(slot)) {
      changes.push({ kind: "changed", where, from: describe(old), to: describe(slot) });
    }
  }

  for (const [key, slot] of before) {
    if (after.has(key)) continue;
    const [day, time] = key.split("@");
    changes.push({
      kind: "removed",
      where: `${DAYS[Number(day)] ?? "?"} ${time}`,
      from: describe(slot),
    });
  }

  return changes;
}

function describe(slot) {
  return [slot.subjectCode, slot.room, slot.facultyName].filter(Boolean).join(" · ");
}

/**
 * Records this timetable against its shared id and, if it changed, tells
 * everyone else on it.
 *
 * `syncedBy` is excluded from the push: the student who just synced is looking
 * at the portal and does not need telling. Returns what happened so /api/sync
 * can decide what to say to them instead.
 */
export async function publishSharedTimetable(db, { timetable, section, syncedBy }) {
  const id = String(timetable?.ttNo ?? "").trim();
  if (!id) return { changed: false, reason: "no_timetable_id" };

  const fingerprint = timetableFingerprint(timetable);
  const ref = db.doc(`sharedTimetables/${id}`);
  const snap = await ref.get();
  const current = snap.exists ? snap.data() : null;

  // Register this student either way — a student who syncs an unchanged
  // timetable still wants telling about the next change.
  await ref.set(
    {
      timetableId: id,
      section: section ?? timetable?.name ?? "",
      fingerprint,
      version: current?.fingerprint === fingerprint ? (current?.version ?? 1) : (current?.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      members: FieldValue.arrayUnion(syncedBy),
    },
    { merge: true },
  );

  if (current?.fingerprint === fingerprint) return { changed: false, version: current.version };

  const version = (current?.version ?? 0) + 1;
  const changes = current?.slots ? diffTimetables({ slots: current.slots }, timetable) : [];

  // The full slot list is stored so the *next* change has something to diff
  // against, and as a version document so the app can show an old one.
  await ref.set({ slots: timetable.slots ?? [] }, { merge: true });
  await ref.collection("versions").doc(String(version)).set({
    version,
    fingerprint,
    section: section ?? timetable?.name ?? "",
    slots: timetable.slots ?? [],
    changes,
    publishedBy: syncedBy,
    publishedAt: new Date().toISOString(),
  });

  await pruneVersions(ref, version);

  // First time we have seen this timetable at all: there is no "before", so
  // there is nothing to tell anyone about.
  if (!current) return { changed: false, version, reason: "first_seen" };

  const notified = await notifyMembers(db, {
    members: (current.members ?? []).filter((member) => member !== syncedBy),
    timetableId: id,
    section: section ?? timetable?.name ?? "",
    version,
    changes,
  });

  return { changed: true, timetableId: id, version, changes, notified };
}

async function pruneVersions(ref, latest) {
  const oldest = latest - KEEP_VERSIONS;
  if (oldest < 1) return;
  const stale = await ref.collection("versions").where("version", "<=", oldest).get();
  await Promise.all(stale.docs.map((doc) => doc.ref.delete()));
}

async function notifyMembers(db, { members, timetableId, section, version, changes }) {
  if (members.length === 0) return 0;

  // Tokens are read per student rather than kept on the shared document: a
  // token belongs to a device and a shared list would go stale for everyone
  // at once.
  const docs = await Promise.all(
    members.map((uid) => db.doc(`students/${uid}`).get()),
  );

  const summary = changes.length === 0
    ? "The schedule was republished."
    : changes.length === 1
      ? `${changes[0].where} changed.`
      : `${changes.length} slots changed.`;

  const title = `Timetable updated — ${section || timetableId}`;
  const body = `Version ${version}. ${summary}`;

  // One inbox record each, written for every member whether or not they have
  // a device registered. This is the notification most worth keeping — a
  // student who swipes it away still needs to be able to find out what moved.
  const now = new Date().toISOString();
  await Promise.all(
    members.map((uid) =>
      db.collection("notifications").add({
        userId: uid,
        type: "timetable",
        title,
        body,
        actionUrl: null,
        timetableId,
        version,
        read: false,
        createdAt: now,
      }),
    ),
  );

  const tokens = docs.flatMap((doc) => doc.data()?.fcmTokens ?? []);
  if (tokens.length === 0) return 0;

  let sent = 0;
  for (let i = 0; i < tokens.length; i += BATCH) {
    const result = await getMessaging().sendEachForMulticast({
      tokens: tokens.slice(i, i + BATCH),
      notification: { title, body },
      data: {
        type: "timetable",
        timetableId,
        section: section || "",
        version: String(version),
      },
      android: {
        priority: "high",
        notification: {
          channelId: "handy_timetable",
          icon: "ic_notification",
          color: "#F97316",
          // One notification per timetable version, so two students syncing
          // the same change within a minute do not stack two identical
          // notifications on everyone else's phone.
          tag: `timetable-${timetableId}-${version}`,
        },
      },
    });
    sent += result.successCount;
  }

  return sent;
}
