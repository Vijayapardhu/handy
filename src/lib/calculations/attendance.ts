/**
 * Centralized, pure attendance calculation functions (SRS §11, §12, §13, §14, §41).
 *
 * Rules:
 *  - No component or service may recompute a percentage, required-class count,
 *    or safe-absence count itself — everything routes through here.
 *  - These are pure functions: no I/O, no Firestore, no dates-as-"today" magic.
 *  - 0/0 must never surface as NaN% or Infinity% (SRS §67 Test 3) — callers get
 *    `null` back and are responsible for rendering an "N/A" state.
 */
import type { AttendanceStatus } from "@/types/attendance";

/** Statuses that count toward "attended" in the attended/held ratio (single source of truth). */
export const ATTENDED_STATUSES: ReadonlySet<AttendanceStatus> = new Set(["present", "excused"]);

export interface AttendedHeld {
  attended: number;
  held: number;
}

function assertNonNegativeInt(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error(`${label} must be a non-negative integer, received ${value}`);
  }
}

/**
 * attendancePercentage = (attended / held) * 100
 * Returns null when held is 0 (no classes have occurred yet) rather than NaN.
 */
export function calculateAttendance(attended: number, held: number): number | null {
  assertNonNegativeInt(attended, "attended");
  assertNonNegativeInt(held, "held");
  if (attended > held) {
    throw new Error(`attended (${attended}) cannot exceed held (${held})`);
  }
  if (held === 0) return null;
  return (attended / held) * 100;
}

/**
 * Rounds a percentage to 2 decimal places for display. Pass-through for null.
 */
export function roundPercentage(percentage: number | null): number | null {
  if (percentage === null) return null;
  return Math.round(percentage * 100) / 100;
}

/**
 * Future attendance simulation (SRS §12).
 * futurePercentage = ((attended + futurePresent) / (held + futurePresent + futureAbsent)) * 100
 * Never mutates official data — purely a projection.
 */
export function calculateProjectedAttendance(
  attended: number,
  held: number,
  futurePresent: number,
  futureAbsent: number = 0,
): number | null {
  assertNonNegativeInt(attended, "attended");
  assertNonNegativeInt(held, "held");
  assertNonNegativeInt(futurePresent, "futurePresent");
  assertNonNegativeInt(futureAbsent, "futureAbsent");
  const projectedAttended = attended + futurePresent;
  const projectedHeld = held + futurePresent + futureAbsent;
  return calculateAttendance(projectedAttended, projectedHeld);
}

export type RequiredClassesResult =
  | { status: "target_reached"; classesNeeded: 0 }
  | { status: "needs_classes"; classesNeeded: number }
  | { status: "unreachable"; classesNeeded: null };

/**
 * Minimum integer N of *consecutive future classes attended* such that
 * (attended + N) / (held + N) >= target/100 (SRS §13).
 *
 * Solving the inequality for N:
 *   attended + N >= (target/100) * (held + N)
 *   N * (1 - target/100) >= (target/100) * held - attended
 *   N >= ((target/100) * held - attended) / (1 - target/100)
 *
 * When target is 100%, no finite N can satisfy the inequality unless the
 * student has already missed zero classes — flagged as "unreachable".
 */
export function calculateRequiredClasses(
  attended: number,
  held: number,
  targetPercentage: number,
): RequiredClassesResult {
  assertNonNegativeInt(attended, "attended");
  assertNonNegativeInt(held, "held");
  if (targetPercentage <= 0 || targetPercentage > 100) {
    throw new Error(`targetPercentage must be in (0, 100], received ${targetPercentage}`);
  }

  const current = calculateAttendance(attended, held);
  if (current !== null && current >= targetPercentage) {
    return { status: "target_reached", classesNeeded: 0 };
  }

  const t = targetPercentage / 100;
  if (t >= 1) {
    const missed = held - attended;
    if (missed === 0) return { status: "target_reached", classesNeeded: 0 };
    return { status: "unreachable", classesNeeded: null };
  }

  const rawN = (t * held - attended) / (1 - t);
  const n = Math.max(0, Math.ceil(rawN - 1e-9));
  return { status: "needs_classes", classesNeeded: n };
}

export type SafeAbsencesResult =
  | { status: "below_target"; maxAbsences: 0 }
  | { status: "can_miss"; maxAbsences: number };

/**
 * Maximum integer N of future classes that can be missed while staying at or
 * above target (SRS §14): attended / (held + N) >= target/100.
 * Solving for N: N <= (attended / (target/100)) - held.
 */
export function calculateSafeAbsences(
  attended: number,
  held: number,
  targetPercentage: number,
): SafeAbsencesResult {
  assertNonNegativeInt(attended, "attended");
  assertNonNegativeInt(held, "held");
  if (targetPercentage <= 0 || targetPercentage > 100) {
    throw new Error(`targetPercentage must be in (0, 100], received ${targetPercentage}`);
  }

  const current = calculateAttendance(attended, held);
  if (current === null || current < targetPercentage) {
    return { status: "below_target", maxAbsences: 0 };
  }

  const t = targetPercentage / 100;
  const rawN = attended / t - held;
  const n = Math.max(0, Math.floor(rawN + 1e-9));
  return { status: "can_miss", maxAbsences: n };
}

export interface LeaveImpactInput {
  attended: number;
  held: number;
  classesOnLeaveDate: number;
}

export interface LeaveImpactOutput {
  before: number | null;
  after: number | null;
  impact: number | null; // percentage points; negative means attendance drops
}

/**
 * Leave impact for a single subject (SRS §15): missing `classesOnLeaveDate`
 * classes adds that many held classes with zero additional attended classes.
 */
export function calculateLeaveImpact(input: LeaveImpactInput): LeaveImpactOutput {
  const { attended, held, classesOnLeaveDate } = input;
  assertNonNegativeInt(classesOnLeaveDate, "classesOnLeaveDate");

  const before = calculateAttendance(attended, held);
  const after = calculateAttendance(attended, held + classesOnLeaveDate);
  if (before === null || after === null) {
    return { before, after, impact: null };
  }
  return { before, after, impact: after - before };
}

/** Status band lookup driven by college-configured thresholds (SRS §65, never hardcoded). */
export interface StatusThresholds {
  critical: number;
  low: number;
  average: number;
  good: number;
  excellent: number;
}

export type StatusLevel = "critical" | "low" | "average" | "good" | "excellent" | "na";

export function getAttendanceStatus(
  percentage: number | null,
  thresholds: StatusThresholds,
): StatusLevel {
  if (percentage === null) return "na";
  if (percentage >= thresholds.excellent) return "excellent";
  if (percentage >= thresholds.good) return "good";
  if (percentage >= thresholds.average) return "average";
  if (percentage >= thresholds.low) return "low";
  return "critical";
}

/**
 * Aggregates attended/held across subjects into one overall attendance figure
 * (used by the home page "Overall Attendance" card, SRS §8.2). Subjects with
 * zero held classes still contribute their (0, 0) — they just don't move the
 * percentage.
 */
export function aggregateAttendance(subjects: AttendedHeld[]): AttendedHeld & {
  percentage: number | null;
} {
  const totals = subjects.reduce(
    (acc, s) => ({ attended: acc.attended + s.attended, held: acc.held + s.held }),
    { attended: 0, held: 0 },
  );
  return { ...totals, percentage: calculateAttendance(totals.attended, totals.held) };
}
