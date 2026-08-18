import { describe, expect, it } from "vitest";
import { classBlocksForDay, getFreePeriods, getWeeklyFreePeriods } from "./timetable";
import type { DayOfWeek, TimetableEntryDoc } from "@/types/timetable";

/**
 * Free periods are the gaps a student plans coursework around, so they have to
 * be derived rather than guessed: the portal sends rows only for periods that
 * are taught, and the times for a missing period come from the same period on
 * another day.
 */
function entry(
  dayOfWeek: DayOfWeek,
  periodNo: number,
  startTime: string,
  endTime: string,
  subjectId = "sub1",
): TimetableEntryDoc {
  return {
    id: `d${dayOfWeek}-p${periodNo}`,
    timetableVersionId: "v1",
    dayOfWeek,
    periodNo,
    startTime,
    endTime,
    subjectId,
    facultyId: "1",
    facultyName: "Faculty",
    room: "RB-221",
    block: "Ramanujan Bhavan",
    type: "lecture",
    active: true,
  };
}

// Monday has periods 1-3, Tuesday only 1 and 3 — so Tuesday period 2 is free.
const WEEK: TimetableEntryDoc[] = [
  entry(1, 1, "09:30", "10:20"),
  entry(1, 2, "10:30", "11:20"),
  entry(1, 3, "11:20", "12:10"),
  entry(2, 1, "09:30", "10:20"),
  entry(2, 3, "11:20", "12:10"),
];

describe("getFreePeriods", () => {
  it("finds the gap and recovers its time from another day", () => {
    expect(getFreePeriods(WEEK, 2)).toEqual([{ periodNo: 2, startTime: "10:30", endTime: "11:20" }]);
  });

  it("returns nothing for a fully booked day", () => {
    expect(getFreePeriods(WEEK, 1)).toEqual([]);
  });

  it("treats a day with no classes as entirely free", () => {
    expect(getFreePeriods(WEEK, 4).map((f) => f.periodNo)).toEqual([1, 2, 3]);
  });

  it("ignores inactive entries, so a retired class still frees its slot", () => {
    const withRetired = [...WEEK, { ...entry(2, 2, "10:30", "11:20"), active: false }];
    expect(getFreePeriods(withRetired, 2).map((f) => f.periodNo)).toEqual([2]);
  });

  it("orders gaps by time, not period number", () => {
    const free = getFreePeriods(WEEK, 4);
    expect(free.map((f) => f.startTime)).toEqual(["09:30", "10:30", "11:20"]);
  });
});

describe("getWeeklyFreePeriods", () => {
  it("reports only days that actually have classes", () => {
    const weekly = getWeeklyFreePeriods(WEEK);
    expect([...weekly.keys()]).toEqual([1, 2]);
    expect(weekly.get(1)).toEqual([]);
    expect(weekly.get(2)?.map((f) => f.periodNo)).toEqual([2]);
  });
});

describe("classBlocksForDay", () => {
  it("merges back-to-back periods of the same subject into one block", () => {
    const day: TimetableEntryDoc[] = [
      entry(3, 1, "09:00", "09:50", "lab101"),
      entry(3, 2, "09:50", "10:40", "lab101"),
      entry(3, 3, "10:40", "11:30", "lab101"),
    ];
    const blocks = classBlocksForDay(day, 3);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].entries).toHaveLength(3);
  });

  it("keeps a subject change as a separate block, even with no gap", () => {
    const day: TimetableEntryDoc[] = [
      entry(3, 1, "09:00", "09:50", "maths"),
      entry(3, 2, "09:50", "10:40", "physics"),
    ];
    const blocks = classBlocksForDay(day, 3);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].entries).toHaveLength(1);
    expect(blocks[1].entries).toHaveLength(1);
  });

  it("keeps a morning and afternoon sitting of the same subject apart across a real gap", () => {
    const day: TimetableEntryDoc[] = [
      entry(3, 1, "09:00", "09:50", "maths"),
      entry(3, 5, "14:00", "14:50", "maths"),
    ];
    const blocks = classBlocksForDay(day, 3);
    expect(blocks).toHaveLength(2);
  });

  it("tolerates a short changeover gap (portal periods rarely butt up to the exact minute)", () => {
    const day: TimetableEntryDoc[] = [
      entry(3, 1, "09:00", "09:50", "maths"),
      entry(3, 2, "10:00", "10:50", "maths"), // 10 minute gap
    ];
    expect(classBlocksForDay(day, 3)).toHaveLength(1);
  });

  it("does not merge across a gap longer than the tolerance", () => {
    const day: TimetableEntryDoc[] = [
      entry(3, 1, "09:00", "09:50", "maths"),
      entry(3, 2, "10:20", "11:10", "maths"), // 30 minute gap
    ];
    expect(classBlocksForDay(day, 3)).toHaveLength(2);
  });

  it("returns nothing for a day with no classes", () => {
    expect(classBlocksForDay(WEEK, 4)).toEqual([]);
  });
});
