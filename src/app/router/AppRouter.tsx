import { Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { lazyPage } from "./lazyPage";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { RequireCompleteProfile } from "@/components/layout/RequireCompleteProfile";
import { PageLoadingFallback } from "@/components/layout/PageLoadingFallback";
import { ROUTES } from "@/constants/routes";

// Route-level code splitting: each page ships in its own chunk, fetched only
// when that route is visited, instead of one bundle containing every screen.
const LoginPage = lazyPage(() => import("@/pages/Login/LoginPage").then((m) => ({ default: m.LoginPage })));
const ConnectPortalPage = lazyPage(() =>
  import("@/pages/ConnectPortal/ConnectPortalPage").then((m) => ({ default: m.ConnectPortalPage })),
);
const HomePage = lazyPage(() => import("@/pages/Home/HomePage").then((m) => ({ default: m.HomePage })));
const OverallAttendancePage = lazyPage(() =>
  import("@/pages/OverallAttendance/OverallAttendancePage").then((m) => ({ default: m.OverallAttendancePage })),
);
const SubjectDetailPage = lazyPage(() =>
  import("@/pages/SubjectDetail/SubjectDetailPage").then((m) => ({ default: m.SubjectDetailPage })),
);
const TimetablePage = lazyPage(() => import("@/pages/Timetable/TimetablePage").then((m) => ({ default: m.TimetablePage })));
const TasksPage = lazyPage(() => import("@/pages/Tasks/TasksPage").then((m) => ({ default: m.TasksPage })));
const TaskDetailPage = lazyPage(() =>
  import("@/pages/TaskDetail/TaskDetailPage").then((m) => ({ default: m.TaskDetailPage })),
);
const LeavesPage = lazyPage(() => import("@/pages/Leaves/LeavesPage").then((m) => ({ default: m.LeavesPage })));
const LeavePlannerPage = lazyPage(() =>
  import("@/pages/LeavePlanner/LeavePlannerPage").then((m) => ({ default: m.LeavePlannerPage })),
);
const LeaveRequestPage = lazyPage(() =>
  import("@/pages/LeaveRequest/LeaveRequestPage").then((m) => ({ default: m.LeaveRequestPage })),
);
const AttendancePlannerPage = lazyPage(() =>
  import("@/pages/AttendancePlanner/AttendancePlannerPage").then((m) => ({ default: m.AttendancePlannerPage })),
);
const AttendanceHistoryPage = lazyPage(() =>
  import("@/pages/AttendanceHistory/AttendanceHistoryPage").then((m) => ({ default: m.AttendanceHistoryPage })),
);
const ProfilePage = lazyPage(() => import("@/pages/Profile/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const PersonalInfoPage = lazyPage(() =>
  import("@/pages/Profile/PersonalInfoPage").then((m) => ({ default: m.PersonalInfoPage })),
);
const AcademicInfoPage = lazyPage(() =>
  import("@/pages/Profile/AcademicInfoPage").then((m) => ({ default: m.AcademicInfoPage })),
);
const ChangePasswordPage = lazyPage(() =>
  import("@/pages/Profile/ChangePasswordPage").then((m) => ({ default: m.ChangePasswordPage })),
);
const NotificationsPage = lazyPage(() =>
  import("@/pages/Notifications/NotificationsPage").then((m) => ({ default: m.NotificationsPage })),
);
const AnnouncePage = lazyPage(() =>
  import("@/pages/Announce/AnnouncePage").then((m) => ({ default: m.AnnouncePage })),
);
const AnnouncementPage = lazyPage(() =>
  import("@/pages/Announcement/AnnouncementPage").then((m) => ({ default: m.AnnouncementPage })),
);
const FaqPage = lazyPage(() => import("@/pages/Faq/FaqPage").then((m) => ({ default: m.FaqPage })));
const FeedbackPage = lazyPage(() => import("@/pages/Feedback/FeedbackPage").then((m) => ({ default: m.FeedbackPage })));
const AboutPage = lazyPage(() => import("@/pages/About/AboutPage").then((m) => ({ default: m.AboutPage })));
const NotFoundPage = lazyPage(() => import("@/pages/NotFound/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));

const router = createBrowserRouter([
  { path: ROUTES.login, element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      // Onboarding lives inside ProtectedRoute (a signed-in user is required)
      // but outside both RequireCompleteProfile — it must stay reachable while
      // profileComplete is false, that being its entire purpose — and AppShell,
      // so there's no bottom nav tempting the student away mid-setup.
      { path: ROUTES.connectPortal, element: <ConnectPortalPage /> },
      {
        element: <RequireCompleteProfile />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: ROUTES.home, element: <HomePage /> },
              { path: ROUTES.subjects, element: <OverallAttendancePage /> },
              { path: ROUTES.subjectDetail(), element: <SubjectDetailPage /> },
              { path: ROUTES.subjectPlanner(), element: <AttendancePlannerPage /> },
              { path: ROUTES.timetable, element: <TimetablePage /> },
              { path: ROUTES.tasks, element: <TasksPage /> },
              { path: ROUTES.taskDetail(), element: <TaskDetailPage /> },
              { path: ROUTES.leaves, element: <LeavesPage /> },
              { path: ROUTES.leavePlanner, element: <LeavePlannerPage /> },
              { path: ROUTES.leaveRequestNew, element: <LeaveRequestPage /> },
              { path: ROUTES.attendancePlanner, element: <AttendancePlannerPage /> },
              { path: ROUTES.attendanceHistory, element: <AttendanceHistoryPage /> },
              { path: ROUTES.profile, element: <ProfilePage /> },
              { path: ROUTES.profilePersonal, element: <PersonalInfoPage /> },
              { path: ROUTES.profileAcademic, element: <AcademicInfoPage /> },
              { path: ROUTES.profilePassword, element: <ChangePasswordPage /> },
              { path: ROUTES.notifications, element: <NotificationsPage /> },
              { path: ROUTES.announce, element: <AnnouncePage /> },
              { path: ROUTES.announcement(), element: <AnnouncementPage /> },
              { path: ROUTES.faq, element: <FaqPage /> },
              { path: ROUTES.feedback, element: <FeedbackPage /> },
              { path: ROUTES.about, element: <AboutPage /> },
              { path: "*", element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
