import { useAuth } from "@/app/providers/AuthProvider";
import { detectCampus, usesPortalLogin } from "@/lib/campus";

/**
 * What this student's college actually gives Handy.
 *
 * AEC and ACET are read by signing into their portal server-side, and that
 * portal exposes attendance and marks but no timetable and never names the
 * lecturer for a subject. So those students have no classes to be reminded of,
 * no free periods to plan around, and no class groups — a group is
 * timetable + subject + faculty, and without the faculty two lecturers' rooms
 * cannot be told apart.
 *
 * Hiding those surfaces is the honest thing rather than leaving them empty. An
 * empty timetable reads as "nothing scheduled today", which is a claim about
 * the student's week. Absent reads as what it is: not something Handy can show
 * for this college.
 *
 * Derived from the roll number rather than a stored field, so it is right for
 * every account that already exists without a migration.
 */
export function useCampusFeatures() {
  const { student } = useAuth();
  const campus = student ? detectCampus(student.rollNumber).campus : null;

  // Unknown campuses keep everything. A student whose roll number we cannot
  // place is far more likely to be at the university than to be someone whose
  // features should quietly vanish.
  const limited = usesPortalLogin(campus);

  return {
    campus,
    /** Timetable, next-class card, class reminders, free-period planning. */
    hasTimetable: !limited,
    /** Class-rep announcements and shared notes. */
    hasClassGroups: !limited,
  };
}
