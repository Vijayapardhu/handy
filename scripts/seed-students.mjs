#!/usr/bin/env node
/**
 * Provisions demo data in Firestore + Firebase Auth using the Admin SDK.
 * This never runs in the browser (SRS §57-58) — it's a one-off developer
 * script, run locally with a service-account key you download yourself:
 *
 *   Firebase Console → Project Settings → Service Accounts → Generate new
 *   private key → save as ./service-account.json (gitignored) next to this
 *   script, then:
 *
 *   npm run seed
 *
 * Or point GOOGLE_APPLICATION_CREDENTIALS at the key file instead of relying
 * on the default ./service-account.json path. Re-running is idempotent: it
 * upserts by deterministic document/collection ids.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = join(__dirname, "..", "service-account.json");

const app = initializeApp({
  credential: existsSync(serviceAccountPath)
    ? cert(JSON.parse(readFileSync(serviceAccountPath, "utf8")))
    : applicationDefault(),
});
const auth = getAuth(app);
const db = getFirestore(app);

const AUTH_EMAIL_DOMAIN = process.env.VITE_AUTH_EMAIL_DOMAIN || "handy.local";
const COLLEGE_ID = "aditya-university";
const SEMESTER_ID = "2026-sem1";
const DEPARTMENT = "CSE";
const SECTION = "A";
const now = () => new Date().toISOString();

const STUDENTS = [
  {
    rollNumber: "23A31A05B1",
    name: "Vijay Pardhu",
    password: "Handy@123",
    course: "B.Tech CSE",
    year: 2,
  },
];

const SUBJECTS = [
  { id: "agile-se", code: "CS301", name: "Agile Software Engineering", shortName: "Agile", icon: "rocket", faculty: "Chikkala Lova Lakshmi" },
  { id: "discrete-maths", code: "MA201", name: "Discrete Mathematics", shortName: "Maths", icon: "pie-chart", faculty: "Dadi Sandhya Saraswathi" },
  { id: "adsa", code: "CS302", name: "Advanced Data Structures & Algo.", shortName: "DSA", icon: "code", faculty: "Ponnada Latha Sree" },
  { id: "dbms", code: "CS303", name: "Database Management Systems", shortName: "DBMS", icon: "database", faculty: "Dr. M V B Murali Krishna M" },
  { id: "data-analysis", code: "CS304", name: "Data Analysis Essentials", shortName: "DAE", icon: "bar-chart", faculty: "Dr. M V B Murali Krishna M" },
  { id: "oop-cpp", code: "CS305", name: "Object Oriented Programming (C++)", shortName: "C++", icon: "cpp", faculty: "Mynam Sushmadevi" },
  { id: "technical-hour", code: "CS306", name: "Technical Hour", shortName: "Technical Hour", icon: "clock", faculty: "Faculty Coordinator" },
  { id: "employability-2", code: "GE201", name: "Employability Skills-II", shortName: "Employability", icon: "briefcase", faculty: "Placement Cell" },
];

// Matches the reference mockup exactly (attended/held per subject).
const ATTENDANCE_SUMMARY = {
  "agile-se": { attended: 6, held: 17 },
  "discrete-maths": { attended: 9, held: 21 },
  adsa: { attended: 23, held: 36 },
  dbms: { attended: 30, held: 45 },
  "data-analysis": { attended: 16, held: 24 },
  "oop-cpp": { attended: 31, held: 43 },
  "technical-hour": { attended: 48, held: 48 },
  "employability-2": { attended: 0, held: 0 },
};

// Mon-Fri: same lecture pattern. Saturday: shorter day. dayOfWeek: 0=Sun..6=Sat.
const TIMETABLE = [
  ...[1, 2, 3, 4, 5].flatMap((day) => [
    { day, start: "10:00", end: "10:50", subjectId: "dbms", room: "201", type: "lecture" },
    { day, start: "11:00", end: "11:50", subjectId: "adsa", room: "203", type: "lecture" },
    { day, start: "12:00", end: "12:50", subjectId: "discrete-maths", room: "105", type: "lecture" },
    { day, start: "12:50", end: "13:50", subjectId: null, room: null, type: "break", label: "Lunch Break" },
    { day, start: "14:00", end: "14:50", subjectId: "agile-se", room: "204", type: "lecture" },
    { day, start: "15:00", end: "15:50", subjectId: "oop-cpp", room: "202", type: "lecture" },
  ]),
  { day: 6, start: "10:00", end: "10:50", subjectId: "data-analysis", room: "301", type: "lecture" },
  { day: 6, start: "11:00", end: "11:50", subjectId: "technical-hour", room: "Lab 2", type: "technical" },
];

async function upsertCollege() {
  await db.doc(`colleges/${COLLEGE_ID}`).set({
    minimumAttendancePercentage: 75,
    condonationPercentage: null,
    workingDaysPerWeek: 6,
    classDurationMinutes: 50,
    statusThresholds: { critical: 0, low: 40, average: 60, good: 70, excellent: 90 },
  });
  console.log(`College config: colleges/${COLLEGE_ID}`);
}

async function upsertSubjects() {
  const batch = db.batch();
  for (const s of SUBJECTS) {
    batch.set(db.doc(`subjects/${s.id}`), {
      code: s.code,
      name: s.name,
      shortName: s.shortName,
      facultyId: s.id + "-faculty",
      facultyName: s.faculty,
      semesterId: SEMESTER_ID,
      department: DEPARTMENT,
      targetAttendance: null,
      icon: s.icon,
      active: true,
      createdAt: now(),
      updatedAt: now(),
    });
  }
  await batch.commit();
  console.log(`Seeded ${SUBJECTS.length} subjects`);
}

async function upsertTimetable() {
  const versionRef = db.doc(`timetableVersions/${SEMESTER_ID}-${DEPARTMENT}-${SECTION}-v1`);
  await versionRef.set({
    semesterId: SEMESTER_ID,
    department: DEPARTMENT,
    section: SECTION,
    versionNumber: 1,
    effectiveFrom: "2026-06-01",
    effectiveUntil: null,
    status: "published",
    publishedAt: now(),
    publishedBy: "seed-script",
    createdAt: now(),
  });

  const batch = db.batch();
  TIMETABLE.forEach((entry, i) => {
    const subject = SUBJECTS.find((s) => s.id === entry.subjectId);
    const ref = db.doc(`timetableEntries/${versionRef.id}-e${i}`);
    batch.set(ref, {
      timetableVersionId: versionRef.id,
      dayOfWeek: entry.day,
      startTime: entry.start,
      endTime: entry.end,
      subjectId: entry.subjectId ?? "break",
      facultyId: subject ? subject.id + "-faculty" : "",
      facultyName: entry.type === "break" ? entry.label : subject?.faculty ?? "",
      room: entry.room,
      type: entry.type,
      active: true,
    });
  });
  await batch.commit();
  console.log(`Seeded timetable version ${versionRef.id} with ${TIMETABLE.length} entries`);
}

/** Walks backward from yesterday collecting `count` weekday (Mon-Sat) dates, oldest first. */
function pastWeekdays(count) {
  const dates = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - 1); // start from yesterday
  while (dates.length < count) {
    if (cursor.getDay() !== 0) {
      dates.unshift(cursor.toISOString().slice(0, 10));
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return dates;
}

/** Evenly spreads `attended` presents across `held` slots (Bresenham-style) rather than clustering them. */
function distributeStatuses(attended, held) {
  const statuses = [];
  for (let i = 0; i < held; i++) {
    const before = Math.floor((i * attended) / held);
    const after = Math.floor(((i + 1) * attended) / held);
    statuses.push(after > before ? "present" : "absent");
  }
  return statuses;
}

async function seedAttendanceRecords(uid) {
  const writes = [];
  for (const [subjectId, { attended, held }] of Object.entries(ATTENDANCE_SUMMARY)) {
    if (held === 0) continue;
    const dates = pastWeekdays(held);
    const statuses = distributeStatuses(attended, held);
    dates.forEach((date, i) => {
      writes.push({
        ref: db.doc(`attendance/${uid}_${subjectId}_${date}`),
        data: {
          studentId: uid,
          subjectId,
          timetableEntryId: null,
          date,
          status: statuses[i],
          source: "import",
          recordedAt: now(),
          updatedAt: now(),
        },
      });
    });
  }

  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    writes.slice(i, i + 400).forEach(({ ref, data }) => batch.set(ref, data));
    await batch.commit();
  }
  console.log(`Seeded ${writes.length} individual attendance records (backing the calendar/history views)`);
}

