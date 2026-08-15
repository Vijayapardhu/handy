import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  GraduationCap,
  Bell,
  HelpCircle,
  MessageSquare,
  Info,
  LogOut,
  KeyRound,
  ChevronRight,
  Sun,
  Moon,
  BellOff,
  Check,
  Megaphone,
  Smartphone,
  Download,
} from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { CollegePortalSyncCard } from "@/components/profile/CollegePortalSyncCard";
import { useAuth } from "@/app/providers/AuthProvider";
import { useTheme } from "@/app/providers/ThemeProvider";
import { useAccent } from "@/app/providers/AccentProvider";
import { useClassRepRooms } from "@/hooks/useClassRep";
import { useSubjectsWithAttendance } from "@/hooks/useSubjects";
import { useLeaveRequests } from "@/hooks/useLeaves";
import { aggregateAttendance } from "@/lib/calculations/attendance";
import { updateNotifyNewData } from "@/services/students/studentService";
import { ACCENT_CHOICES } from "@/constants/accent";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import styles from "./ProfilePage.module.css";

export function ProfilePage() {
  const { student, user, signOut, refreshStudent } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { accent, setAccent } = useAccent();
  const navigate = useNavigate();
  const subjectsQuery = useSubjectsWithAttendance();
  const leavesQuery = useLeaveRequests();
  const classRepRooms = useClassRepRooms();
  const [notifyBusy, setNotifyBusy] = useState(false);

  // Missing (undefined) reads as enabled — matches every other student doc
  // written before this field existed.
  const notifyEnabled = student?.notifyNewData !== false;

  async function toggleNotifyNewData() {
    if (!user || notifyBusy) return;
    setNotifyBusy(true);
    try {
      await updateNotifyNewData(user.uid, !notifyEnabled);
      await refreshStudent();
    } finally {
      setNotifyBusy(false);
    }
  }

  const overall = subjectsQuery.data
    ? aggregateAttendance(subjectsQuery.data.map((s) => ({ attended: s.attended, held: s.held })))
    : null;

  async function handleLogout() {
    await signOut();
    navigate(ROUTES.login, { replace: true });
  }

  if (!student) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Profile</h1>
          <p className={styles.subtitle}>Manage your account and preferences</p>
        </div>
        <div className={styles.loadingStack}>
          <Skeleton height={92} />
          <Skeleton height={64} />
          <Skeleton height={160} />
          <Skeleton height={120} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Profile</h1>
        <p className={styles.subtitle}>Manage your account and preferences</p>
      </div>

      <Card className={styles.identityCard}>
        <div className={styles.avatar}>
          {student.name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div className={styles.identityBody}>
          <p className={styles.name}>{student.name}</p>
          <p className={styles.meta}>
            {student.course} · Year {student.year}
          </p>
          <p className={styles.college}>{student.department}</p>
          <span className={styles.rollChip}>Roll No: {student.rollNumber}</span>
        </div>
      </Card>

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <p className={styles.statValue}>
            {overall?.percentage === null || overall?.percentage === undefined
              ? "N/A"
              : `${overall.percentage.toFixed(2)}%`}
          </p>
          <p className={styles.statLabel}>Overall Attendance</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statValue}>
            {overall?.attended ?? "–"} / {overall?.held ?? "–"}
          </p>
          <p className={styles.statLabel}>Classes Attended</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statValue}>{leavesQuery.data?.length ?? "–"}</p>
          <p className={styles.statLabel}>Leaves Taken</p>
        </div>
      </div>

      {/* Only a class rep sees this. Everyone else has no such section rather
          than a disabled row explaining a capability they cannot get here. */}
      {(classRepRooms.data?.length ?? 0) > 0 && (
        <>
          <p className={styles.sectionTitle}>Class representative</p>
          <Card padded={false} className={styles.linkGroup}>
            <ProfileLink
              to={ROUTES.announce}
              icon={Megaphone}
              title="Post an announcement"
              subtitle={
                classRepRooms.data!.length === 1
                  ? classRepRooms.data![0].subjectName
                  : `${classRepRooms.data!.length} classes`
              }
            />
          </Card>
        </>
      )}

      <p className={styles.sectionTitle}>College Portal</p>
      <CollegePortalSyncCard />

      <p className={styles.sectionTitle}>Account</p>
      <Card padded={false} className={styles.linkGroup}>
        <ProfileLink to={ROUTES.profilePersonal} icon={User} title="Personal Information" subtitle="View and edit your details" />
        <ProfileLink to={ROUTES.profileAcademic} icon={GraduationCap} title="Academic Information" subtitle="Course, Year, Department" />
        <ProfileLink to={ROUTES.notifications} icon={Bell} title="Notifications" subtitle="Manage notification preferences" />
        <ProfileLink to={ROUTES.profilePassword} icon={KeyRound} title="Change Password" subtitle="Handy has no reset email — change it here" />
      </Card>

      <p className={styles.sectionTitle}>Preferences</p>
      <Card padded={false} className={styles.linkGroup}>
        <div className={styles.preferenceRow}>
          <span className={styles.linkIcon}>{theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}</span>
          <span className={styles.linkBody}>
            <span className={styles.linkTitle}>Dark Mode</span>
            <span className={styles.linkSubtitle}>{theme === "dark" ? "On — easier on the eyes at night" : "Off — matches your device by default"}</span>
          </span>
          <button
            type="button"
            className={styles.themeToggle}
            data-on={theme === "dark"}
            role="switch"
            aria-checked={theme === "dark"}
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
          >
            <span className={styles.themeToggleThumb}>{theme === "dark" ? <Moon size={12} /> : <Sun size={12} />}</span>
          </button>
        </div>

        <div className={styles.preferenceRow}>
          <span className={styles.linkIcon}>{notifyEnabled ? <Bell size={16} /> : <BellOff size={16} />}</span>
          <span className={styles.linkBody}>
            <span className={styles.linkTitle}>Sync Alerts</span>
            <span className={styles.linkSubtitle}>
              {notifyEnabled ? "On — notified when new data syncs in" : "Off — no ping when a sync lands"}
            </span>
          </span>
          <button
            type="button"
            className={styles.themeToggle}
            data-on={notifyEnabled}
            role="switch"
            aria-checked={notifyEnabled}
            aria-label="Toggle sync alerts"
            disabled={notifyBusy}
            onClick={toggleNotifyNewData}
          >
            <span className={styles.themeToggleThumb}>
              {notifyEnabled ? <Bell size={12} /> : <BellOff size={12} />}
            </span>
          </button>
        </div>
      </Card>

      <p className={styles.sectionTitle}>Accent</p>
      <Card className={styles.accentCard}>
        {ACCENT_CHOICES.map((choice) => {
          const selected = choice.id === accent;
          return (
            <button
              key={choice.id}
              type="button"
              className={styles.accentSwatchWrap}
              onClick={() => setAccent(choice.id)}
              aria-pressed={selected}
              aria-label={`Use ${choice.label} accent`}
            >
              <span
                className={cn(styles.accentSwatch, selected && styles.accentSwatchSelected)}
                style={{ background: choice.primary }}
              >
                {selected && <Check size={18} color="white" strokeWidth={3} />}
              </span>
              <span className={styles.accentLabel}>{choice.label}</span>
            </button>
          );
        })}
      </Card>

      <p className={styles.sectionTitle}>Support & More</p>
      <Card padded={false} className={styles.linkGroup}>
        <ProfileLink to={ROUTES.faq} icon={HelpCircle} title="Help & FAQ" subtitle="Get help and find answers" />
        <ProfileLink to={ROUTES.feedback} icon={MessageSquare} title="Feedback" subtitle="Share your feedback with us" />
        <ProfileLink to={ROUTES.about} icon={Info} title="About Handy" subtitle="Version 0.1.0" />
      </Card>

      {/* Straight at the file, not at the releases page — one tap starts the
          download instead of landing on GitHub to hunt for the right asset.
          `handy.apk` is a stable name the release workflow always publishes
          alongside the versioned copy, so this link never needs editing.

          No target="_blank": a download does not navigate anywhere, and a
          blank tab that opens and sits there looks like something failed. */}
      <p className={styles.sectionTitle}>Android app</p>
      <Card padded={false} className={styles.linkGroup}>
        <a
          className={styles.link}
          href="https://github.com/Vijayapardhu/handy/releases/latest/download/handy.apk"
          rel="noopener noreferrer"
        >
          <span className={styles.linkIcon}>
            <Smartphone size={18} />
          </span>
          <span className={styles.linkBody}>
            <span className={styles.linkTitle}>Download the Android app</span>
            <span className={styles.linkSubtitle}>
              Widgets, class reminders and offline access
            </span>
          </span>
          <Download size={18} className={styles.chevron} />
        </a>
      </Card>

      <Button variant="danger" fullWidth onClick={handleLogout} className={styles.logout}>
        <LogOut size={16} /> Log Out
      </Button>
    </div>
  );
}

function ProfileLink({
  to,
  icon: Icon,
  title,
  subtitle,
}: {
  to: string;
  icon: typeof User;
  title: string;
  subtitle: string;
}) {
  return (
    <Link to={to} className={styles.link}>
      <span className={styles.linkIcon}>
        <Icon size={18} />
      </span>
      <span className={styles.linkBody}>
        <span className={styles.linkTitle}>{title}</span>
        <span className={styles.linkSubtitle}>{subtitle}</span>
      </span>
      <ChevronRight size={16} className={styles.chevron} />
    </Link>
  );
}
