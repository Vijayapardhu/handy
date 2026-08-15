// End-to-end check of the shared-timetable broadcast, against real Firestore.
//
// Run with:  node scripts/verify-shared-timetable.mjs
//
// The feature needs two students on one timetable, which is a condition that
// cannot be arranged by hand on one phone — so this arranges it: two synthetic
// members, a timetable published twice with a room moved between them, and
// assertions on what each member ends up with.
//
// Everything it creates is namespaced under a `verify-` id and deleted at the
// end, so it never touches a real student's data or a real timetable.
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { publishSharedTimetable, diffTimetables } from '../api/_sharedTimetable.js';

initializeApp({
  credential: cert(JSON.parse(readFileSync('service-account.json', 'utf8'))),
});
const db = getFirestore();

const TIMETABLE_ID = 'verify-tt';
const ALICE = 'verify-student-alice';
const BOB = 'verify-student-bob';

const slot = (dayOfWeek, startTime, subjectCode, room) => ({
  dayOfWeek,
  startTime,
  endTime: '10:20',
  subjectCode,
  room,
  facultyName: 'DR. M V B MURALI KRISHNA M',
});

const week1 = {
  ttNo: TIMETABLE_ID,
  name: 'T9(VERIFY)',
  slots: [slot(1, '09:30', 'CS10', 'RB-221'), slot(2, '11:20', 'IT05', 'RB-301')],
};

// Same schedule, one room moved. This is the case the whole feature exists for.
const week2 = {
  ttNo: TIMETABLE_ID,
  name: 'T9(VERIFY)',
  slots: [slot(1, '09:30', 'CS10', 'AGBI-2.1'), slot(2, '11:20', 'IT05', 'RB-301')],
};

const checks = [];
function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function cleanup() {
  const notifications = await db
    .collection('notifications')
    .where('timetableId', '==', TIMETABLE_ID)
    .get();
  await Promise.all(notifications.docs.map((d) => d.ref.delete()));

  const versions = await db.collection(`sharedTimetables/${TIMETABLE_ID}/versions`).get();
  await Promise.all(versions.docs.map((d) => d.ref.delete()));

  await db.doc(`sharedTimetables/${TIMETABLE_ID}`).delete().catch(() => {});
  await db.doc(`students/${ALICE}`).delete().catch(() => {});
  await db.doc(`students/${BOB}`).delete().catch(() => {});
}

await cleanup();

// Both students exist with a device registered, so the push path is exercised
// rather than skipped. The tokens are deliberately invalid — delivery is
// Firebase's job to prove, not ours; what this checks is that we attempt it
// with the right audience and record it either way.
await db.doc(`students/${ALICE}`).set({ uid: ALICE, fcmTokens: ['verify-token-alice'] });
await db.doc(`students/${BOB}`).set({ uid: BOB, fcmTokens: ['verify-token-bob'] });

// --- First sync: Alice publishes a timetable nobody has seen. -----------------
const first = await publishSharedTimetable(db, {
  timetable: week1,
  section: week1.name,
  syncedBy: ALICE,
});

check('first sync notifies nobody', first.changed === false, `reason: ${first.reason}`);
check('first sync records version 1', first.version === 1);

const afterFirst = (await db.doc(`sharedTimetables/${TIMETABLE_ID}`).get()).data();
check('Alice is registered as a member', (afterFirst.members ?? []).includes(ALICE));

// --- Bob syncs the same unchanged timetable. ---------------------------------
const unchanged = await publishSharedTimetable(db, {
  timetable: week1,
  section: week1.name,
  syncedBy: BOB,
});

check('an unchanged timetable notifies nobody', unchanged.changed === false);

const afterBob = (await db.doc(`sharedTimetables/${TIMETABLE_ID}`).get()).data();
check('Bob is registered too', (afterBob.members ?? []).includes(BOB));
check('version did not move for an unchanged sync', afterBob.version === 1, `version ${afterBob.version}`);

// --- Bob syncs a changed timetable: Alice should hear about it. ---------------
const changed = await publishSharedTimetable(db, {
  timetable: week2,
  section: week2.name,
  syncedBy: BOB,
});

check('a moved room is detected as a change', changed.changed === true);
check('version incremented to 2', changed.version === 2, `version ${changed.version}`);
check('exactly one slot is reported as changed', changed.changes?.length === 1,
  JSON.stringify(changed.changes));
check(
  'the change names both rooms',
  changed.changes?.[0]?.from?.includes('RB-221') && changed.changes?.[0]?.to?.includes('AGBI-2.1'),
  changed.changes?.[0] ? `${changed.changes[0].from} -> ${changed.changes[0].to}` : '',
);

// --- Who was told. -----------------------------------------------------------
const inbox = await db.collection('notifications').where('timetableId', '==', TIMETABLE_ID).get();
const recipients = inbox.docs.map((d) => d.data().userId);

check('Alice got an inbox record', recipients.includes(ALICE));
check('Bob was not told about his own sync', !recipients.includes(BOB), `recipients: ${recipients}`);
check('exactly one record was written', inbox.size === 1, `${inbox.size} records`);

const record = inbox.docs[0]?.data();
check('the record carries the id and version for routing',
  record?.timetableId === TIMETABLE_ID && record?.version === 2,
  `id ${record?.timetableId}, version ${record?.version}`);
check('the record names the section and version in its text',
  record?.title?.includes('T9(VERIFY)') && record?.body?.includes('Version 2'),
  `${record?.title} / ${record?.body}`);

// --- The diff screen has something to read. ----------------------------------
const version2 = (await db.doc(`sharedTimetables/${TIMETABLE_ID}/versions/2`).get()).data();
check('version 2 was stored for the diff screen', Boolean(version2));
check('the stored version carries its changes', version2?.changes?.length === 1);

// --- A reshuffle must not be mistaken for a change. --------------------------
const reshuffled = { ...week2, slots: [...week2.slots].reverse() };
check(
  'reordering slots is not a change',
  diffTimetables(week2, reshuffled).length === 0,
);

await cleanup();

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length > 0) process.exit(1);
