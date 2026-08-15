// Fills in class-group membership for students who synced before groups existed.
//
//   node scripts/backfill-class-groups.mjs            # dry run, prints only
//   node scripts/backfill-class-groups.mjs --apply
//   node scripts/backfill-class-groups.mjs --apply 26B21CS058
//
// `classGroupMembers` is written by /api/sync, so it only appears for a student
// who has synced since that shipped. Everyone who synced before is in no room:
// they cannot read their class's announcements or notes, and an announcement
// fans out to nobody. Waiting for every student to visit the portal again is
// not a migration plan.
//
// This reuses syncGroupMemberships — the same function the endpoint calls — so
// the keys it writes are byte-identical to the ones the next real sync will
// write, and that sync is then a no-op rather than a churn.
//
// Dry run by default. This touches every student's membership, and a migration
// you cannot read before it runs is one you find out about afterwards.
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { syncGroupMemberships } from '../api/_classGroups.js';

initializeApp({
  credential: cert(JSON.parse(readFileSync('service-account.json', 'utf8'))),
});
const db = getFirestore();

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const onlyRoll = args.find((a) => !a.startsWith('--'))?.toUpperCase() ?? null;

/**
 * Rebuilds the snapshot shape groupsForTimetable expects from what Firestore
 * holds. Only the three fields it reads are filled in — inventing the rest
 * would just be a lie with more syntax.
 */
async function timetableFor(uid) {
  const versions = await db
    .collection('timetableVersions')
    .where('semesterId', '==', `self-${uid}`)
    .get();
  if (versions.empty) return null;

  // Highest versionNumber, matching what a fresh sync would carry as ttNo.
  const version = versions.docs.sort(
    (a, b) => (b.get('versionNumber') ?? 0) - (a.get('versionNumber') ?? 0),
  )[0];

  const [entries, subjects] = await Promise.all([
    db.collection('timetableEntries').where('timetableVersionId', '==', version.id).get(),
    db.collection('subjects').where('semesterId', '==', `self-${uid}`).get(),
  ]);

  const codeById = new Map(subjects.docs.map((d) => [d.id, d.get('code')]));

  return {
    ttNo: version.get('versionNumber'),
    subjects: subjects.docs.map((d) => ({ code: d.get('code'), facultyId: d.get('facultyId') })),
    // groupsForTimetable reads only subjectCode off a slot, and a subject with
    // no scheduled period is not a room anyone sits in.
    slots: entries.docs
      .map((d) => ({ subjectCode: codeById.get(d.get('subjectId')) }))
      .filter((slot) => slot.subjectCode),
  };
}

const students = await db.collection('students').get();
let touched = 0;

for (const student of students.docs) {
  const roll = student.get('rollNumber') ?? '(no roll)';
  if (onlyRoll && roll.toUpperCase() !== onlyRoll) continue;

  const timetable = await timetableFor(student.id);
  if (!timetable) {
    console.log(`${roll.padEnd(12)} no timetable yet — skipped`);
    continue;
  }

  const existing = await db.collection('classGroupMembers').where('uid', '==', student.id).get();

  if (!apply) {
    // groupsForTimetable is what syncGroupMemberships would compute; importing
    // it separately keeps the dry run honest rather than approximate.
    const { groupsForTimetable } = await import('../api/_classGroups.js');
    const keys = groupsForTimetable(timetable);
    console.log(`${roll.padEnd(12)} tt${timetable.ttNo}  ${existing.size} now → ${keys.length}`);
    for (const key of keys) console.log(`             ${key}`);
    continue;
  }

  const keys = await syncGroupMemberships(db, student.id, timetable);
  touched += 1;
  console.log(`${roll.padEnd(12)} tt${timetable.ttNo}  ${existing.size} → ${keys.length} group(s)`);
}

console.log(
  apply
    ? `\nDone. ${touched} student(s) updated.`
    : '\nDry run. Re-run with --apply to write.',
);
