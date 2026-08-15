// Who is in a class together, as a key.
//
// A "class" here is not a section. Two students on timetable 6 are in the same
// Data Analysis Essentials *subject* and not in the same DAE *class*: the
// subject splits 72 students between two lecturers, and 26B21CS058 sits with
// KASICHAINULA VYDEHI while 25B11CS101 sits with MIRTHIPATI SATYAVATHI. An
// announcement from one lecturer's CR must not reach the other's room.
//
// So the group is the timetable, the subject and the lecturer together. All
// three come from the portal unchanged for every student in that room, which
// is what lets separate accounts arrive at the same key without anybody
// coordinating.
//
// Deliberately *not* keyed on the time slot as well. A class that meets four
// times a week is one group, not four — a CR posting about Monday's lab means
// it for everyone in the room, whichever period they are reading it in.

/**
 * `<timetable>-<subjectCode>-<facultyId>`, or null when any part is missing.
 *
 * Null rather than a partial key on purpose: a group that half-identifies a
 * class would quietly merge two rooms, and the failure would look like an
 * announcement going to strangers.
 */
export function classGroupKey({ timetableId, subjectCode, facultyId }) {
  const id = String(timetableId ?? "").trim();
  const code = String(subjectCode ?? "").trim().toUpperCase();
  const faculty = String(facultyId ?? "").trim();
  if (!id || !code || !faculty) return null;
  return `${id}-${code}-${faculty}`;
}

/**
 * Every class group a student belongs to, from their own synced timetable.
 *
 * Derived rather than stored against the student: the portal is the authority
 * on who is in which room, and a membership list a student could edit is a
 * membership list a student could join.
 */
export function groupsForTimetable(timetable) {
  const byCode = new Map(
    (timetable?.subjects ?? []).map((subject) => [subject.code, subject]),
  );
  const keys = new Set();

  for (const slot of timetable?.slots ?? []) {
    const subject = byCode.get(slot.subjectCode);
    const key = classGroupKey({
      timetableId: timetable?.ttNo,
      subjectCode: slot.subjectCode,
      facultyId: subject?.facultyId,
    });
    if (key) keys.add(key);
  }

  return [...keys];
}

/**
 * Records which groups this student is in, so an announcement can find them.
 *
 * Rewritten wholesale on every sync rather than merged: a student who changes
 * elective must *leave* the old room, and a membership that only ever grew
 * would keep posting them another lecturer's announcements for the rest of the
 * semester.
 */
export async function syncGroupMemberships(db, uid, timetable) {
  const keys = groupsForTimetable(timetable);
  const collection = db.collection("classGroupMembers");

  const existing = await collection.where("uid", "==", uid).get();
  const had = new Set(existing.docs.map((d) => d.get("groupKey")));
  const now = new Date().toISOString();
  const batch = db.batch();

  for (const key of keys) {
    if (had.has(key)) continue;
    batch.set(collection.doc(`${uid}_${key}`), {
      uid,
      groupKey: key,
      timetableId: String(timetable?.ttNo ?? ""),
      joinedAt: now,
    });
  }

  for (const doc of existing.docs) {
    if (!keys.includes(doc.get("groupKey"))) batch.delete(doc.ref);
  }

  await batch.commit();
  return keys;
}

/** The uids to notify for a group, excluding whoever is posting. */
export async function membersOf(db, groupKey, { except } = {}) {
  const snap = await db
    .collection("classGroupMembers")
    .where("groupKey", "==", groupKey)
    .get();

  return snap.docs
    .map((d) => d.get("uid"))
    .filter((uid) => uid !== except);
}

/**
 * Whether this student may post to this group.
 *
 * Checked server-side every time, never trusted from the client. A CR can
 * reach every phone in a room; that is exactly the capability worth being
 * strict about.
 */
export async function isClassRep(db, uid, groupKey) {
  const doc = await db.doc(`classReps/${uid}_${groupKey}`).get();
  return doc.exists && doc.get("active") === true;
}
