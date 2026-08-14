import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeAll } from "vitest";
import {
  buildImportDocs,
  buildTimetableDocs,
  selfTimetableVersionId,
} from "./collegePortalImportService";
// @ts-expect-error - plain-JS mirror shipped in the extension; no type declarations by design.
import * as extensionMapping from "../../../extension/src/snapshotMapping.js";
import type { CollegePortalSnapshot, CollegePortalTimetable } from "@/types/collegePortal";

const UID = "abc123UID";
const NOW = "2026-08-14T09:00:00.000Z";

/**
 * The real ShowTimeTables response from the user's own account, parsed by the
 * extension's real parser. That parser is a plain non-module script that
 * assigns to `self`, and this half of it touches no DOM APIs (the "d"
 * envelope holds JSON here, not HTML) — so unlike parseProfileResponse it can
 * run under Node without jsdom.
 */
let timetable: CollegePortalTimetable;

interface HandyParser {
  parseTimetableResponse: (
    body: string,
    sourceUrl: string,
    capturedAt: string,
  ) => CollegePortalTimetable | null;
}

/** parser.js is an IIFE that assigns itself to `self` — there's no export to import. */
function handyParser(): HandyParser {
  return (globalThis as unknown as { HandyParser: HandyParser }).HandyParser;
}

beforeAll(async () => {
  (globalThis as { self?: unknown }).self = globalThis;
  // @ts-expect-error - plain-JS extension script; no type declarations by design.
  await import("../../../extension/src/parser.js");

  const raw = readFileSync(
    fileURLToPath(new URL("../../../extension/test/sample-timetable.json", import.meta.url)),
    "utf8",
  );
  timetable = handyParser().parseTimetableResponse(raw, "https://info.aec.edu.in/aus/x", NOW)!;
});

/** Bio + attendance values are the ones extension/test/parser.test.html asserts against the real capture. */
function makeSnapshot(withTimetable: boolean): CollegePortalSnapshot {
  return {
    rollNumber: "26B21CS058",
    studentName: "MAGAPU VIJAYA PARDHU",
    admissionNo: "AUS26-10819",
    course: "B.Tech",
    branch: "Computer Science & Engineering",
    semesterLabel: "Regular(III Semester- 2025)",
    photoUrl: "https://info.aec.edu.in/aus/student_photos/x_26B21CS058.jpg",
    gender: "Male",
    dob: "17/01/2008",
    mobileNo: "9494429963",
    email: "vijayapardhu17@gmail.com",
    attendance: {
      subjects: [
        {
          slNo: 1,
          code: "2501IT05",
          name: "Database Management Systems",
          facultyId: "5734",
          facultyName: "DR. M V B MURALI KRISHNA M",
          held: 47,
          attended: 32,
          percent: 68.09,
        },
        {
          slNo: 4,
          code: "TH26",
          name: "Technical Hour",
          facultyId: "5382",
          facultyName: "SURAMPUDI NAGENDRA GANAPATHI",
          held: 51,
          attended: 51,
          percent: 100,
        },
        {
          slNo: 8,
          code: "2501UC13",
          name: "Employability Skills-II",
          facultyId: "3581",
          facultyName: "MARNI SRINU",
          held: 0,
          attended: 0,
          percent: 0,
        },
      ],
      total: { held: 260, attended: 183, percent: 70.38 },
    },
    ...(withTimetable ? { timetable } : {}),
    capturedAt: NOW,
    sourceUrl: "https://info.aec.edu.in/aus/x",
  };
}

describe("parseTimetableResponse", () => {
  it("reads the timetable identity", () => {
    expect(timetable.ttNo).toBe(6);
    expect(timetable.name).toBe("T6(CA3)");
  });

  it("folds faculty and room into each subject and keeps the portal's own short name", () => {
    expect(timetable.subjects).toHaveLength(8);
    const adsaa = timetable.subjects.find((s) => s.code === "2501CS10");
    expect(adsaa).toEqual({
      code: "2501CS10",
      name: "Advanced Data Structures & Algorithm Analysis",
      shortName: "ADSAA",
      facultyId: "6916",
      facultyName: "PONNADA LATHA SREE",
      room: "RB-221",
    });
  });

  it("maps every slot, with dayid 1..6 landing on Monday..Saturday", () => {
    expect(timetable.slots).toHaveLength(42);

    const mondayFirst = timetable.slots.find((s) => s.dayOfWeek === 1 && s.periodNo === 1);
    expect(mondayFirst).toEqual({
      dayOfWeek: 1,
      periodNo: 1,
      startTime: "09:30",
      endTime: "10:20",
      subjectCode: "2501IT05",
      type: "lecture",
    });

    const saturdayLast = timetable.slots.find((s) => s.dayOfWeek === 6 && s.periodNo === 7);
    expect(saturdayLast?.subjectCode).toBe("2501UC13");
    expect(saturdayLast?.endTime).toBe("16:20");
  });

  it("translates the portal's subject_type codes", () => {
    const typeOf = (day: number, period: number) =>
      timetable.slots.find((s) => s.dayOfWeek === day && s.periodNo === period)?.type;
    expect(typeOf(1, 6)).toBe("lab"); // "L"
    expect(typeOf(3, 1)).toBe("technical"); // "O" — Technical Hour
    expect(typeOf(2, 1)).toBe("lecture"); // "T"
  });

  it("returns null for a body that isn't a timetable envelope", () => {
    expect(handyParser().parseTimetableResponse("not json", "u", NOW)).toBeNull();
    expect(handyParser().parseTimetableResponse(JSON.stringify({ d: "{}" }), "u", NOW)).toBeNull();
  });
});

