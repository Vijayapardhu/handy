// Deliberate mirror of buildImportDocs() in
// src/services/students/collegePortalImportService.ts.
//
// Both the web app and this extension import the same snapshot into the same
// Firestore documents, by two different routes (Firebase Web SDK vs REST). If
// the two mappings drift, a student's data silently depends on *which* client
// last synced — so src/services/students/collegePortalImportService.test.ts
// runs this file and the TypeScript one against one fixture and asserts they
// produce identical documents. Keep them in lockstep.

const SELF_IMPORT_COLLEGE_ID = "self-import";

const ROMAN_TO_SEMESTER = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };

/** Mirrors selfImportSemesterId(). */
export function selfImportSemesterId(uid) {
  return `self-${uid}`;
}

/** "Regular(III Semester- 2025)" -> 2 (year), via roman-numeral semester -> ceil(semester/2). Falls back to 1. */
function yearFromSemesterLabel(label) {
  if (!label) return 1;
  const match = label.match(/\b(VIII|VII|VI|IV|V|III|II|I)\s+Semester/i);
  const semester = match ? ROMAN_TO_SEMESTER[match[1].toUpperCase()] : undefined;
  return semester ? Math.ceil(semester / 2) : 1;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Mirrors selfSubjectId() — the doc id a portal subject code maps to. */
function selfSubjectId(uid, code, fallback) {
  return `self-${uid}-${slugify(code || `sl${fallback}`)}`;
}

/**
 * Per-day attendance records, for the campuses whose portal reports a day
 * rather than only a running total.
 *
 * These go in `attendance` (AttendanceRecordDoc), not `attendanceMarks`. The
 * two say different things and must not be mixed: a mark is the student's own
 * note about their day, fully theirs to edit or delete; this is the college's
 * record, and a student being able to rewrite it would make it worthless. That
 * is why `attendance` is `allow write: if false` for every client and only the
 * Admin SDK writes here.
 *
 * The doc id is deterministic, so syncing the same day twice corrects the
 * record rather than adding a second one.
 *
 * Status is coarser than the portal's numbers, because AttendanceRecordDoc
 * holds a verdict and not a count: a subject that met twice and was attended
 * once records as present. The running totals in `attendanceSummaries` remain
 * the authority on how many — this collection answers "was I there that day".
 */
export function buildDailyAttendanceDocs(uid, snapshot, now) {
  const days = snapshot.daily ?? [];
  if (days.length === 0) return [];

  const slNoByCode = new Map(
    (snapshot.attendance?.subjects ?? []).map((subject) => [subject.code, subject.slNo]),
  );

  const records = [];
  for (const day of days) {
    for (const row of day.subjects ?? []) {
      if (!row.code || (Number(row.held) || 0) <= 0) continue;
      const subjectId = selfSubjectId(uid, row.code, slNoByCode.get(row.code) ?? 0);
      records.push({
        id: `${uid}_${subjectId}_${day.date}`,
        studentId: uid,
        subjectId,
        // No timetable on these campuses, so there is no entry to point at.
        timetableEntryId: null,
        date: day.date,
        status: (Number(row.attended) || 0) > 0 ? "present" : "absent",
        source: "collegePortal",
        recordedAt: now,
        updatedAt: now,
      });
    }
  }
  return records;
}

export function buildImportDocs(uid, snapshot, now) {
  const semesterId = selfImportSemesterId(uid);
  const timetableSubjectByCode = new Map(
    (snapshot.timetable?.subjects ?? []).map((subject) => [subject.code, subject]),
  );

  const studentUpdate = {
    name: snapshot.studentName ?? "",
    department: snapshot.branch ?? "",
    course: snapshot.course ?? "",
    year: yearFromSemesterLabel(snapshot.semesterLabel),
    section: snapshot.timetable?.name ?? "",
    semesterId,
    collegeId: SELF_IMPORT_COLLEGE_ID,
    // Coerced to null, never left undefined.
    //
    // The Admin SDK rejects an undefined value outright, so a capture missing
    // any one of these — a student with no photo on file, no mobile number,
    // no date of birth — failed the *entire* sync with a 500 rather than
    // syncing the fields it did have. Absent and unknown are the same thing
    // here, and null is how Firestore says it.
    photoUrl: snapshot.photoUrl ?? null,
    admissionNo: snapshot.admissionNo ?? null,
    semesterLabel: snapshot.semesterLabel ?? null,
    gender: snapshot.gender ?? null,
    dob: snapshot.dob ?? null,
    mobileNo: snapshot.mobileNo ?? null,
    profileComplete: true,
    updatedAt: now,
  };

  const subjects = [];
  const summaries = [];

  for (const subject of snapshot.attendance.subjects) {
    const subjectId = selfSubjectId(uid, subject.code, subject.slNo);
    const fromTimetable = timetableSubjectByCode.get(subject.code);

    subjects.push({
      id: subjectId,
      doc: {
        code: subject.code,
        name: subject.name,
        shortName:
          fromTimetable?.shortName ??
          (subject.name.length > 18 ? `${subject.name.slice(0, 17)}…` : subject.name),
        // Same reason as the profile fields above: the portal's attendance
        // table carries no faculty at all, so these are undefined for every
        // subject that was not also seen on the timetable page — which is all
        // of them until the timetable has been captured once.
        facultyId: subject.facultyId ?? "",
        facultyName: subject.facultyName ?? "",
        semesterId,
        department: snapshot.branch ?? "",
        targetAttendance: null,
        icon: "book",
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    });

    summaries.push({
      id: `${uid}_${subjectId}`,
      doc: {
        studentId: uid,
        subjectId,
        attended: subject.attended,
        held: subject.held,
        source: "collegePortal",
        updatedAt: now,
      },
    });
  }

  return { studentUpdate, subjects, summaries };
}

/** Mirrors selfTimetableVersionId(). */
export function selfTimetableVersionId(uid, ttNo) {
  return `self-${uid}-tt${ttNo ?? 1}`;
}

/** Mirrors buildTimetableDocs() in collegePortalImportService.ts. */
export function buildTimetableDocs(uid, timetable, { department, effectiveFrom, now }) {
  const semesterId = selfImportSemesterId(uid);
  const versionId = selfTimetableVersionId(uid, timetable.ttNo);

  const version = {
    id: versionId,
    doc: {
      semesterId,
      department,
      section: timetable.name ?? "",
      versionNumber: timetable.ttNo ?? 1,
      effectiveFrom,
      effectiveUntil: null,
      status: "published",
      publishedAt: now,
      publishedBy: null,
      createdAt: now,
    },
  };

  const subjectByCode = new Map(timetable.subjects.map((s) => [s.code, s]));
  const entries = [];

  for (const slot of timetable.slots) {
    const subject = subjectByCode.get(slot.subjectCode);
    entries.push({
      id: `${versionId}-d${slot.dayOfWeek}-p${slot.periodNo}`,
      doc: {
        timetableVersionId: versionId,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subjectId: selfSubjectId(uid, slot.subjectCode, slot.periodNo),
        facultyId: subject?.facultyId ?? "",
        facultyName: subject?.facultyName ?? "",
        room: subject?.room ?? null,
        block: subject?.block ?? null,
        strength: subject?.strength ?? null,
        opted: subject?.opted ?? null,
        periodNo: slot.periodNo,
        type: slot.type,
        active: true,
      },
    });
  }

  return { version, entries };
}

/** The stub shape createStudentStub() writes — used when the doc doesn't exist yet. */
export function buildStudentStub(uid, rollNumber, email, now) {
  return {
    uid,
    rollNumber,
    name: "",
    email,
    department: "",
    course: "",
    year: 0,
    section: "",
    semesterId: "",
    collegeId: "",
    photoUrl: null,
    profileComplete: false,
    createdAt: now,
    updatedAt: now,
  };
}
