import { doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/app/config/firebase";
import {
  studentDocRef,
  subjectsCol,
  attendanceSummariesCol,
  timetableVersionsCol,
  timetableEntriesCol,
} from "@/services/firebase/collections";
import { ensureStudentStub } from "@/services/students/studentService";
import { getActiveSubjects } from "@/services/subjects/subjectService";
import type { CollegePortalSnapshot, CollegePortalTimetable } from "@/types/collegePortal";
import type { StudentDoc } from "@/types/student";
import type { SubjectDoc } from "@/types/subject";
import type { AttendanceSummaryDoc } from "@/types/attendance";
import type { TimetableEntryDoc, TimetableVersionDoc } from "@/types/timetable";

/**
 * Every self-registered (portal-import) student gets subjects/attendance
 * scoped to a private namespace derived from their own uid — never a
 * college-wide semesterId an admin provisioned. firestore.rules only lets a
 * student create/update a `subjects` doc when its semesterId matches this
 * exact pattern, so two self-registered students never collide or see each
 * other's subjects even though `subjects` is a flat, read-open collection.
 */
export function selfImportSemesterId(uid: string): string {
  return `self-${uid}`;
}

const SELF_IMPORT_COLLEGE_ID = "self-import";

const ROMAN_TO_SEMESTER: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
};

/** "Regular(III Semester- 2025)" -> 2 (year), via roman-numeral semester -> ceil(semester/2). Falls back to 1. */
function yearFromSemesterLabel(label: string | null): number {
  if (!label) return 1;
  const match = label.match(/\b(VIII|VII|VI|IV|V|III|II|I)\s+Semester/i);
  const semester = match ? ROMAN_TO_SEMESTER[match[1].toUpperCase()] : undefined;
  return semester ? Math.ceil(semester / 2) : 1;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface ImportDocs {
  studentUpdate: Partial<StudentDoc>;
  subjects: Array<{ id: string; doc: Omit<SubjectDoc, "id"> }>;
  summaries: Array<{ id: string; doc: Omit<AttendanceSummaryDoc, "id"> }>;
}

export interface TimetableImportDocs {
  version: { id: string; doc: Omit<TimetableVersionDoc, "id"> };
  entries: Array<{ id: string; doc: Omit<TimetableEntryDoc, "id"> }>;
}

/** Doc id of the self-imported subject a portal subject code maps to. */
function selfSubjectId(uid: string, code: string, fallback: string | number): string {
  return `self-${uid}-${slugify(code || `sl${fallback}`)}`;
}

/** Doc id of a self-imported timetable version. Mirrored in the extension. */
export function selfTimetableVersionId(uid: string, ttNo: number | null): string {
  return `self-${uid}-tt${ttNo ?? 1}`;
}

/**
 * Timetable half of the import (studenttimetableoption.aspx/ShowTimeTables).
 * Produces one `timetableVersions` doc and one `timetableEntries` doc per
 * slot, joined to the already-imported subjects by subject code.
 *
 * `effectiveFrom` is supplied by the caller rather than defaulted to today:
 * on a re-sync the existing version keeps the date it was first seen, so a
 * student who syncs again doesn't blank out the timetable for every earlier
 * date. Mirrored in extension/src/snapshotMapping.js.
 */
export function buildTimetableDocs(
  uid: string,
  timetable: CollegePortalTimetable,
  options: { department: string; effectiveFrom: string; now: string },
): TimetableImportDocs {
  const { department, effectiveFrom, now } = options;
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
      status: "published" as const,
      publishedAt: now,
      publishedBy: null,
      createdAt: now,
    },
  };

  const subjectByCode = new Map(timetable.subjects.map((s) => [s.code, s]));
  const entries: TimetableImportDocs["entries"] = [];

  for (const slot of timetable.slots) {
    const subject = subjectByCode.get(slot.subjectCode);
    entries.push({
      // Period number keys the slot, so re-syncing overwrites the same doc
      // rather than accumulating a second copy of every class.
      id: `${versionId}-d${slot.dayOfWeek}-p${slot.periodNo}`,
      doc: {
        timetableVersionId: versionId,
        dayOfWeek: slot.dayOfWeek as TimetableEntryDoc["dayOfWeek"],
        startTime: slot.startTime,
        endTime: slot.endTime,
        subjectId: selfSubjectId(uid, slot.subjectCode, slot.periodNo),
        facultyId: subject?.facultyId ?? "",
        facultyName: subject?.facultyName ?? "",
        room: subject?.room ?? null,
        type: slot.type,
        active: true,
      },
    });
  }

  return { version, entries };
}

/**
 * The snapshot -> Firestore-documents mapping, kept pure and separate from
 * the write itself. The browser extension performs the same import over the
 * Firestore REST API and therefore has to produce byte-identical documents;
 * extension/src/snapshotMapping.js is a deliberate mirror of this function
 * and collegePortalImportService.test.ts asserts the two agree. Change one,
 * change the other — the test will catch it if you don't.
 */
