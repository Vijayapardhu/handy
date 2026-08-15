import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Activity, BookOpen, Calendar, History as HistoryIcon } from "@/components/ui/icons";
import { TopHeader } from "@/components/layout/TopHeader";
import { OverviewPanel } from "@/components/attendance/OverviewPanel";
import { SubjectsPanel } from "@/components/attendance/SubjectsPanel";
import { TodayTimetablePreview } from "@/components/timetable/TodayTimetablePreview";
import { RecentHistoryPreview } from "@/components/attendance/RecentHistoryPreview";
import { useAuth } from "@/app/providers/AuthProvider";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/constants/routes";
import styles from "./OverallAttendancePage.module.css";

type Tab = "overview" | "subjects" | "timetable" | "history";

const TABS: Array<{ id: Tab; label: string; icon: typeof Activity }> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "subjects", label: "Subjects", icon: BookOpen },
  { id: "timetable", label: "Timetable", icon: Calendar },
  { id: "history", label: "History", icon: HistoryIcon },
];

const VALID_TABS: readonly Tab[] = ["overview", "subjects", "timetable", "history"];

function isValidTab(value: string | null): value is Tab {
  return value !== null && (VALID_TABS as readonly string[]).includes(value);
}

/** Matches the "Overall Attendance" screen (Overview/Subjects/Timetable/History tabs). This is what the bottom-nav "Subjects" tab opens. */
export function OverallAttendancePage() {
  const { student } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(isValidTab(initialTab) ? initialTab : "subjects");

  return (
    <div>
      <TopHeader
        title="Overall Attendance"
        subtitle={student ? `${student.course} · Semester ${student.semesterId}` : undefined}
        action={
          <button
            className={styles.calendarButton}
            onClick={() => navigate(ROUTES.attendanceHistory)}
            aria-label="Attendance history"
          >
            <HistoryIcon size={18} />
          </button>
        }
      />

      <div className={styles.tabs} role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={cn(styles.tab, tab === id && styles.tabActive)}
            onClick={() => setTab(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div className={styles.panel}>
        {tab === "overview" && <OverviewPanel />}
        {tab === "subjects" && <SubjectsPanel />}
        {tab === "timetable" && <TodayTimetablePreview />}
        {tab === "history" && <RecentHistoryPreview />}
      </div>
    </div>
  );
}
