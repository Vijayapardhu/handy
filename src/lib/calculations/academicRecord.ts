/**
 * Pure derivations over AcademicRecordDoc — CGPA/SGPA arithmetic only, no
 * Firestore or component concerns (mirrors attendance.ts's own rule).
 */

/** The portal prints CGPA/SGPA as strings, and "N/A" when there's nothing to report yet. */
export function parseGradeNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export interface CgpaProjection {
  /** Average SGPA needed across the remaining semesters. Null when there are no semesters left to earn it in. */
  neededAverageSgpa: number | null;
  /** The current CGPA already meets (or beats) the target. */
  alreadyMet: boolean;
  /** The needed average exceeds the 10-point scale — the target isn't reachable from here. */
  impossible: boolean;
}

/**
 * "If I want an overall CGPA of `targetCgpa` by the end of `totalSemesters`,
 * what average SGPA do I need for the semesters I have left?"
 *
 * A simplification, stated as one rather than left implicit: CGPA is treated
 * as an equal-weighted average of each semester's SGPA (credits-per-semester
 * aren't in the scraped data to weight it properly). Close enough to plan
 * around, not close enough to call exact — the page says so.
 */
export function projectRequiredSgpa(
  currentCgpa: number,
  completedSemesters: number,
  totalSemesters: number,
  targetCgpa: number,
): CgpaProjection {
  const remaining = totalSemesters - completedSemesters;

  if (remaining <= 0) {
    const alreadyMet = currentCgpa >= targetCgpa;
    return { neededAverageSgpa: null, alreadyMet, impossible: !alreadyMet };
  }

  const needed = (targetCgpa * totalSemesters - currentCgpa * completedSemesters) / remaining;

  if (needed <= 0) {
    return { neededAverageSgpa: 0, alreadyMet: true, impossible: false };
  }

  return {
    neededAverageSgpa: Math.round(needed * 100) / 100,
    alreadyMet: false,
    impossible: needed > 10,
  };
}