export function buildImportDocs(uid: string, snapshot: CollegePortalSnapshot, now: string): ImportDocs {
  const semesterId = selfImportSemesterId(uid);
  // The timetable capture carries the portal's own abbreviations and the
  // student's section; the attendance capture carries neither.
  const timetableSubjectByCode = new Map(
    (snapshot.timetable?.subjects ?? []).map((subject) => [subject.code, subject]),
  );

  const studentUpdate: Partial<StudentDoc> = {
    name: snapshot.studentName ?? "",
    department: snapshot.branch ?? "",
    course: snapshot.course ?? "",
    year: yearFromSemesterLabel(snapshot.semesterLabel),
    // Must equal the timetable version's `section`, or getPublishedVersions()
    // won't match the student to their own timetable.
    section: snapshot.timetable?.name ?? "",
    semesterId,
    collegeId: SELF_IMPORT_COLLEGE_ID,
    photoUrl: snapshot.photoUrl,
    admissionNo: snapshot.admissionNo,
    semesterLabel: snapshot.semesterLabel,
    gender: snapshot.gender,
    dob: snapshot.dob,
    mobileNo: snapshot.mobileNo,
    profileComplete: true,
    updatedAt: now,
  };

  const subjects: ImportDocs["subjects"] = [];
  const summaries: ImportDocs["summaries"] = [];

  for (const subject of snapshot.attendance.subjects) {
    const subjectId = selfSubjectId(uid, subject.code, subject.slNo);
    const fromTimetable = timetableSubjectByCode.get(subject.code);

    subjects.push({
      id: subjectId,
      doc: {
        code: subject.code,
        name: subject.name,
        // "ADSAA" beats a truncated "Advanced Data Structu…" wherever space
        // is tight, so prefer the portal's abbreviation when we have one.
        shortName:
          fromTimetable?.shortName ??
          (subject.name.length > 18 ? `${subject.name.slice(0, 17)}…` : subject.name),
        facultyId: subject.facultyId,
        facultyName: subject.facultyName,
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

/**
 * Writes a captured college-portal snapshot straight into the same
 * collections the rest of the app reads (`students`, `subjects`,
 * `attendanceSummaries`) — per product decision, there is no separate
 * "synced" view; this *is* the student's attendance data from here on.
 * Requires the firestore.rules changes documented alongside the `students`,
 * `subjects`, and `attendanceSummaries` match blocks (self-uid-scoped writes
 * only — see firestore.rules comments).
 */
export async function importCollegePortalSnapshot(
  uid: string,
  rollNumber: string,
  snapshot: CollegePortalSnapshot,
): Promise<void> {
  const now = new Date().toISOString();
  const semesterId = selfImportSemesterId(uid);

  // The student write below is an `update`, which fails outright on a missing
  // document — so guarantee the stub exists first (signup can be interrupted
  // between creating the Auth account and writing the doc).
  await ensureStudentStub(uid, rollNumber);

  // Subjects the previous import left behind: the portal's subject list
  // changes every semester, and nothing else would ever retire the old rows,
  // so they'd keep showing up alongside the new ones with frozen numbers.
  const previouslyImported = await getActiveSubjects(semesterId);

  const { studentUpdate, subjects, summaries } = buildImportDocs(uid, snapshot, now);
  const importedSubjectIds = new Set(subjects.map((s) => s.id));

  const batch = writeBatch(db);
  batch.update(studentDocRef(uid), studentUpdate);

  for (const subject of subjects) {
    batch.set(doc(subjectsCol(), subject.id), subject.doc as SubjectDoc);
  }
  for (const summary of summaries) {
    batch.set(doc(attendanceSummariesCol(), summary.id), summary.doc as AttendanceSummaryDoc);
  }

  // Retired, not deleted: the summaries stay readable, and firestore.rules
  // never grants a client delete on either collection.
  for (const stale of previouslyImported) {
    if (!importedSubjectIds.has(stale.id)) {
      batch.update(doc(subjectsCol(), stale.id), { active: false, updatedAt: now });
    }
  }

  if (snapshot.timetable) {
    const versionId = selfTimetableVersionId(uid, snapshot.timetable.ttNo);
    const published = await getSelfPublishedVersions(uid);

    const { version, entries } = buildTimetableDocs(uid, snapshot.timetable, {
      department: snapshot.branch ?? "",
      // Keep the date this timetable was first seen; only a brand-new version
      // starts today. Moving it forward on every re-sync would hide the
      // timetable from every date before the most recent sync.
      effectiveFrom: published.find((v) => v.id === versionId)?.effectiveFrom ?? now.slice(0, 10),
      now,
    });

    batch.set(doc(timetableVersionsCol(), version.id), version.doc as TimetableVersionDoc);
    for (const entry of entries) {
      batch.set(doc(timetableEntriesCol(), entry.id), entry.doc as TimetableEntryDoc);
    }

    // A different ttNo means the college moved this student to another
    // timetable (new semester, section change). The old version has to stop
    // being "published" or getActiveTimetableVersion could still pick it.
    for (const superseded of published) {
      if (superseded.id !== version.id) {
        batch.update(doc(timetableVersionsCol(), superseded.id), {
          status: "archived",
          effectiveUntil: now.slice(0, 10),
        });
      }
    }
  }

  await batch.commit();
}

/**
 * This student's own published timetable versions — used both to preserve
 * `effectiveFrom` and to find versions to archive.
 *
 * The `status` filter is not optional: firestore.rules only allows reading a
 * timetableVersion whose status is 'published', and Firestore rejects any
 * list query it can't prove is confined to readable documents. Dropping it
 * turns this into a PERMISSION_DENIED. For the same reason this is a query
 * and not a getDoc() on the id — a get() of a not-yet-created version is
 * denied too, since the rule dereferences `resource.data` on a null resource.
 */
async function getSelfPublishedVersions(uid: string) {
  const q = query(
    timetableVersionsCol(),
    where("semesterId", "==", selfImportSemesterId(uid)),
    where("status", "==", "published"),
  );
  const found = await getDocs(q);
  return found.docs.map((d) => d.data());
}
