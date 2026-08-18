import { describe, expect, it } from "vitest";
import { codeForgeStats, getHubStatus, isCodeForgeCourse } from "./hubAttendance";
import type { HubAttendanceSnapshot, HubCourse } from "@/types/hubAttendance";

/**
 * Mirrors the CodeForge-only cases in mobile's test/parity_test.dart. A student
 * comparing their phone and the website must see the same figure, so both are
 * pinned to the same real Maya spellings from api/_hubPortal.test.js.
 */
function course(technologyName: string, courseName: string, attended: number, total: number): HubCourse {
  return {
    batchId: `b-${technologyName}`,
    technologyId: technologyName,
    courseName,
    technologyName,
    technologyIcon: null,
    modules: [],
    totalSessions: total,
    attendedSessions: attended,
    percentage: total === 0 ? null : (attended / total) * 100,
  };
}

function snapshot(courses: HubCourse[]): HubAttendanceSnapshot {
  return {
    studentName: null,
    rollNumber: null,
    courses,
    totalSessions: courses.reduce((s, c) => s + c.totalSessions, 0),
    attendedSessions: courses.reduce((s, c) => s + c.attendedSessions, 0),
    percentage: null,
    fetchedAt: "2026-08-18T00:00:00.000Z",
  };
}

describe("isCodeForgeCourse", () => {
  it("recognises every level spelling, however it is written", () => {
    for (const tech of ["CodeForge-Intermediate", "CodeForge - Beginner", "CodeForge-Advanced", "CODEFORGE"]) {
      expect(isCodeForgeCourse(course(tech, "CODEFORGE", 1, 1))).toBe(true);
    }
  });

  it("excludes the ability courses that share the Maya login", () => {
    for (const tech of ["Arithmetic Ability", "Logical Ability", "Verbal Ability"]) {
      expect(isCodeForgeCourse(course(tech, tech, 1, 1))).toBe(false);
    }
  });
});

describe("codeForgeStats", () => {
  it("counts CodeForge and nothing else", () => {
    const s = snapshot([
      course("CodeForge - Beginner", "CODEFORGE", 8, 10), // 80%
      course("CodeForge-Advanced", "CODEFORGE", 4, 10),   // 40% → CF 12/20 = 60%
      course("Arithmetic Ability", "Arithmetic Ability", 0, 20), // would drag all-courses to 30%
    ]);
    const cf = codeForgeStats(s);
    expect(cf.attendedSessions).toBe(12);
    expect(cf.totalSessions).toBe(20);
    expect(cf.percentage).toBe(60);
    expect(cf.courses).toHaveLength(2);
    expect(cf.otherCourses).toHaveLength(1);
  });

  it("returns null for a student with no CodeForge course", () => {
    const cf = codeForgeStats(snapshot([course("Verbal Ability", "Verbal Ability", 9, 10)]));
    expect(cf.percentage).toBeNull();
    expect(cf.courses).toHaveLength(0);
  });

  it("agrees with the mobile band thresholds", () => {
    expect(getHubStatus(60)).toBe("low");
    expect(getHubStatus(null)).toBe("na");
  });
});
