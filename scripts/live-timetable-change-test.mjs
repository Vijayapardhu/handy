// Live test of the timetable-change notification, against a real device.
//
//   node scripts/live-timetable-change-test.mjs          send the test
//   node scripts/live-timetable-change-test.mjs cleanup  undo it
//
// What it does *not* do is edit anybody's timetable. The broadcast reads and
// writes only `sharedTimetables/{id}/members` and `notifications`, so a real
// student's subjects, entries and attendance are never touched — the "change"
// exists solely in a synthetic classmate's copy of the schedule.
//
// The shape of the test is the thing worth getting right: a classmate whose
// schedule matches the target's is registered, then re-publishes it with one
// shared room moved. That is the real path — same code, same push, same
// notification document — rather than a message hand-written to look like one.
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import { publishSharedTimetable } from '../api/_sharedTimetable.js';

initializeApp({
  credential: cert(JSON.parse(readFileSync('service-account.json', 'utf8'))),
});
const db = getFirestore();
const auth = getAuth();

const TARGET_EMAIL = '26b21cs058@handy.local';
const TIMETABLE_ID = '6';
const CLASSMATE = 'live-test-classmate';

const target = await auth.getUserByEmail(TARGET_EMAIL);
const targetUid = target.uid;

/** The student's real schedule, read back out of their own timetable entries. */
async function realSlots(uid) {
  const versions = await db
    .collection('timetableVersions')
    .where('semesterId', '==', `self-${uid}`)
    .get();
  const versionId = versions.docs[0]?.id;
  if (!versionId) return [];

  const [entries, subjects] = await Promise.all([
    db.collection('timetableEntries').where('timetableVersionId', '==', versionId).get(),
    db.collection('subjects').where('semesterId', '==', `self-${uid}`).get(),
  ]);
  const codeById = Object.fromEntries(subjects.docs.map((d) => [d.id, d.get('code')]));

  return entries.docs.map((d) => ({
    dayOfWeek: d.get('dayOfWeek'),
    startTime: d.get('startTime'),
    endTime: d.get('endTime'),
    subjectCode: codeById[d.get('subjectId')] ?? '?',
    room: d.get('room'),
    facultyName: d.get('facultyName'),
  }));
}

async function cleanup({ quiet = false } = {}) {
  const notifications = await db
    .collection('notifications')
    .where('userId', '==', targetUid)
    .where('type', '==', 'timetable')
    .get();
  await Promise.all(notifications.docs.map((d) => d.ref.delete()));

  await db.doc(`sharedTimetables/${TIMETABLE_ID}/members/${CLASSMATE}`).delete().catch(() => {});
  await db.doc(`sharedTimetables/${TIMETABLE_ID}/members/${targetUid}`).delete().catch(() => {});
  await db.doc(`students/${CLASSMATE}`).delete().catch(() => {});

  if (!quiet) {
    console.log(`removed ${notifications.size} timetable notification(s)`);
    console.log('removed the synthetic classmate and both test member records');
  }
}

if (process.argv[2] === 'cleanup') {
  await cleanup();
  process.exit(0);
}

// Start from a clean slate so a re-run is not confused by the last one.
await cleanup({ quiet: true });

const slots = await realSlots(targetUid);
if (slots.length === 0) {
  console.error('The target has no timetable stored; nothing to test against.');
  process.exit(1);
}

// Register the target with their own real schedule, so the matching has
// something true to compare against.
await db.doc(`sharedTimetables/${TIMETABLE_ID}/members/${targetUid}`).set({
  uid: targetUid,
  slots,
  section: 'T6(CA3)',
  fingerprint: 'seeded-for-live-test',
  updatedAt: new Date().toISOString(),
});

// A classmate on the same schedule, with no device of their own.
await db.doc(`students/${CLASSMATE}`).set({ uid: CLASSMATE, fcmTokens: [] });
const timetable = { ttNo: TIMETABLE_ID, name: 'T6(CA3)', slots };
await publishSharedTimetable(db, { timetable, section: 'T6(CA3)', syncedBy: CLASSMATE });

// Move one room in a slot they share. Monday's first period is the safest
// pick: both of them have it, and it is unmistakable on the phone.
const moved = slots.map((slot) =>
  slot.dayOfWeek === 1 && slot.startTime === '09:30'
    ? { ...slot, room: 'TEST-ROOM-9' }
    : slot,
);

const changed = moved.find((s) => s.room === 'TEST-ROOM-9');
if (!changed) {
  console.error('No Monday 09:30 slot to move; nothing would change.');
  await cleanup({ quiet: true });
  process.exit(1);
}

const result = await publishSharedTimetable(db, {
  timetable: { ...timetable, slots: moved },
  section: 'T6(CA3)',
  syncedBy: CLASSMATE,
});

console.log('changed:', result.changed);
console.log('revision:', result.revision);
console.log('changes:', JSON.stringify(result.changes, null, 2));
console.log('push successes:', result.notified);

const inbox = await db
  .collection('notifications')
  .where('userId', '==', targetUid)
  .where('type', '==', 'timetable')
  .get();

console.log(`\ninbox records for the target: ${inbox.size}`);
for (const doc of inbox.docs) {
  const d = doc.data();
  console.log('  id:', doc.id);
  console.log('  title:', d.title);
  console.log('  body:', d.body);
  console.log('  timetableId:', d.timetableId, '| version:', d.version);
  console.log('  changes:', JSON.stringify(d.changes));
}

console.log('\nCheck the phone, then run: node scripts/live-timetable-change-test.mjs cleanup');
