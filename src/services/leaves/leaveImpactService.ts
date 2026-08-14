import { buildLeaveImpactResult, percentageAfterMissing } from "@/lib/calculations/leave";
import { getActiveTimetable } from "@/services/timetable/timetableService";
import { getAttendanceSummaries } from "@/services/attendance/attendanceService";
import { getActiveSubjects } from "@/services/subjects/subjectService";
import { getCollegeConfig } from "@/services/students/collegeConfigService";
import { getEntriesForDay } from "@/lib/calculations/timetable";
import { dayOfWeekFromIso, addDaysIso } from "@/lib/date";
import type { LeaveImpactResult } from "@/types/leave";
import type { SubjectDoc } from "@/types/subject";

async function loadImpactInputs(studentId: string, semesterId: string, department: string, section: string, collegeId: string) {
  const [subjects, summaries, config] = await Promise.all([
    getActiveSubjects(semesterId),
    getAttendanceSummaries(studentId),
    getCollegeConfig(collegeId),
  ]);
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const attendanceBySubject = new Map(summaries.map((s) => [s.subjectId, { attended: s.attended, held: s.held }]));
  return { subjectById, attendanceBySubject, config, department, section };
}

export async function calculateLeaveImpactForDate(
  studentId: string,
  semesterId: string,
  department: string,
  section: string,
  collegeId: string,
  date: string,
): Promise<LeaveImpactResult> {
  const { subjectById, attendanceBySubject, config } = await loadImpactInputs(
    studentId,
    semesterId,
    department,
    section,
    collegeId,
  );
  const { entries } = await getActiveTimetable(semesterId, department, section, date);
  const dayEntries = getEntriesForDay(entries, dayOfWeekFromIso(date)).filter((e) => e.type !== "break");

  const classesOnDate = countBySubject(dayEntries, subjectById);

  return buildLeaveImpactResult(date, classesOnDate, attendanceBySubject, config.minimumAttendancePercentage);
}

function countBySubject(
  dayEntries: Array<{ subjectId: string }>,
  subjectById: Map<string, SubjectDoc>,
) {
  const counts = new Map<string, number>();
  dayEntries.forEach((e) => counts.set(e.subjectId, (counts.get(e.subjectId) ?? 0) + 1));
  return [...counts.entries()].map(([subjectId, count]) => ({
    subjectId,
    subjectName: subjectById.get(subjectId)?.name ?? "Unknown subject",
    icon: subjectById.get(subjectId)?.icon ?? "book",
    count,
  }));
}

export interface AlternativeDateOption {
  date: string;
  classCount: number;
  overallAfter: number | null;
  impact: number | null;
}

/**
 * Ranks the next `horizonDays` dates by leave impact (SRS §17) — fewer
 * classes and a smaller attendance drop rank first. These are calculated
 * suggestions only; they are not official college leave approval.
 */
export async function findAlternativeDates(
  studentId: string,
  semesterId: string,
  department: string,
  section: string,
  collegeId: string,
  fromDate: string,
  horizonDays: number = 7,
): Promise<AlternativeDateOption[]> {
  const { subjectById, attendanceBySubject } = await loadImpactInputs(
    studentId,
    semesterId,
    department,
    section,
    collegeId,
  );
  const { entries } = await getActiveTimetable(semesterId, department, section, fromDate);

  const overallHeld = [...attendanceBySubject.values()].reduce((s, v) => s + v.held, 0);
  const overallAttended = [...attendanceBySubject.values()].reduce((s, v) => s + v.attended, 0);

  const options: AlternativeDateOption[] = [];
  for (let i = 1; i <= horizonDays; i++) {
    const date = addDaysIso(fromDate, i);
    const dayEntries = getEntriesForDay(entries, dayOfWeekFromIso(date)).filter((e) => e.type !== "break");
    const classCount = dayEntries.length;
    const classesOnDate = countBySubject(dayEntries, subjectById);
    const affectedHeld = classesOnDate.reduce((s, c) => s + c.count, 0);
    const overallAfter = percentageAfterMissing(overallAttended, overallHeld, affectedHeld);
    const overallBefore = percentageAfterMissing(overallAttended, overallHeld, 0);
    options.push({
      date,
      classCount,
      overallAfter,
      impact: overallAfter === null || overallBefore === null ? null : overallAfter - overallBefore,
    });
  }

  return options.sort((a, b) => {
    if (a.classCount !== b.classCount) return a.classCount - b.classCount;
    return (b.impact ?? -Infinity) - (a.impact ?? -Infinity);
  });
}
