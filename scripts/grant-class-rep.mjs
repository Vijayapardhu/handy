// Grants or revokes class-rep rights for one student in one class.
//
//   node scripts/grant-class-rep.mjs <rollNumber> <subjectCode>
//   node scripts/grant-class-rep.mjs <rollNumber> <subjectCode> --revoke
//   node scripts/grant-class-rep.mjs <rollNumber> --list
//
// Deliberately a script and not a screen. A class rep can put a notification
// on every phone in a room, and that is not a capability an app should let
// anyone award themselves — nor one to hand out through a form that could be
// reached by someone who guessed a group key. Firestore refuses every client
// write to `classReps`; this runs with the Admin SDK, outside those rules.
//
// The group is worked out from the student's own synced timetable, so the
// grant is always for a room they are actually in.
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import { classGroupKey } from '../api/_classGroups.js';

initializeApp({
  credential: cert(JSON.parse(readFileSync('service-account.json', 'utf8'))),
});
const db = getFirestore();
const auth = getAuth();

const [rollNumber, second, third] = process.argv.slice(2);
const revoke = [second, third].includes('--revoke');
const listOnly = [second, third].includes('--list');
const subjectCode = second && !second.startsWith('--') ? second.toUpperCase() : null;

if (!rollNumber) {
  console.error('Usage: node scripts/grant-class-rep.mjs <rollNumber> <subjectCode> [--revoke]');
  console.error('       node scripts/grant-class-rep.mjs <rollNumber> --list');
  process.exit(1);
}

const user = await auth.getUserByEmail(`${rollNumber.toLowerCase()}@handy.local`).catch(() => null);
if (!user) {
  console.error(`No Handy account for ${rollNumber}.`);
  process.exit(1);
}

/** The rooms this student is in, with the subject names spelled out. */
async function rooms() {
  const memberships = await db.collection('classGroupMembers').where('uid', '==', user.uid).get();
  const subjects = await db.collection('subjects').where('semesterId', '==', `self-${user.uid}`).get();
  const byCode = Object.fromEntries(subjects.docs.map((d) => [d.get('code'), d.data()]));

  return memberships.docs.map((doc) => {
    const key = doc.get('groupKey');
    const code = key.split('-')[1];
    const subject = byCode[code];
    return { key, code, name: subject?.name ?? code, faculty: subject?.facultyName ?? '?' };
  });
}

const available = await rooms();

if (available.length === 0) {
  console.error(
    `${rollNumber} has no class groups yet — they belong to a room only once their`,
    '\ntimetable has synced since group membership was introduced. Ask them to sync.',
  );
  process.exit(1);
}

if (listOnly || !subjectCode) {
  console.log(`${rollNumber} (${user.uid}) is in:\n`);
  for (const room of available) {
    const rep = await db.doc(`classReps/${user.uid}_${room.key}`).get();
    const mark = rep.exists && rep.get('active') === true ? 'REP ' : '    ';
    console.log(`  ${mark}${room.code.padEnd(10)} ${room.name.padEnd(42)} ${room.faculty}`);
    console.log(`       ${room.key}`);
  }
  if (!subjectCode && !listOnly) console.log('\nPass a subject code to grant.');
  process.exit(0);
}

const room = available.find((r) => r.code === subjectCode);
if (!room) {
  console.error(`${rollNumber} is not in any ${subjectCode} class. Their rooms:`);
  for (const r of available) console.error(`  ${r.code}  ${r.name}`);
  process.exit(1);
}

// Written as a document rather than deleted on revoke, so a withdrawn grant
// leaves a trace — who held it, and until when.
await db.doc(`classReps/${user.uid}_${room.key}`).set(
  {
    uid: user.uid,
    rollNumber,
    groupKey: room.key,
    subjectCode: room.code,
    active: !revoke,
    updatedAt: new Date().toISOString(),
  },
  { merge: true },
);

const members = await db.collection('classGroupMembers').where('groupKey', '==', room.key).get();
console.log(`${revoke ? 'Revoked' : 'Granted'} class rep for ${rollNumber}`);
console.log(`  ${room.name} · ${room.faculty}`);
console.log(`  group ${room.key}`);
console.log(`  ${members.size} student${members.size === 1 ? '' : 's'} currently in that room`);

if (classGroupKey({ timetableId: 'x', subjectCode: 'y', facultyId: 'z' }) === null) {
  console.error('classGroupKey is misbehaving; check api/_classGroups.js');
  process.exit(1);
}