describe("buildTimetableDocs", () => {
  it("writes one version fenced into the student's private namespace", () => {
    const { version } = buildTimetableDocs(UID, timetable, {
      department: "Computer Science & Engineering",
      effectiveFrom: "2026-08-14",
      now: NOW,
    });

    expect(version.id).toBe(`self-${UID}-tt6`);
    expect(version.doc.semesterId).toBe(`self-${UID}`);
    // Must equal the student doc's `section`, or getPublishedVersions() can't
    // match the student to this timetable.
    expect(version.doc.section).toBe("T6(CA3)");
    expect(version.doc.status).toBe("published");
    expect(version.doc.effectiveUntil).toBeNull();
  });

  it("joins entries to the same subject ids the attendance import creates", () => {
    const { entries } = buildTimetableDocs(UID, timetable, {
      department: "Computer Science & Engineering",
      effectiveFrom: "2026-08-14",
      now: NOW,
    });
    const { subjects } = buildImportDocs(UID, makeSnapshot(true), NOW);

    expect(entries).toHaveLength(42);

    const dmsSubjectId = subjects.find((s) => s.doc.code === "2501IT05")!.id;
    const mondayFirst = entries.find((e) => e.id === `self-${UID}-tt6-d1-p1`)!;
    expect(mondayFirst.doc.subjectId).toBe(dmsSubjectId);
    expect(mondayFirst.doc.facultyName).toBe("DR. M V B MURALI KRISHNA M");
    expect(mondayFirst.doc.room).toBe("RB-221");
    expect(mondayFirst.doc.active).toBe(true);
  });

  it("keys entries by day and period so a re-sync overwrites rather than duplicates", () => {
    const args = {
      department: "Computer Science & Engineering",
      effectiveFrom: "2026-08-14",
      now: NOW,
    };
    const first = buildTimetableDocs(UID, timetable, args);
    const second = buildTimetableDocs(UID, timetable, { ...args, now: "2026-09-01T00:00:00.000Z" });
    expect(second.entries.map((e) => e.id)).toEqual(first.entries.map((e) => e.id));
  });
});

describe("buildImportDocs", () => {
  it("prefers the portal's abbreviation for shortName when a timetable was captured", () => {
    const withTt = buildImportDocs(UID, makeSnapshot(true), NOW);
    const withoutTt = buildImportDocs(UID, makeSnapshot(false), NOW);

    expect(withTt.subjects.find((s) => s.doc.code === "2501UC13")!.doc.shortName).toBe("ES-II");
    // Falls back to a truncation of the full name when there's no timetable.
    expect(withoutTt.subjects.find((s) => s.doc.code === "2501UC13")!.doc.shortName).toBe(
      "Employability Ski…",
    );
  });

  it("takes the student's section from the timetable", () => {
    expect(buildImportDocs(UID, makeSnapshot(true), NOW).studentUpdate.section).toBe("T6(CA3)");
    expect(buildImportDocs(UID, makeSnapshot(false), NOW).studentUpdate.section).toBe("");
  });

  it("tags every summary as college-portal sourced, which firestore.rules requires", () => {
    const { summaries } = buildImportDocs(UID, makeSnapshot(true), NOW);
    expect(summaries).toHaveLength(3);
    expect(summaries.every((s) => s.doc.source === "collegePortal")).toBe(true);
    expect(summaries.every((s) => s.doc.studentId === UID)).toBe(true);
  });
});

/**
 * The web app and the extension import the same snapshot into the same
 * documents by two different routes (Firebase Web SDK vs REST). If these
 * mappings drift, a student's data quietly depends on which client synced
 * last — so the two implementations are compared directly.
 */
describe("extension/web mapping parity", () => {
  it("produces identical import documents", () => {
    const snapshot = makeSnapshot(true);
    expect(extensionMapping.buildImportDocs(UID, snapshot, NOW)).toEqual(
      buildImportDocs(UID, snapshot, NOW),
    );
  });

  it("produces identical import documents when no timetable was captured", () => {
    const snapshot = makeSnapshot(false);
    expect(extensionMapping.buildImportDocs(UID, snapshot, NOW)).toEqual(
      buildImportDocs(UID, snapshot, NOW),
    );
  });

  it("produces identical timetable documents", () => {
    const options = {
      department: "Computer Science & Engineering",
      effectiveFrom: "2026-08-14",
      now: NOW,
    };
    expect(extensionMapping.buildTimetableDocs(UID, timetable, options)).toEqual(
      buildTimetableDocs(UID, timetable, options),
    );
  });

  it("agrees on the private namespace and the timetable version id", () => {
    expect(extensionMapping.selfImportSemesterId(UID)).toBe(`self-${UID}`);
    // Both clients look up the existing version by this id to preserve
    // effectiveFrom, so a mismatch would silently reset the date on re-sync.
    expect(extensionMapping.selfTimetableVersionId(UID, 6)).toBe(selfTimetableVersionId(UID, 6));
    expect(extensionMapping.selfTimetableVersionId(UID, null)).toBe(selfTimetableVersionId(UID, null));
  });
});
