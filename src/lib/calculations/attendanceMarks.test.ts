import { describe, expect, it } from "vitest";
import { calculateMarkStreak, dominantMarkStatus, markAttendedHeld } from "./attendanceMarks";
import type { AttendanceMarkDoc } from "@/types/attendanceMark";

function mark(status: AttendanceMarkDoc["status"], startTime = "09:00"): AttendanceMarkDoc {
  return { id: "x", studentId: "s1", subjectId: "sub1", date: "2026-01-01", startTime, status, periods: 1 };
}

describe("dominantMarkStatus", () => {
  it("returns null for an empty day", () => {
    expect(dominantMarkStatus([])).toBeNull();
  });

  it("ignores cancelled marks entirely — a cancelled-only day has no opinion", () => {
    expect(dominantMarkStatus([mark("cancelled")])).toBeNull();
  });

  it("absent wins over present on the same day", () => {
    expect(dominantMarkStatus([mark("present", "09:00"), mark("absent", "10:00")])).toBe("absent");
  });

  it("a cancelled mark alongside a real one doesn't change the outcome", () => {
    expect(dominantMarkStatus([mark("present", "09:00"), mark("cancelled", "10:00")])).toBe("present");
  });
});

describe("calculateMarkStreak — the function StreakCard now actually depends on", () => {
  it("counts consecutive non-absent days", () => {
    const days = [
      { date: "2026-01-03", marks: [mark("present")] },
      { date: "2026-01-02", marks: [mark("present")] },
      { date: "2026-01-01", marks: [mark("present")] },
    ];
    expect(calculateMarkStreak(days)).toBe(3);
  });

  it("stops at the first absence", () => {
    const days = [
      { date: "2026-01-03", marks: [mark("present")] },
      { date: "2026-01-02", marks: [mark("absent")] },
      { date: "2026-01-01", marks: [mark("present")] },
    ];
    expect(calculateMarkStreak(days)).toBe(1);
  });

  it("a cancelled-only day is skipped, not counted — the streak reflects only the real present days", () => {
    // Two actual present days plus one day with nothing to count is a streak
    // of 2, not 3: the cancelled day has no attendance to add, it just also
    // doesn't subtract any. Confirms "neither breaks nor extends" precisely —
    // an earlier version of this test asserted 3, which would mean a
    // cancelled day silently counts as if it were attended.
    const days = [
      { date: "2026-01-03", marks: [mark("present")] },
      { date: "2026-01-02", marks: [mark("cancelled")] },
      { date: "2026-01-01", marks: [mark("present")] },
    ];
    expect(calculateMarkStreak(days)).toBe(2);
  });

  it("is 0 with no marks at all", () => {
    expect(calculateMarkStreak([])).toBe(0);
  });
});

describe("markAttendedHeld", () => {
  it("counts present toward both attended and held", () => {
    expect(markAttendedHeld([mark("present")])).toEqual({ attended: 1, held: 1 });
  });

  it("counts absent toward held only", () => {
    expect(markAttendedHeld([mark("absent")])).toEqual({ attended: 0, held: 1 });
  });

  it("counts cancelled toward neither — the whole reason it's a third state", () => {
    expect(markAttendedHeld([mark("cancelled")])).toEqual({ attended: 0, held: 0 });
  });

  it("mixes correctly across several marks", () => {
    const marks = [mark("present", "09:00"), mark("absent", "10:00"), mark("cancelled", "11:00")];
    expect(markAttendedHeld(marks)).toEqual({ attended: 1, held: 2 });
  });
});
