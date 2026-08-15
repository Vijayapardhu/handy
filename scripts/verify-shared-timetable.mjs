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
// Same timetable id, different elective at 11:20. The case the whole
// slot-wise model exists for.
const CARA = 'verify-student-cara';

const slot = (dayOfWeek, startTime, subjectCode, room) => ({
  dayOfWeek,
  startTime,
  endTime: '10:20',
  subjectCode,
  room,
  facultyName: 'DR. M V B MURALI KRISHNA M',
});

// Alice and Bob share both slots. Cara shares the 09:30 lecture but took a
// different elective at 11:20 — so she must hear about the first change and
// never about the second.
const shared = () => slot(1, '09:30', 'CS10', 'RB-221');
const electiveA = () => slot(2, '11:20', 'IT05', 'RB-301');
const electiveB = () => slot(2, '11:20', 'ME09', 'MB-110', 'DR. OTHER');

const week1 = { ttNo: TIMETABLE_ID, name: 'T9(VERIFY)', slots: [shared(), electiveA()] };

// Both slots move: the shared lecture changes room, and so does elective A.
const week2 = {
  ttNo: TIMETABLE_ID,
  name: 'T9(VERIFY)',
  slots: [slot(1, '09:30', 'CS10', 'AGBI-2.1'), slot(2, '11:20', 'IT05', 'RB-409')],
};

const caraWeek = { ttNo: TIMETABLE_ID, name: 'T9(VERIFY)', slots: [shared(), electiveB()] };

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

  const members = await db.collection(`sharedTimetables/${TIMETABLE_ID}/members`).get();
  await Promise.all(members.docs.map((d) => d.ref.delete()));

  await db.doc(`sharedTimetables/${TIMETABLE_ID}`).delete().catch(() => {});
  for (const uid of [ALICE, BOB, CARA]) {
    await db.doc(`students/${uid}`).delete().catch(() => {});
  }
}

await cleanup();

// Both students exist with a device registered, so the push path is exercised
// rather than skipped. The tokens are deliberately invalid — delivery is
// Firebase's job to prove, not ours; what this checks is that we attempt it
// with the right audience and record it either way.
for (const uid of [ALICE, BOB, CARA]) {
  await db.doc(`students/${uid}`).set({ uid, fcmTokens: [`verify-token-${uid}`] });
}

async function inboxFor(uid) {
  const snap = await db
    .collection('notifications')
    .where('timetableId', '==', TIMETABLE_ID)
    .where('userId', '==', uid)
    .get();
  return snap.docs.map((d) => d.data());
}

// --- Everyone registers their own schedule. ----------------------------------
const first = await publishSharedTimetable(db, {
  timetable: week1, section: week1.name, syncedBy: ALICE,
});
check('a first sync tells nobody', first.changed === false, `reason: ${first.reason}`);

await publishSharedTimetable(db, { timetable: week1, section: week1.name, syncedBy: BOB });
await publishSharedTimetable(db, { timetable: caraWeek, section: caraWeek.name, syncedBy: CARA });

const members = await db.collection(`sharedTimetables/${TIMETABLE_ID}/members`).get();
check('every student who synced is on the list', members.size === 3, `${members.size} members`);

// --- An unchanged re-sync is not news. ---------------------------------------
const unchanged = await publishSharedTimetable(db, {
  timetable: week1, section: week1.name, syncedBy: BOB,
});
check('re-syncing the same schedule tells nobody', unchanged.changed === false,
  `reason: ${unchanged.reason}`);
check('and nothing was written', (await inboxFor(ALICE)).length === 0);

// --- Bob's timetable moves two slots. ----------------------------------------
const changed = await publishSharedTimetable(db, {
  timetable: week2, section: week2.name, syncedBy: BOB,
});

check('a moved room is detected', changed.changed === true);
check('both moved slots are found', changed.changes?.length === 2,
  changed.changes?.map((c) => c.where).join(', '));
check('a revision number is issued', changed.revision === 1, `revision ${changed.revision}`);

// --- Who heard what. ---------------------------------------------------------
const alice = await inboxFor(ALICE);
const bob = await inboxFor(BOB);
const cara = await inboxFor(CARA);

check('Bob is not told about his own sync', bob.length === 0, `${bob.length} records`);

check('Alice, who shares both classes, is told once', alice.length === 1, `${alice.length} records`);
check('and told about both changes', alice[0]?.changes?.length === 2,
  alice[0]?.changes?.map((c) => c.where).join(', '));

check('Cara, who shares only the lecture, is also told', cara.length === 1, `${cara.length} records`);
check(
  'but only about the class she is actually in',
  cara[0]?.changes?.length === 1 && cara[0].changes[0].where === 'Monday 09:30',
  cara[0]?.changes?.map((c) => c.where).join(', '),
);
check(
  'her own elective is never mentioned',
  !cara[0]?.changes?.some((c) => c.where.includes('11:20')),
);

// --- The notification carries what the diff screen needs. --------------------
check('the record routes to the right timetable and revision',
  alice[0]?.timetableId === TIMETABLE_ID && alice[0]?.version === 1,
  `id ${alice[0]?.timetableId}, version ${alice[0]?.version}`);
check('the change names both rooms',
  alice[0]?.changes?.some((c) => c.from?.includes('RB-221') && c.to?.includes('AGBI-2.1')));

// --- A reshuffle must not be mistaken for a change. --------------------------
check('reordering slots is not a change',
  diffTimetables(week2, { ...week2, slots: [...week2.slots].reverse() }).length === 0);

await cleanup();

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length > 0) process.exit(1);
