/**
 * Multi-subject leave-impact aggregation and recommendation classification
 * (SRS §15, §16). Built on top of the single-subject primitives in
 * `attendance.ts` — this file never reimplements the percentage math.
 */
import {
  aggregateAttendance,
  calculateAttendance,
  calculateLeaveImpact,
  roundPercentage,
  type AttendedHeld,
} from "./attendance";
import type { LeaveImpactResult, LeaveRecommendation, SubjectLeaveImpact } from "@/types/leave";

export interface ClassOnDate {
  subjectId: string;
  subjectName: string;
  icon: string;
  count: number;
}

export interface SubjectAttendanceInput extends AttendedHeld {
  subjectId: string;
}

/**
 * Classifies a leave date once the before/after overall percentages are known.
 *  - safe: attendance stays at or above target after the leave
 *  - caution: attendance drops but stays within `cautionBandPoints` of target
 *  - not_recommended: attendance falls below target, or more than the caution
 *    band below it
 */
export function classifyLeaveRecommendation(
  overallAfter: number | null,
  targetPercentage: number,
  cautionBandPoints: number = 5,
): LeaveRecommendation {
  if (overallAfter === null) return "not_recommended";
  if (overallAfter >= targetPercentage) return "safe";
  if (overallAfter >= targetPercentage - cautionBandPoints) return "caution";
  return "not_recommended";
}

export function buildLeaveImpactResult(
  date: string,
  classesOnDate: ClassOnDate[],
  subjectAttendance: Map<string, AttendedHeld>,
  targetPercentage: number,
): LeaveImpactResult {
  const subjects: SubjectLeaveImpact[] = classesOnDate.map((cls) => {
    const current = subjectAttendance.get(cls.subjectId) ?? { attended: 0, held: 0 };
    const { before, after, impact } = calculateLeaveImpact({
      attended: current.attended,
      held: current.held,
      classesOnLeaveDate: cls.count,
    });
    return {
      subjectId: cls.subjectId,
      subjectName: cls.subjectName,
      icon: cls.icon,
      classesOnDate: cls.count,
      beforePercentage: roundPercentage(before),
      afterPercentage: roundPercentage(after),
      impact: impact === null ? null : Math.round(impact * 100) / 100,
    };
  });

  const beforeTotals = aggregateAttendance([...subjectAttendance.values()]);
  const afterEntries: AttendedHeld[] = [...subjectAttendance.entries()].map(([subjectId, val]) => {
    const cls = classesOnDate.find((c) => c.subjectId === subjectId);
    return cls ? { attended: val.attended, held: val.held + cls.count } : val;
  });
  const afterTotals = aggregateAttendance(afterEntries);

  const overallBefore = roundPercentage(beforeTotals.percentage) ?? 0;
  const overallAfter = roundPercentage(afterTotals.percentage) ?? 0;
  const overallImpact = Math.round((overallAfter - overallBefore) * 100) / 100;

  return {
    date,
    totalClasses: classesOnDate.reduce((sum, c) => sum + c.count, 0),
    subjects,
    overallBefore,
    overallAfter,
    overallImpact,
    recommendation: classifyLeaveRecommendation(afterTotals.percentage, targetPercentage),
    affectedSubjectCount: subjects.filter((s) => s.impact !== null && s.impact < 0).length,
  };
}

/** Re-exported for callers that only need the plain percentage (e.g. alternative-date ranking). */
export function percentageAfterMissing(attended: number, held: number, missed: number): number | null {
  return calculateAttendance(attended, held + missed);
}
