import { describe, expect, it } from "vitest";
import { daysToAttend, shortWhen } from "./planning";
import type { DayOfWeek, TimetableEntryDoc } from "@/types/timetable";

function entry(
  dayOfWeek: DayOfWeek,
  startTime: string,
  endTime: string,
  subjectId = "sub1",
  type: TimetableEntryDoc["type"] = "lecture",
): TimetableEntryDoc {
  return {
    id: `d${dayOfWeek}-${startTime}`,
    timetableVersionId: "v1",
    dayOfWeek,
    periodNo: 1,
    startTime,
    endTime,
    subjectId,
    facultyId: "1",
    facultyName: "Faculty",
    room: "101",
    block: "Block",
    type,
    active: true,
  };
}

describe("daysToAttend", () => {
  // Wednesday, 2026-08-19 for stable weekday arithmetic in every test below.
  const from = "2026-08-19";

  it("returns null for zero or negative classes needed", () => {
    expect(daysToAttend(0, [entry(4, "09:00", "09:50")], from)).toBeNull();
    expect(daysToAttend(-1, [entry(4, "09:00", "09:50")], from)).toBeNull();
  });

  it("returns null when the subject never meets", () => {
    const entries = [entry(4, "09:00", "09:50", "other-subject")];
    expect(daysToAttend(2, entries, from, { subjectId: "sub1" })).toBeNull();
  });

  it("walks forward to the day the count is reached, once a week", () => {
    // Thursdays only — the next three Thursdays after 2026-08-19 are Aug 20, 27, Sep 3.
    const entries = [entry(4, "09:00", "09:50")];
    const result = daysToAttend(3, entries, from);
    expect(result).toEqual({ days: 3, on: "2026-09-03" });
  });

  it("counts multiple periods on the same day toward the total", () => {
    // Two periods every Thursday — 3 classes needed clears on the second Thursday.
    const entries = [entry(4, "09:00", "09:50"), entry(4, "10:00", "10:50")];
    const result = daysToAttend(3, entries, from);
    expect(result).toEqual({ days: 2, on: "2026-08-27" });
  });

  it("ignores inactive entries", () => {
    const entries = [entry(4, "09:00", "09:50"), { ...entry(4, "10:00", "10:50"), active: false }];
    const result = daysToAttend(2, entries, from);
    // Only one active period a week, so the 2nd class needs a 2nd Thursday.
    expect(result).toEqual({ days: 2, on: "2026-08-27" });
  });

  it("filters to one subject when subjectId is given", () => {
    const entries = [entry(4, "09:00", "09:50", "sub1"), entry(4, "10:00", "10:50", "sub2")];
    const result = daysToAttend(2, entries, from, { subjectId: "sub1" });
    expect(result).toEqual({ days: 2, on: "2026-08-27" });
  });

  it("filters to one entry type when type is given", () => {
    const entries = [
      entry(4, "09:00", "09:50", "sub1", "lecture"),
      entry(4, "10:00", "10:50", "sub1", "technical"),
    ];
    const result = daysToAttend(2, entries, from, { type: "technical" });
    expect(result).toEqual({ days: 2, on: "2026-08-27" });
  });

  it("returns null when it would take longer than the horizon", () => {
    const entries = [entry(4, "09:00", "09:50")];
    expect(daysToAttend(1000, entries, from, { horizonDays: 30 })).toBeNull();
  });
});

describe("shortWhen", () => {
  const today = "2026-08-19"; // a Wednesday

  it("says tomorrow for one day ahead", () => {
    expect(shortWhen("2026-08-20", today)).toBe("tomorrow");
  });

  it("names the weekday for 2-6 days ahead", () => {
    expect(shortWhen("2026-08-22", today)).toBe("Sat");
  });

  it("falls back to a short date a week or more out", () => {
    expect(shortWhen("2026-08-26", today)).toBe("26 Aug");
  });
});
