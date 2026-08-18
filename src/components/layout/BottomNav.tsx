import { NavLink } from "react-router-dom";
import { Home, BookOpen, Calendar, ClipboardList, FileText, User } from "@/components/ui/icons";
import { ROUTES } from "@/constants/routes";
import { useCampusFeatures } from "@/hooks/useCampusFeatures";
import { cn } from "@/lib/utils/cn";
import styles from "./BottomNav.module.css";

const ITEMS = [
  { to: ROUTES.home, label: "Home", icon: Home, end: true, desktopOnly: false },
  { to: ROUTES.subjects, label: "Subjects", icon: BookOpen, end: false, desktopOnly: false },
  { to: ROUTES.timetable, label: "Timetable", icon: Calendar, end: false, desktopOnly: false },
  { to: ROUTES.tasks, label: "Tasks", icon: ClipboardList, end: false, desktopOnly: false },
  // Five icons is already a tight fit on a phone's bottom bar; Leaves moved
  // to a link on Profile for mobile instead (see ProfilePage's Account
  // section) — the sidebar has the room to keep it as a direct tab.
  { to: ROUTES.leaves, label: "Leaves", icon: FileText, end: false, desktopOnly: true },
  { to: ROUTES.profile, label: "Profile", icon: User, end: false, desktopOnly: false },
];

export function BottomNav() {
  const { hasTimetable } = useCampusFeatures();
  // AEC and ACET have no timetable to show — their portal does not expose one.
  // A tab leading to a permanently empty screen is worse than no tab.
  const items = hasTimetable ? ITEMS : ITEMS.filter((item) => item.to !== ROUTES.timetable);

  return (
    <nav className={styles.nav} aria-label="Primary">
      {items.map(({ to, label, icon: Icon, end, desktopOnly }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => cn(styles.item, desktopOnly && styles.desktopOnly, isActive && styles.active)}
        >
          <Icon size={22} strokeWidth={2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
