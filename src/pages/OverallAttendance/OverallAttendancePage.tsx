import { useNavigate } from "react-router-dom";
import { History } from "@/components/ui/icons";
import { TopHeader } from "@/components/layout/TopHeader";
import { SubjectsPanel } from "@/components/attendance/SubjectsPanel";
import { useAuth } from "@/app/providers/AuthProvider";
import { ROUTES } from "@/constants/routes";
import styles from "./OverallAttendancePage.module.css";

/**
 * What the bottom-nav "Subjects" tab opens — the full, filterable subject
 * list (SRS §9). Used to also carry Overview/Timetable/History tabs that
 * duplicated Home (the attendance card + Needs Attention) and the standalone
 * Timetable page almost verbatim; those are gone, and this page is now the
 * one place that does exactly one thing: every subject's attendance, at once,
 * filterable. The calendar button is still a direct link to the full history
 * page — a shortcut, not a second copy of it rendered here.
 */
export function OverallAttendancePage() {
  const { student } = useAuth();
  const navigate = useNavigate();

  return (
    <div>
      <TopHeader
        title="Subjects"
        subtitle={student ? `${student.course} · Semester ${student.semesterId}` : undefined}
        action={
          <button
            className={styles.calendarButton}
            onClick={() => navigate(ROUTES.attendanceHistory)}
            aria-label="Attendance history"
          >
            <History size={18} />
          </button>
        }
      />

      <SubjectsPanel />
    </div>
  );
}
