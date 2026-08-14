import { doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { subjectsCol, studentDocRef } from "@/services/firebase/collections";
import { getAttendanceSummaries } from "@/services/attendance/attendanceService";
import { getCollegeConfig } from "@/services/students/collegeConfigService";
import { calculateAttendance, getAttendanceStatus, roundPercentage } from "@/lib/calculations/attendance";
import type { SubjectDoc } from "@/types/subject";
import type { AttendanceStatusLevel, SubjectAttendanceSummary } from "@/types/subject";

export async function getActiveSubjects(semesterId: string): Promise<SubjectDoc[]> {
  const q = query(
    subjectsCol(),
    where("semesterId", "==", semesterId),
    where("active", "==", true),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export async function getSubject(subjectId: string): Promise<SubjectDoc | null> {
  const snapshot = await getDoc(doc(subjectsCol(), subjectId));
  return snapshot.exists() ? snapshot.data() : null;
}

export interface SubjectWithStatus extends SubjectAttendanceSummary {
  percentage: number | null;
  status: AttendanceStatusLevel;
}

/**
 * Joins subjects + their attendance summaries + the college's target and
 * status thresholds into the shape every subject-list UI needs. One read of
 * summaries (single equality query), not the full attendance history.
 */
export async function getSubjectsWithAttendance(
  studentId: string,
  semesterId: string,
  collegeId: string,
): Promise<SubjectWithStatus[]> {
  const [subjects, summaries, config] = await Promise.all([
    getActiveSubjects(semesterId),
    getAttendanceSummaries(studentId),
    getCollegeConfig(collegeId),
  ]);

  const summaryBySubject = new Map(summaries.map((s) => [s.subjectId, s]));

  return subjects.map((subject) => {
    const summary = summaryBySubject.get(subject.id);
    const attended = summary?.attended ?? 0;
    const held = summary?.held ?? 0;
    const target = subject.targetAttendance ?? config.minimumAttendancePercentage;
    const percentage = roundPercentage(calculateAttendance(attended, held));
    return {
      subjectId: subject.id,
      subjectName: subject.name,
      shortName: subject.shortName,
      icon: subject.icon,
      attended,
      held,
      targetAttendance: target,
      percentage,
      status: getAttendanceStatus(percentage, config.statusThresholds),
    };
  });
}

/** Verifies a student belongs to the given semester before scoping other queries to it — cheap guard, single doc read. */
export async function assertStudentSemester(studentId: string, semesterId: string): Promise<boolean> {
  const snap = await getDoc(studentDocRef(studentId));
  return snap.exists() && snap.data().semesterId === semesterId;
}
