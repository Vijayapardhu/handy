import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { RequireCompleteProfile } from "@/components/layout/RequireCompleteProfile";
import { PageLoadingFallback } from "@/components/layout/PageLoadingFallback";
import { ROUTES } from "@/constants/routes";

// Route-level code splitting: each page ships in its own chunk, fetched only
// when that route is visited, instead of one bundle containing every screen.
const LoginPage = lazy(() => import("@/pages/Login/LoginPage").then((m) => ({ default: m.LoginPage })));
const ConnectPortalPage = lazy(() =>
  import("@/pages/ConnectPortal/ConnectPortalPage").then((m) => ({ default: m.ConnectPortalPage })),
);
const HomePage = lazy(() => import("@/pages/Home/HomePage").then((m) => ({ default: m.HomePage })));
const OverallAttendancePage = lazy(() =>
  import("@/pages/OverallAttendance/OverallAttendancePage").then((m) => ({ default: m.OverallAttendancePage })),
);
const SubjectDetailPage = lazy(() =>
  import("@/pages/SubjectDetail/SubjectDetailPage").then((m) => ({ default: m.SubjectDetailPage })),
);
const TimetablePage = lazy(() => import("@/pages/Timetable/TimetablePage").then((m) => ({ default: m.TimetablePage })));
const LeavesPage = lazy(() => import("@/pages/Leaves/LeavesPage").then((m) => ({ default: m.LeavesPage })));
const LeavePlannerPage = lazy(() =>
  import("@/pages/LeavePlanner/LeavePlannerPage").then((m) => ({ default: m.LeavePlannerPage })),
);
const LeaveRequestPage = lazy(() =>
  import("@/pages/LeaveRequest/LeaveRequestPage").then((m) => ({ default: m.LeaveRequestPage })),
);
const AttendancePlannerPage = lazy(() =>
  import("@/pages/AttendancePlanner/AttendancePlannerPage").then((m) => ({ default: m.AttendancePlannerPage })),
);
const AttendanceHistoryPage = lazy(() =>
  import("@/pages/AttendanceHistory/AttendanceHistoryPage").then((m) => ({ default: m.AttendanceHistoryPage })),
);
const ProfilePage = lazy(() => import("@/pages/Profile/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const PersonalInfoPage = lazy(() =>
  import("@/pages/Profile/PersonalInfoPage").then((m) => ({ default: m.PersonalInfoPage })),
);
const AcademicInfoPage = lazy(() =>
  import("@/pages/Profile/AcademicInfoPage").then((m) => ({ default: m.AcademicInfoPage })),
);
const ChangePasswordPage = lazy(() =>
  import("@/pages/Profile/ChangePasswordPage").then((m) => ({ default: m.ChangePasswordPage })),
);
const NotificationsPage = lazy(() =>
  import("@/pages/Notifications/NotificationsPage").then((m) => ({ default: m.NotificationsPage })),
);
const NotFoundPage = lazy(() => import("@/pages/NotFound/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));

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
