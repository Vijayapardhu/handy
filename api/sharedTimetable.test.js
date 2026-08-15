import { describe, expect, it } from "vitest";

import { diffTimetables, timetableFingerprint } from "./_sharedTimetable.js";

const slot = (dayOfWeek, startTime, subjectCode, room, facultyName = "DR. M") => ({
  dayOfWeek,
  startTime,
  endTime: "10:20",
  subjectCode,
  room,
  facultyName,
});

describe("timetableFingerprint", () => {
  it("ignores the order the portal happens to send slots in", () => {
    const a = { slots: [slot(1, "09:30", "CS10", "RB-221"), slot(2, "11:20", "IT05", "RB-301")] };
    const b = { slots: [slot(2, "11:20", "IT05", "RB-301"), slot(1, "09:30", "CS10", "RB-221")] };
    // Without sorting before hashing, a reshuffle would notify fifty students
    // that nothing had changed.
    expect(timetableFingerprint(a)).toBe(timetableFingerprint(b));
  });

  it("changes when a room moves", () => {
    const before = { slots: [slot(1, "09:30", "CS10", "RB-221")] };
    const after = { slots: [slot(1, "09:30", "CS10", "AGBI-2.1")] };
    expect(timetableFingerprint(before)).not.toBe(timetableFingerprint(after));
  });

  it("treats an empty timetable as a value rather than throwing", () => {
    expect(timetableFingerprint({})).toBe(timetableFingerprint({ slots: [] }));
  });
});

describe("diffTimetables", () => {
  it("names the slot that moved room, with both sides", () => {
    const changes = diffTimetables(
      { slots: [slot(1, "09:30", "CS10", "RB-221")] },
      { slots: [slot(1, "09:30", "CS10", "AGBI-2.1")] },
    );

    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe("changed");
    expect(changes[0].where).toBe("Monday 09:30");
    expect(changes[0].from).toContain("RB-221");
    expect(changes[0].to).toContain("AGBI-2.1");
  });

  it("reports an added slot and a removed one separately", () => {
    const changes = diffTimetables(
      { slots: [slot(1, "09:30", "CS10", "RB-221")] },
      { slots: [slot(2, "11:20", "IT05", "RB-301")] },
    );

    expect(changes.map((c) => c.kind).sort()).toEqual(["added", "removed"]);
    expect(changes.find((c) => c.kind === "added").where).toBe("Tuesday 11:20");
    expect(changes.find((c) => c.kind === "removed").where).toBe("Monday 09:30");
  });

  it("notices a faculty change even when the room is unchanged", () => {
    const changes = diffTimetables(
      { slots: [slot(3, "13:00", "IT07", "RB-301", "MARNI SRINU")] },
      { slots: [slot(3, "13:00", "IT07", "RB-301", "DR. K RAO")] },
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].to).toContain("DR. K RAO");
  });

  it("says nothing changed when nothing did", () => {
    const same = { slots: [slot(1, "09:30", "CS10", "RB-221")] };
    expect(diffTimetables(same, same)).toEqual([]);
  });
});
