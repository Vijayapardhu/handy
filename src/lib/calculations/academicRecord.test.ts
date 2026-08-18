import { describe, expect, it } from "vitest";
import { parseGradeNumber, projectRequiredSgpa } from "./academicRecord";

describe("parseGradeNumber", () => {
  it("parses a numeric string", () => {
    expect(parseGradeNumber("8.45")).toBe(8.45);
  });

  it("returns null for the portal's 'nothing to report' value", () => {
    expect(parseGradeNumber("N/A")).toBeNull();
  });

  it("returns null for empty, null and undefined", () => {
    expect(parseGradeNumber("")).toBeNull();
    expect(parseGradeNumber(null)).toBeNull();
    expect(parseGradeNumber(undefined)).toBeNull();
  });
});

describe("projectRequiredSgpa", () => {
  it("computes the average SGPA needed across the remaining semesters", () => {
    // 2 semesters at 7.0 (sum 14), want 8.0 overall across 8 semesters (sum 64) —
    // 6 semesters left need to sum to 50, i.e. average 8.33.
    const result = projectRequiredSgpa(7.0, 2, 8, 8.0);
    expect(result.neededAverageSgpa).toBeCloseTo(8.33, 2);
    expect(result.alreadyMet).toBe(false);
    expect(result.impossible).toBe(false);
  });

  it("reports already met when the banked total alone already clears the target", () => {
    // Banked 7 semesters at 9.8 (68.6) already exceeds 8 semesters at 8.5 (68) —
    // even a 0 in the last semester wouldn't drop the target below reach.
    const result = projectRequiredSgpa(9.8, 7, 8, 8.5);
    expect(result.neededAverageSgpa).toBe(0);
    expect(result.alreadyMet).toBe(true);
    expect(result.impossible).toBe(false);
  });

  it("flags an unreachable target — needed average exceeds the 10-point scale", () => {
    const result = projectRequiredSgpa(4.0, 6, 8, 9.5);
    expect(result.impossible).toBe(true);
    expect(result.neededAverageSgpa).toBeGreaterThan(10);
  });

  it("handles no semesters remaining — the answer is just whether the target was met", () => {
    const met = projectRequiredSgpa(8.5, 8, 8, 8.0);
    expect(met).toEqual({ neededAverageSgpa: null, alreadyMet: true, impossible: false });

    const missed = projectRequiredSgpa(7.5, 8, 8, 8.0);
    expect(missed).toEqual({ neededAverageSgpa: null, alreadyMet: false, impossible: true });
  });

  it("a target already exactly on track needs exactly the target average", () => {
    const result = projectRequiredSgpa(8.0, 4, 8, 8.0);
    expect(result.neededAverageSgpa).toBe(8);
  });
});
