import { describe, expect, it } from "vitest";
import {
  buildDailyAttendanceTrend,
  dedupeMarks,
  dominantMarkStatus,
  markAttendedHeld,
} from "./attendanceMarks";
import type { AttendanceMarkDoc } from "@/types/attendanceMark";

function mark(status: AttendanceMarkDoc["status"], startTime = "09:00"): AttendanceMarkDoc {
  return { id: "x", studentId: "s1", subjectId: "sub1", date: "2026-01-01", startTime, status, periods: 1 };
}

function markOn(
  date: string,
  status: AttendanceMarkDoc["status"],
  subjectId = "sub1",
  startTime = "09:00",
): AttendanceMarkDoc {
  return { id: `${date}-${subjectId}-${startTime}`, studentId: "s1", subjectId, date, startTime, status, periods: 1 };
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

describe("buildDailyAttendanceTrend — the Home 'Needs Attention' tip's day-by-day tracker", () => {
  const dates = ["2026-01-01", "2026-01-02", "2026-01-03"];

  it("reports one point per date supplied, in that order", () => {
    const points = buildDailyAttendanceTrend([], dates);
    expect(points.map((p) => p.date)).toEqual(dates);
  });

  it("a date with no marks is a gap (null), not 0% — no classes isn't the same as missing every class", () => {
    const points = buildDailyAttendanceTrend([], dates);
    expect(points.every((p) => p.percentage === null && p.attended === 0 && p.held === 0)).toBe(true);
  });

  it("computes a real percentage for a date across multiple subjects", () => {
    const marks = [
      markOn("2026-01-02", "present", "sub1"),
      markOn("2026-01-02", "absent", "sub2"),
      markOn("2026-01-02", "present", "sub3"),
    ];
    const points = buildDailyAttendanceTrend(marks, dates);
    const jan2 = points.find((p) => p.date === "2026-01-02")!;
    expect(jan2).toEqual({ date: "2026-01-02", attended: 2, held: 3, percentage: 66.67 });
  });

  it("excludes cancelled marks from a day's held count, same as markAttendedHeld", () => {
    const marks = [markOn("2026-01-01", "cancelled")];
    const points = buildDailyAttendanceTrend(marks, dates);
    expect(points[0]).toEqual({ date: "2026-01-01", attended: 0, held: 0, percentage: null });
  });

  it("ignores marks outside the supplied date list", () => {
    const marks = [markOn("2026-02-15", "present")];
    const points = buildDailyAttendanceTrend(marks, dates);
    expect(points.every((p) => p.held === 0)).toBe(true);
  });
});

describe("dedupeMarks — the two id schemes that used to double-count", () => {
  /** The same class, written by each platform under its own old id. */
  function pair(status: AttendanceMarkDoc["status"], updatedAt?: string) {
    return {
      web: { id: "s1_sub1_2026-01-01_09:00", studentId: "s1", subjectId: "sub1", date: "2026-01-01", startTime: "09:00", status, periods: 1, updatedAt },
      app: { id: "s1-sub1-2026-01-01-0900", studentId: "s1", subjectId: "sub1", date: "2026-01-01", startTime: "09:00", status, periods: 1, updatedAt },
    };
  }

  it("collapses the same class written under both id schemes", () => {
    const { web, app } = pair("present");
    expect(dedupeMarks([web, app])).toHaveLength(1);
    // Which is the point: held would otherwise be 2 for one class.
    expect(markAttendedHeld(dedupeMarks([web, app]))).toEqual({ attended: 1, held: 1 });
  });

  it("keeps genuinely different classes apart", () => {
    const nine = markOn("2026-01-01", "present", "sub1", "09:00");
    const ten = markOn("2026-01-01", "present", "sub1", "10:00");
    const other = markOn("2026-01-01", "present", "sub2", "09:00");
    const nextDay = markOn("2026-01-02", "present", "sub1", "09:00");
    expect(dedupeMarks([nine, ten, other, nextDay])).toHaveLength(4);
  });

  it("the most recently written wins a disagreement", () => {
    const older = { ...pair("present").app, updatedAt: "2026-01-01T09:00:00.000Z" };
    const newer = { ...pair("absent").web, updatedAt: "2026-01-02T09:00:00.000Z" };
    expect(dedupeMarks([older, newer])[0].status).toBe("absent");
    // Order of arrival must not change the answer.
    expect(dedupeMarks([newer, older])[0].status).toBe("absent");
  });

  it("a mark that says when it was written beats one that does not", () => {
    const undated = pair("present").app;
    const dated = { ...pair("absent").web, updatedAt: "2026-01-02T09:00:00.000Z" };
    expect(dedupeMarks([undated, dated])[0].status).toBe("absent");
  });

  it("falls back to the greater id, so both platforms pick the same winner", () => {
    // "s1_sub1..." > "s1-sub1..." because "_" (0x5f) sorts above "-" (0x2d).
    const { web, app } = pair("present");
    expect(dedupeMarks([{ ...app, status: "absent" }, web])[0].id).toBe(web.id);
    expect(dedupeMarks([web, { ...app, status: "absent" }])[0].id).toBe(web.id);
  });

  it("is a no-op on marks with nothing duplicated", () => {
    expect(dedupeMarks([])).toEqual([]);
    const one = markOn("2026-01-01", "present");
    expect(dedupeMarks([one])).toEqual([one]);
  });
});