async function seedLeaveRequests(uid) {
  const today = new Date();
  const daysAgo = (n) => new Date(today.getTime() - n * 86400000).toISOString();
  const daysAhead = (n) => new Date(today.getTime() + n * 86400000).toISOString();
  const dateOnly = (iso) => iso.slice(0, 10);

  const requests = [
    {
      id: `${uid}-leave-1`,
      startDate: dateOnly(daysAgo(20)),
      endDate: dateOnly(daysAgo(20)),
      reason: "Family function — attending a cousin's wedding.",
      status: "approved",
      submittedAt: daysAgo(23),
      reviewedAt: daysAgo(22),
      reviewedBy: "admin-seed",
    },
    {
      id: `${uid}-leave-2`,
      startDate: dateOnly(daysAhead(5)),
      endDate: dateOnly(daysAhead(5)),
      reason: "Medical appointment in the morning, will join by afternoon if possible.",
      status: "pending",
      submittedAt: now(),
      reviewedAt: null,
      reviewedBy: null,
    },
  ];

  const batch = db.batch();
  requests.forEach((r) => {
    const { id, ...data } = r;
    batch.set(db.doc(`leaveRequests/${id}`), { studentId: uid, ...data });
  });
  await batch.commit();
  console.log(`Seeded ${requests.length} leave requests`);
}

