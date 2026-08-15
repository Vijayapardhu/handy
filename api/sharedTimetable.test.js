import { describe, expect, it } from "vitest";

import { changesFor, diffTimetables, timetableFingerprint } from "./_sharedTimetable.js";

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
    // Without sorting before hashing, a reshuffle would notify a whole class
    // that nothing had changed.
    expect(timetableFingerprint(a)).toBe(timetableFingerprint(b));
  });

  it("changes when a room moves", () => {
    expect(timetableFingerprint({ slots: [slot(1, "09:30", "CS10", "RB-221")] })).not.toBe(
      timetableFingerprint({ slots: [slot(1, "09:30", "CS10", "AGBI-2.1")] }),
    );
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

  it("carries the slot key, which is what recipients are matched on", () => {
    const [change] = diffTimetables(
      { slots: [slot(1, "09:30", "CS10", "RB-221")] },
      { slots: [slot(1, "09:30", "CS10", "AGBI-2.1")] },
    );
    expect(change.key).toBe("1@09:30");
  });

  it("reports an added slot and a removed one separately", () => {
    const changes = diffTimetables(
      { slots: [slot(1, "09:30", "CS10", "RB-221")] },
      { slots: [slot(2, "11:20", "IT05", "RB-301")] },
    );

    expect(changes.map((c) => c.kind).sort()).toEqual(["added", "removed"]);
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

describe("changesFor", () => {
  // The case this whole model exists for: two students on one timetable id,
  // differing in a single period because they picked different electives.
  const changes = diffTimetables(
    {
      slots: [
        slot(1, "09:30", "CS10", "RB-221"),
        slot(1, "10:30", "ELEC-A", "RB-101", "DR. RAO"),
      ],
    },
    {
      slots: [
        slot(1, "09:30", "CS10", "AGBI-2.1"),
        slot(1, "10:30", "ELEC-A", "RB-105", "DR. RAO"),
      ],
    },
  );

  it("tells a classmate about the slots they actually share", () => {
    const classmate = [
      slot(1, "09:30", "CS10", "RB-221"),
      slot(1, "10:30", "ELEC-A", "RB-101", "DR. RAO"),
    ];
    expect(changesFor(classmate, changes).map((c) => c.where)).toEqual([
      "Monday 09:30",
      "Monday 10:30",
    ]);
  });

  it("keeps a different elective out of it, while still sharing the rest", () => {
    // Same timetable id, same 09:30 lecture, but a different subject at 10:30.
    const otherElective = [
      slot(1, "09:30", "CS10", "RB-221"),
      slot(1, "10:30", "ELEC-B", "RB-207", "DR. SINGH"),
    ];
    const theirs = changesFor(otherElective, changes);

    expect(theirs.map((c) => c.where)).toEqual(["Monday 09:30"]);
    // Announcing the elective move to them would be confidently wrong: they
    // have a class at that time, just not that one.
    expect(theirs.some((c) => c.where === "Monday 10:30")).toBe(false);
  });

  it("tells nobody who shares none of it", () => {
    const unrelated = [slot(4, "14:00", "OTHER", "RB-999")];
    expect(changesFor(unrelated, changes)).toEqual([]);
  });

  it("matches on content, not only on the time", () => {
    // Right period, right subject, but a different lecturer — a separate
    // class that happens to run at the same hour.
    const sameHourDifferentClass = [slot(1, "09:30", "CS10", "RB-330", "DR. OTHER")];
    expect(changesFor(sameHourDifferentClass, changes)).toEqual([]);
  });

  it("announces an added slot to whoever has nothing at that time", () => {
    const added = diffTimetables(
      { slots: [] },
      { slots: [slot(5, "15:00", "NEW01", "RB-410")] },
    );
    expect(changesFor([], added)).toHaveLength(1);
    // Someone already booked at that hour is in a different class and is not
    // gaining this one.
    expect(changesFor([slot(5, "15:00", "OTHER", "RB-1")], added)).toEqual([]);
  });

  it("survives a member with no stored slots", () => {
    expect(changesFor(undefined, changes)).toEqual([]);
  });
});
