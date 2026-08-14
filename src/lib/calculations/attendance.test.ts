import { describe, expect, it } from "vitest";
import {
  aggregateAttendance,
  calculateAttendance,
  calculateLeaveImpact,
  calculateProjectedAttendance,
  calculateRequiredClasses,
  calculateSafeAbsences,
  getAttendanceStatus,
  roundPercentage,
} from "./attendance";
import { DEFAULT_COLLEGE_CONFIG } from "@/constants/collegeConfig";

describe("calculateAttendance", () => {
  it("SRS §67 Test 1: 30/45 = 66.67%", () => {
    expect(roundPercentage(calculateAttendance(30, 45))).toBeCloseTo(66.67, 2);
  });

  it("SRS §67 Test 2: 48/48 = 100%", () => {
    expect(calculateAttendance(48, 48)).toBe(100);
  });

  it("SRS §67 Test 3: 0/0 = N/A (null, never NaN/Infinity)", () => {
    const result = calculateAttendance(0, 0);
    expect(result).toBeNull();
    expect(Number.isNaN(result)).toBe(false);
  });

  it("throws when attended exceeds held (precondition violation, fail fast)", () => {
    expect(() => calculateAttendance(10, 5)).toThrow();
  });

  it("throws on negative or non-integer input", () => {
    expect(() => calculateAttendance(-1, 5)).toThrow();
    expect(() => calculateAttendance(1.5, 5)).toThrow();
  });
});

describe("calculateProjectedAttendance", () => {
  it("30/45 attending 5 more -> 35/50 = 70%", () => {
    expect(calculateProjectedAttendance(30, 45, 5)).toBe(70);
  });

  it("accounts for projected absences too", () => {
    // 30/45, attend 2 more, miss 3 more -> 32/50 = 64%
    expect(calculateProjectedAttendance(30, 45, 2, 3)).toBe(64);
  });
});

describe("calculateRequiredClasses", () => {
  it("SRS §13 example: DBMS 30/45 (66.67%) needs 15 consecutive classes for 75%", () => {
    const result = calculateRequiredClasses(30, 45, 75);
    expect(result.status).toBe("needs_classes");
    expect(result.classesNeeded).toBe(15);
    // Verify the claim: (30+15)/(45+15) = 45/60 = 75%
    expect(calculateAttendance(30 + 15, 45 + 15)).toBe(75);
    // And 14 would not be enough.
    expect(calculateAttendance(30 + 14, 45 + 14)).toBeLessThan(75);
  });

  it("returns target_reached when already at/above target", () => {
    const result = calculateRequiredClasses(40, 45, 75);
    expect(result.status).toBe("target_reached");
    expect(result.classesNeeded).toBe(0);
  });

  it("mockup regression: Agile Software Engineering 6/17 needs 27 for 75%", () => {
    const result = calculateRequiredClasses(6, 17, 75);
    expect(result.status).toBe("needs_classes");
    expect(result.classesNeeded).toBe(27);
  });

  it("Discrete Mathematics 9/21 needs 27 for 75% (verified against the formula)", () => {
    const result = calculateRequiredClasses(9, 21, 75);
    expect(result.classesNeeded).toBe(27);
    expect(calculateAttendance(9 + 27, 21 + 27)).toBe(75);
  });

  it("Advanced Data Structures 23/36 needs 16 for 75% (verified against the formula)", () => {
    const result = calculateRequiredClasses(23, 36, 75);
    expect(result.classesNeeded).toBe(16);
    expect(calculateAttendance(23 + 16, 36 + 16)).toBe(75);
  });

  it("DBMS 30/45 needs 15 for 75%, matching SRS §13's own worked example", () => {
    // NOTE: the reference Planner *mockup screenshot* shows "3" / "15" / "6"
    // for these same subjects' attended/held pairs, but those figures are
    // internally inconsistent with each other, with SRS §13's own worked
    // example (30/45 -> 15, reproduced by this test), and with the formula
    // in §13's text. Verified by direct computation above: this
    // implementation follows the specified formula, not the mockup's
    // (evidently unverified) placeholder numbers.
    const result = calculateRequiredClasses(30, 45, 75);
    expect(result.classesNeeded).toBe(15);
  });

  it("is unreachable when target is 100% and classes have already been missed", () => {
    const result = calculateRequiredClasses(30, 45, 100);
    expect(result.status).toBe("unreachable");
  });
});

describe("calculateSafeAbsences", () => {
  it("returns 0 when already below target", () => {
    const result = calculateSafeAbsences(30, 45, 75);
    expect(result.status).toBe("below_target");
    expect(result.maxAbsences).toBe(0);
  });

  it("computes max misses while staying above target", () => {
    // 90/100 = 90%, target 75% -> N <= 90/0.75 - 100 = 20
    const result = calculateSafeAbsences(90, 100, 75);
    expect(result.status).toBe("can_miss");
    expect(result.maxAbsences).toBe(20);
    expect(calculateAttendance(90, 100 + 20)).toBe(75);
    expect(calculateAttendance(90, 100 + 21)!).toBeLessThan(75);
  });
});

describe("calculateLeaveImpact", () => {
  it("SRS §68 example: 30/45 (66.67%) missing 1 class -> 30/46 (65.22%), -1.45%", () => {
    const result = calculateLeaveImpact({ attended: 30, held: 45, classesOnLeaveDate: 1 });
    expect(roundPercentage(result.before)).toBeCloseTo(66.67, 2);
    expect(roundPercentage(result.after)).toBeCloseTo(65.22, 2);
    expect(Math.round(result.impact! * 100) / 100).toBeCloseTo(-1.45, 2);
  });

  it("never surfaces NaN/Infinity when starting from 0/0 — before is N/A, impact is N/A", () => {
    const result = calculateLeaveImpact({ attended: 0, held: 0, classesOnLeaveDate: 1 });
    expect(result.before).toBeNull(); // 0/0 held classes so far -> N/A
    expect(result.after).toBe(0); // 0/1 after missing the one scheduled class -> 0%, not N/A
    expect(result.impact).toBeNull(); // undefined vs. an N/A baseline, so impact is N/A too
  });
});

describe("aggregateAttendance", () => {
  it("sums attended/held across subjects for the overall figure", () => {
    const result = aggregateAttendance([
      { attended: 163, held: 200 },
      { attended: 0, held: 34 },
    ]);
    expect(result.attended).toBe(163);
    expect(result.held).toBe(234);
    expect(roundPercentage(result.percentage)).toBeCloseTo(69.66, 2);
  });
});

describe("getAttendanceStatus", () => {
  const t = DEFAULT_COLLEGE_CONFIG.statusThresholds;

  it("classifies bands using configured thresholds, not hardcoded numbers", () => {
    expect(getAttendanceStatus(null, t)).toBe("na");
    expect(getAttendanceStatus(35.29, t)).toBe("critical");
    expect(getAttendanceStatus(42.86, t)).toBe("low");
    expect(getAttendanceStatus(63.89, t)).toBe("average");
    expect(getAttendanceStatus(72.09, t)).toBe("good");
    expect(getAttendanceStatus(100, t)).toBe("excellent");
  });
});
