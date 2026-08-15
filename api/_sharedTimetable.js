// Shared timetables: one student's sync tells the others who share that class.
//
// The problem this solves is a real one and nothing else in Handy addresses
// it. A timetable belongs to a *class*, not to a person — dozens of students
// sit in the same room for the same period — but only the handful who open the
// portal ever see that it moved. Everyone else keeps turning up to the old
// room, because they have not synced in a fortnight and have no reason to
// think they should.
//
// The unit is the slot, not the section, and that distinction is the whole
// design. Two students on timetable T6(CA3) do not necessarily have the same
// timetable: pick a different elective, or the same subject under a different
// lecturer, and one period differs while the rest match. Announcing
// section-wide would tell half of them about a class they do not attend —
// which is worse than silence, because it is confidently wrong.
//
// So each member's own schedule is stored, and when one student's sync changes
// a slot, only the members who had that same slot are told, and each is told
// only about the slots they actually share.
import { FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { createHash } from "node:crypto";

/** Push to at most this many devices in one call; Firebase caps a multicast at 500. */
const BATCH = 450;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** When two students are in the same class: same day, same time, same everything. */
function describe(slot) {
  return [slot.subjectCode, slot.room, slot.facultyName].filter(Boolean).join(" · ");
}

/** Slots keyed by when they happen, so two schedules can be compared position by position. */
function bySlot(timetable) {
  const map = new Map();
  for (const slot of timetable?.slots ?? []) {
    map.set(`${slot.dayOfWeek}@${slot.startTime}`, slot);
  }
  return map;
}

/**
 * A stable fingerprint of what a timetable *says*, ignoring how it was
 * delivered.
 *
 * Slots are sorted before hashing because the portal does not promise an
 * order, and an unsorted hash would report a change every time it shuffled
 * them — everyone would get a notification saying nothing moved.
 */
export function timetableFingerprint(timetable) {
  const slots = (timetable?.slots ?? [])
    .map((s) => `${s.dayOfWeek}@${s.startTime}|${describe(s)}`)
    .sort();

  return createHash("sha1").update(slots.join("\n")).digest("hex").slice(0, 16);
}

/**
 * What moved between two versions of one student's schedule.
 *
 * Each change carries the slot key it happened at, so recipients can be
 * matched against it later — that key is what makes "who else is in this
 * class" answerable.
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
      changes.push({ key, kind: "added", where, to: describe(slot) });
      continue;
    }
    if (describe(old) !== describe(slot)) {
      changes.push({ key, kind: "changed", where, from: describe(old), to: describe(slot) });
    }
  }

  for (const [key, slot] of before) {
    if (after.has(key)) continue;
    const [day, time] = key.split("@");
    changes.push({
      key,
      kind: "removed",
      where: `${DAYS[Number(day)] ?? "?"} ${time}`,
      from: describe(slot),
    });
  }

  return changes;
}

/**
 * Which of [changes] this member was actually in.
 *
 * A member shares a change if their own stored schedule had that slot with the
 * same content that just moved. Matching on content and not only on the time
 * is what keeps the student with a different elective out of it: they have a
 * class at Monday 09:30 too, but not *that* class.
 *
 * An added slot is the exception — nobody had it before, so there is no shared
 * history to match on, and it is announced to everyone whose schedule has
 * nothing at that time.
 */
export function changesFor(memberSlots, changes) {
  const mine = bySlot({ slots: memberSlots ?? [] });

  return changes.filter((change) => {
    const slot = mine.get(change.key);
    if (change.kind === "added") return !slot;
    return Boolean(slot) && describe(slot) === change.from;
  });
}

/**
 * Records this student's schedule and tells whoever shares the parts that
 * changed.
 *
 * `syncedBy` is never notified: they are looking at the portal and do not need
 * telling. Returns what happened so /api/sync can decide what to say to them
 * instead.
 */
export async function publishSharedTimetable(db, { timetable, section, syncedBy }) {
  const id = String(timetable?.ttNo ?? "").trim();
  if (!id) return { changed: false, reason: "no_timetable_id" };

  const slots = timetable?.slots ?? [];
  const fingerprint = timetableFingerprint(timetable);
  const now = new Date().toISOString();

  const root = db.doc(`sharedTimetables/${id}`);
  const mine = root.collection("members").doc(syncedBy);
  const previous = await mine.get();

  // The member's own schedule, always recorded — a student who syncs an
  // unchanged timetable still needs to be on the list for the next change.
  await mine.set({ uid: syncedBy, slots, fingerprint, section: section ?? "", updatedAt: now });
  await root.set(
    { timetableId: id, section: section ?? "", updatedAt: now, members: FieldValue.arrayUnion(syncedBy) },
    { merge: true },
  );

  // Nothing to compare against: this student's first sync, so there is no
  // "before" and nothing anyone could have been told.
  if (!previous.exists) return { changed: false, timetableId: id, reason: "first_seen" };
  if (previous.get("fingerprint") === fingerprint) {
    return { changed: false, timetableId: id, reason: "unchanged" };
  }

  const changes = diffTimetables({ slots: previous.get("slots") ?? [] }, { slots });
  if (changes.length === 0) return { changed: false, timetableId: id, reason: "no_visible_change" };

  // A reference number for the message, so two people comparing notes are
  // talking about the same republish.
  const revision = await db.runTransaction(async (tx) => {
    const snap = await tx.get(root);
    const next = (snap.get("revision") ?? 0) + 1;
    tx.set(root, { revision: next }, { merge: true });
    return next;
  });

  const notified = await notifyAffected(db, {
    root,
    timetableId: id,
    section: section ?? "",
    revision,
    changes,
    syncedBy,
  });

  return { changed: true, timetableId: id, revision, changes, notified };
}

async function notifyAffected(db, { root, timetableId, section, revision, changes, syncedBy }) {
  const members = await root.collection("members").get();
  const now = new Date().toISOString();
  let notified = 0;

  for (const member of members.docs) {
    if (member.id === syncedBy) continue;

    // Only the changes this member was in. Someone whose elective differs at
    // that period shares none of them and hears nothing at all.
    const theirs = changesFor(member.get("slots"), changes);
    if (theirs.length === 0) continue;

    const summary = theirs.length === 1
      ? `${theirs[0].where} changed.`
      : `${theirs.length} of your classes changed.`;

    const title = `Timetable updated — ${section || timetableId}`;
    const body = `Revision ${revision}. ${summary}`;

    // The changes are written into the notification itself rather than into a
    // shared version document, because they differ per recipient now — there
    // is no single "what changed" to point at any more.
    const doc = await db.collection("notifications").add({
      userId: member.id,
      type: "timetable",
      title,
      body,
      actionUrl: null,
      timetableId,
      version: revision,
      changes: theirs,
      read: false,
      createdAt: now,
    });

    const tokens = (await db.doc(`students/${member.id}`).get()).data()?.fcmTokens ?? [];
    if (tokens.length === 0) continue;

    for (let i = 0; i < tokens.length; i += BATCH) {
      const result = await getMessaging().sendEachForMulticast({
        tokens: tokens.slice(i, i + BATCH),
        notification: { title, body },
        data: {
          type: "timetable",
          timetableId,
          section: section || "",
          version: String(revision),
          notificationId: doc.id,
        },
        android: {
          priority: "high",
          notification: {
            channelId: "handy_timetable",
            icon: "ic_notification",
            color: "#F97316",
            // One per revision, so two students syncing the same change within
            // a minute do not stack two identical notifications.
            tag: `timetable-${timetableId}-${revision}`,
          },
        },
      });
      notified += result.successCount;
    }
  }

  return notified;
}
