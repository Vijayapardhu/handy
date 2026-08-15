import { NavLink } from "react-router-dom";
import { Home, BookOpen, Calendar, ClipboardList, FileText, User } from "@/components/ui/icons";
import { ROUTES } from "@/constants/routes";
import { useCampusFeatures } from "@/hooks/useCampusFeatures";
import { cn } from "@/lib/utils/cn";
import styles from "./BottomNav.module.css";

const ITEMS = [
  { to: ROUTES.home, label: "Home", icon: Home, end: true },
  { to: ROUTES.subjects, label: "Subjects", icon: BookOpen, end: false },
  { to: ROUTES.timetable, label: "Timetable", icon: Calendar, end: false },
  { to: ROUTES.tasks, label: "Tasks", icon: ClipboardList, end: false },
  { to: ROUTES.leaves, label: "Leaves", icon: FileText, end: false },
  { to: ROUTES.profile, label: "Profile", icon: User, end: false },
];

export function BottomNav() {
  const { hasTimetable } = useCampusFeatures();
  // AEC and ACET have no timetable to show — their portal does not expose one.
  // A tab leading to a permanently empty screen is worse than no tab.
  const items = hasTimetable ? ITEMS : ITEMS.filter((item) => item.to !== ROUTES.timetable);

  return (
    <nav className={styles.nav} aria-label="Primary">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => cn(styles.item, isActive && styles.active)}
        >
          <Icon size={22} strokeWidth={2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
