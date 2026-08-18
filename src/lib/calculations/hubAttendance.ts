import { getAttendanceStatus, type StatusLevel, type StatusThresholds } from "./attendance";
import type { HubAttendanceSnapshot, HubCourse } from "@/types/hubAttendance";

/**
 * The Hub has no college-configured target the way official attendance does
 * (those thresholds come from Firestore, per college) — this is a plain,
 * ungraded read. The one thing that matters is that every screen that colors
 * a Hub percentage (the Home card, the breakdown page, the Profile connect
 * card) uses this exact same band, so a given percentage never shows as one
 * status in one place and a different one somewhere else.
 */
export const HUB_STATUS_THRESHOLDS: StatusThresholds = {
  critical: 0,
  low: 50,
  average: 65,
  good: 75,
  excellent: 90,
};

export function getHubStatus(percentage: number | null): StatusLevel {
  return getAttendanceStatus(percentage, HUB_STATUS_THRESHOLDS);
}

/**
 * Whether a Maya course is CodeForge, rather than one of the ability courses
 * that share the same login.
 *
 * A student's Maya enrolment covers CodeForge *and* Arithmetic, Logical and
 * Verbal Ability, all reported through one list. Summing the lot gave a figure
 * that was not CodeForge attendance — a strong CodeForge record could be dragged
 * under by a Verbal Ability course the student never thought of as CodeForge.
 *
 * Matched loosely on purpose: the data holds `courseName: "CODEFORGE"` with
 * `technologyName: "CodeForge-Intermediate"`, and the levels are written
 * inconsistently ("CodeForge - Beginner", "CodeForge-Advanced"), so case and
 * separators are stripped before comparing. Mirrors HubCourse.isCodeForge in
 * mobile/lib/models/hub_attendance.dart — the two must agree, since a student
 * comparing their phone and the website must see the same number.
 */
export function isCodeForgeCourse(course: HubCourse): boolean {
  const squash = (value: string | null) =>
    (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return squash(course.courseName).includes("CODEFORGE") ||
    squash(course.technologyName).includes("CODEFORGE");
}

export interface CodeForgeStats {
  /** Just the CodeForge courses — Beginner, Intermediate, Advanced. */
  courses: HubCourse[];
  /** The ability courses under the same login; still shown, just not counted. */
  otherCourses: HubCourse[];
  attendedSessions: number;
  totalSessions: number;
  /** Null when nothing has been held, or when there is no CodeForge course at
   *  all — honestly "—" rather than an ability figure wearing a CodeForge label. */
  percentage: number | null;
}

/** CodeForge attendance, and only CodeForge, from a full Maya snapshot. */
export function codeForgeStats(snapshot: HubAttendanceSnapshot): CodeForgeStats {
  const courses = snapshot.courses.filter(isCodeForgeCourse);
  const otherCourses = snapshot.courses.filter((c) => !isCodeForgeCourse(c));
  const attendedSessions = courses.reduce((sum, c) => sum + c.attendedSessions, 0);
  const totalSessions = courses.reduce((sum, c) => sum + c.totalSessions, 0);
  return {
    courses,
    otherCourses,
    attendedSessions,
    totalSessions,
    percentage: totalSessions === 0
      ? null
      : Math.round((attendedSessions / totalSessions) * 10000) / 100,
  };
}
