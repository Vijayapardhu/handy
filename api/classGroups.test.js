import { describe, expect, it } from "vitest";

import { classGroupKey, groupsForTimetable } from "./_classGroups.js";

describe("classGroupKey", () => {
  it("is the same for two students in the same room", () => {
    // Different accounts, different devices, no coordination — the portal's
    // own values are what make the keys agree.
    expect(classGroupKey({ timetableId: 6, subjectCode: "2501AI06", facultyId: 3202 })).toBe(
      classGroupKey({ timetableId: "6", subjectCode: "2501ai06", facultyId: "3202" }),
    );
  });

  it("separates the two halves of a split subject", () => {
    // The real case: DAE splits 72 students between two lecturers, and an
    // announcement for one room must never reach the other.
    const vydehi = classGroupKey({ timetableId: 6, subjectCode: "2501AI06", facultyId: 3202 });
    const satyavathi = classGroupKey({ timetableId: 6, subjectCode: "2501AI06", facultyId: 6768 });
    expect(vydehi).not.toBe(satyavathi);
  });

  it("separates the same subject on different timetables", () => {
    expect(classGroupKey({ timetableId: 6, subjectCode: "CS10", facultyId: 1 })).not.toBe(
      classGroupKey({ timetableId: 7, subjectCode: "CS10", facultyId: 1 }),
    );
  });

  it("refuses a half-identified group rather than guessing", () => {
    // A partial key would silently merge two rooms, and the symptom would be
    // announcements reaching strangers.
    expect(classGroupKey({ timetableId: 6, subjectCode: "CS10" })).toBeNull();
    expect(classGroupKey({ timetableId: 6, facultyId: 3202 })).toBeNull();
    expect(classGroupKey({ subjectCode: "CS10", facultyId: 3202 })).toBeNull();
    expect(classGroupKey({ timetableId: "  ", subjectCode: "CS10", facultyId: 1 })).toBeNull();
  });
});

describe("groupsForTimetable", () => {
  const timetable = {
    ttNo: 6,
    subjects: [
      { code: "2501AI06", facultyId: 3202 },
      { code: "2501CS08", facultyId: 5616 },
    ],
    slots: [
      { dayOfWeek: 3, startTime: "14:50", subjectCode: "2501AI06" },
      { dayOfWeek: 3, startTime: "15:40", subjectCode: "2501AI06" },
      { dayOfWeek: 1, startTime: "14:50", subjectCode: "2501CS08" },
    ],
  };

  it("gives one group per class, not one per period", () => {
    // A subject meeting three times a week is one room, not three.
    expect(groupsForTimetable(timetable)).toEqual(["6-2501AI06-3202", "6-2501CS08-5616"]);
  });

  it("skips a slot whose subject it cannot identify", () => {
    const orphan = { ...timetable, slots: [...timetable.slots, { dayOfWeek: 5, subjectCode: "???" }] };
    expect(groupsForTimetable(orphan)).toHaveLength(2);
  });

  it("returns nothing for an empty timetable rather than throwing", () => {
    expect(groupsForTimetable({})).toEqual([]);
    expect(groupsForTimetable(null)).toEqual([]);
  });
});
