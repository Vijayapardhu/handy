import { NavLink, Outlet } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  UserGroupIcon,
  Airplane01Icon,
  InboxIcon,
  SchoolIcon,
  ChartLineData02Icon as AnalyticsIcon,
  BookOpen01Icon,
  Calendar03Icon,
  Megaphone01Icon,
  FolderLibraryIcon,
  Notification03Icon,
  RefreshIcon,
  UserSettings01Icon,
  LogoutSquare01Icon,
} from "@hugeicons/core-free-icons";
import { useAdminAuth } from "@/app/providers/AdminAuthProvider";
import { ROUTES } from "@/constants/routes";
import styles from "./AppShell.module.css";

const NAV = [
  { to: ROUTES.dashboard, label: "Dashboard", icon: DashboardSquare01Icon, end: true },
  { to: ROUTES.analytics, label: "Analytics", icon: AnalyticsIcon },
  { to: ROUTES.students, label: "Students", icon: UserGroupIcon },
  { to: ROUTES.leaveRequests, label: "Leave requests", icon: Airplane01Icon },
  { to: ROUTES.reports, label: "Reports", icon: InboxIcon },
  { to: ROUTES.academic, label: "Academic setup", icon: SchoolIcon },
  { to: ROUTES.subjects, label: "Subjects", icon: BookOpen01Icon },
  { to: ROUTES.timetables, label: "Timetables", icon: Calendar03Icon },
  { to: ROUTES.announcements, label: "Announcements", icon: Megaphone01Icon },
  { to: ROUTES.materials, label: "Materials", icon: FolderLibraryIcon },
  { to: ROUTES.notifications, label: "Notifications", icon: Notification03Icon },
  { to: ROUTES.updates, label: "Updates", icon: RefreshIcon },
  { to: ROUTES.admins, label: "Admins", icon: UserSettings01Icon },
] as const;

export function AppShell() {
  const { admin, signOut } = useAdminAuth();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            H
          </span>
          <span className={styles.brandName}>Handy Admin</span>
        </div>

        <nav className={styles.nav} aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item ? item.end : false}
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
            >
              <HugeiconsIcon icon={item.icon} size={18} strokeWidth={1.6} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.footer}>
          <div className={styles.who} title={admin?.email}>
            {admin?.name || admin?.email}
          </div>
          <button type="button" className={styles.signOut} onClick={() => void signOut()}>
            <HugeiconsIcon icon={LogoutSquare01Icon} size={18} strokeWidth={1.6} />
            Sign out
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