async function seedNotifications(uid) {
  const notifications = [
    {
      id: `${uid}-notif-1`,
      title: "Timetable Updated",
      body: "Your Monday-Friday timetable has been republished for this semester.",
      type: "timetable",
      read: false,
      actionUrl: "/timetable",
    },
    {
      id: `${uid}-notif-2`,
      title: "Attendance below target",
      body: "Agile Software Engineering has dropped to 35.29%, below the 75% target.",
      type: "attendance",
      read: false,
      actionUrl: "/subjects/agile-se",
    },
    {
      id: `${uid}-notif-3`,
      title: "Target reached in Technical Hour",
      body: "You're at 100% attendance in Technical Hour. Great work!",
      type: "target",
      read: true,
      actionUrl: "/subjects/technical-hour",
    },
    {
      id: `${uid}-notif-4`,
      title: "Leave request approved",
      body: "Your leave request for a family function has been approved.",
      type: "leave",
      read: true,
      actionUrl: "/leaves",
    },
    {
      id: `${uid}-notif-5`,
      title: "New academic announcement",
      body: "Mid-semester exams begin in two weeks — check the timetable for updated slots.",
      type: "announcement",
      read: false,
      actionUrl: null,
    },
  ];

  const batch = db.batch();
  notifications.forEach((n, i) => {
    const { id, ...data } = n;
    batch.set(db.doc(`notifications/${id}`), {
      userId: uid,
      ...data,
      createdAt: new Date(Date.now() - i * 6 * 3600000).toISOString(),
    });
  });
  await batch.commit();
  console.log(`Seeded ${notifications.length} notifications`);
}

async function upsertStudent(student) {
  const email = `${student.rollNumber.toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    console.log(`Auth user already exists for ${student.rollNumber} (${userRecord.uid})`);
  } catch {
    userRecord = await auth.createUser({
      email,
      password: student.password,
      displayName: student.name,
    });
    console.log(`Created auth user for ${student.rollNumber} (${userRecord.uid})`);
  }

  await db.doc(`students/${userRecord.uid}`).set({
    uid: userRecord.uid,
    rollNumber: student.rollNumber,
    name: student.name,
    email,
    department: DEPARTMENT,
    course: student.course,
    year: student.year,
    section: SECTION,
    semesterId: SEMESTER_ID,
    collegeId: COLLEGE_ID,
    photoUrl: null,
    // Admin-seeded accounts already have full data and never go through the
    // "connect your college portal" onboarding — without this they'd be sent
    // there by RequireCompleteProfile and get stuck, since this demo roll
    // number has no real Campus Connect account behind it.
    profileComplete: true,
    createdAt: now(),
    updatedAt: now(),
  });

  const batch = db.batch();
  for (const [subjectId, { attended, held }] of Object.entries(ATTENDANCE_SUMMARY)) {
    batch.set(db.doc(`attendanceSummaries/${userRecord.uid}_${subjectId}`), {
      studentId: userRecord.uid,
      subjectId,
      attended,
      held,
      updatedAt: now(),
    });
  }
  await batch.commit();

  console.log(`Seeded student profile + attendance summaries for ${student.rollNumber}`);
  console.log(`  Sign in with roll number "${student.rollNumber}" and password "${student.password}"`);
  return userRecord.uid;
}

async function main() {
  await upsertCollege();
  await upsertSubjects();
  await upsertTimetable();
  for (const student of STUDENTS) {
    const uid = await upsertStudent(student);
    await seedAttendanceRecords(uid);
    await seedLeaveRequests(uid);
    await seedNotifications(uid);
  }
  console.log("\nDone. Sign in to the app with the roll number/password logged above.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
