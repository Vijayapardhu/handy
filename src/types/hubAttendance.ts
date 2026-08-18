/**
 * "Hub" attendance — CodeForge/skills-hour sessions tracked by Aditya
 * University's separate Maya platform (maya.adityauniversity.in), not by
 * Campus Connect. Only relevant to students whose timetable carries a
 * "technical" period (SRS's Technical Hour) — see useCampusFeatures/HomePage.
 *
 * Maya has no concept of a per-day attendance record the way `attendance`
 * does: it reports session counts per topic within a module, within a course
 * a student is enrolled in (CodeForge, Arithmetic/Logical/Verbal Ability,
 * etc). These types mirror that shape rather than Handy's own attendance
 * model, since the two are genuinely different data.
 */
export interface HubTopic {
  topicName: string;
  totalSessions: number;
  attendedCount: number;
}

export interface HubModule {
  moduleId: string;
  moduleName: string;
  moduleIcon: string | null;
  topics: HubTopic[];
  totalSessions: number;
  attendedSessions: number;
}

export interface HubCourse {
  batchId: string;
  technologyId: string;
  courseName: string;
  technologyName: string;
  technologyIcon: string | null;
  modules: HubModule[];
  totalSessions: number;
  attendedSessions: number;
  /** null when nothing has been held yet — nothing to divide by. */
  percentage: number | null;
}

export interface HubAttendanceSnapshot {
  studentName: string | null;
  rollNumber: string | null;
  courses: HubCourse[];
  totalSessions: number;
  attendedSessions: number;
  percentage: number | null;
  fetchedAt: string;
}
