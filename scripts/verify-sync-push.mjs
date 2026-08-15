// End-to-end check of POST /api/sync against production.
//
// Run with:  node scripts/verify-sync-push.mjs
//
// Uses a throwaway roll number, never a real one. Testing this by syncing a
// real student would mean writing real attendance from a made-up snapshot,
// which is exactly the thing this endpoint must never do by accident — so the
// test account is created, exercised, asserted on, and deleted.
//
// What it proves that a unit test cannot: the deployed function is running the
// current code, the Admin SDK writes land, a notification document is recorded
// even when no device can receive the push, and turning "new data" off
// suppresses the notification without suppressing the widget refresh.
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert(JSON.parse(readFileSync('service-account.json', 'utf8'))),
});
const db = getFirestore();
const auth = getAuth();

const ENDPOINT = 'https://handy-aus.vercel.app/api/sync';
const KEY = 'handy-sync-zKtSG70yVmMZtVpSp5PHijLMjBl8cijJ';
const ROLL = '00VERIFY001';
const EMAIL = `${ROLL.toLowerCase()}@handy.local`;

const checks = [];
function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

/** A complete capture in the shape the extension sends. */
function snapshot({ subjects, withTimetable }) {
  return {
    rollNumber: ROLL,
    studentName: 'VERIFY TEST ACCOUNT',
    branch: 'Computer Science & Engineering',
    course: 'B.Tech',
    year: 2,
    capturedAt: new Date().toISOString(),
    attendance: {
      total: { attended: 40, held: 50, percent: 80 },
      subjects,
    },
    ...(withTimetable
      ? {
          timetable: {
            ttNo: 'verify-sync-tt',
            name: 'T9(VERIFY-SYNC)',
            subjects: [{ code: 'VER01', name: 'Verification', shortName: 'VER' }],
            slots: [
              {
                dayOfWeek: 1,
                startTime: '09:30',
                endTime: '10:20',
                subjectCode: 'VER01',
                room: withTimetable === 'moved' ? 'AGBI-2.1' : 'RB-221',
                facultyName: 'DR VERIFY',
                periodNo: 1,
                noof_students: 72,
                opted_students: 70,
              },
            ],
          },
        }
      : {}),
  };
}

async function post(body) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-handy-key': KEY },
    body: JSON.stringify(body),
  });
  return { status: response.status, payload: await response.json().catch(() => ({})) };
}

async function cleanup(uid) {
  // Guarded because a failed first sync leaves no uid, and a `where` clause
  // with undefined throws — which would bury the real failure under a stack
  // trace from the tidy-up.
  if (!uid) return;
  for (const collection of ['notifications', 'attendanceSummaries', 'subjects', 'timetableEntries', 'timetableVersions']) {
    const field = collection === 'notifications' ? 'userId' : 'studentId';
    const snap = await db.collection(collection).where(field, '==', uid).get().catch(() => null);
    if (snap) await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  // Fenced collections key on the namespace rather than a studentId field.
  for (const collection of ['subjects', 'timetableVersions']) {
    const snap = await db.collection(collection).where('semesterId', '==', `self-${uid}`).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  await db.doc(`students/${uid}`).delete().catch(() => {});
  await db.doc(`syncRateLimits/${ROLL}`).delete().catch(() => {});
  await db.doc('sharedTimetables/verify-sync-tt').delete().catch(() => {});
  await auth.deleteUser(uid).catch(() => {});
}

// Start clean, in case a previous run died partway.
const existing = await auth.getUserByEmail(EMAIL).catch(() => null);
await cleanup(existing?.uid);

let uid;
try {
  // --- A first sync creates the account and writes the data. ------------------
  const first = await post(snapshot({
    subjects: [
      { code: 'VER01', name: 'Verification', attended: 20, held: 25, percent: 80 },
      { code: 'VER02', name: 'Second Subject', attended: 20, held: 25, percent: 80 },
    ],
  }));

  check('the endpoint accepts a well-formed snapshot', first.status === 200,
    `HTTP ${first.status} ${JSON.stringify(first.payload).slice(0, 160)}`);
  check('it reports the subjects it wrote', first.payload.subjectCount === 2,
    `subjectCount ${first.payload.subjectCount}`);

  uid = first.payload.uid;
  check('it created a Firebase account', Boolean(uid));

  const student = await db.doc(`students/${uid}`).get();
  check('the student document was written', student.exists);
  check('the roll number round-tripped', student.data()?.rollNumber === ROLL);

  // --- The notification document, which is what the inbox reads. -------------
  const inbox = await db.collection('notifications').where('userId', '==', uid).get();
  check('a notification was recorded despite no registered device', inbox.size >= 1,
    `${inbox.size} records`);
  check('it is an attendance notification', inbox.docs[0]?.data()?.type === 'attendance',
    inbox.docs[0]?.data()?.type);

  // --- Turning "new data" off suppresses the notification, not the sync. -----
  await db.doc(`students/${uid}`).update({ notifyNewData: false });
  const before = (await db.collection('notifications').where('userId', '==', uid).get()).size;

  const muted = await post(snapshot({
    subjects: [{ code: 'VER01', name: 'Verification', attended: 21, held: 26, percent: 80.8 }],
  }));
  check('a muted student still syncs', muted.status === 200, `HTTP ${muted.status}`);

  const after = (await db.collection('notifications').where('userId', '==', uid).get()).size;
  check('but is not notified', after === before, `${before} -> ${after}`);

  const summaries = await db.collection('attendanceSummaries').where('studentId', '==', uid).get();
  check('and their attendance was still written', summaries.size >= 1, `${summaries.size} summaries`);

  // --- A rejected key must not write anything. -------------------------------
  const unauthorised = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-handy-key': 'wrong' },
    body: JSON.stringify(snapshot({ subjects: [] })),
  });
  check('a wrong key is rejected', unauthorised.status === 401, `HTTP ${unauthorised.status}`);

  const malformed = await post({ rollNumber: ROLL });
  check('a snapshot with no attendance is rejected', malformed.status === 400,
    `HTTP ${malformed.status}`);
} finally {
  await cleanup(uid ?? (await auth.getUserByEmail(EMAIL).catch(() => null))?.uid);
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length > 0) process.exit(1);
