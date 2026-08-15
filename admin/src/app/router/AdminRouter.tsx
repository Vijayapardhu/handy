import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { ROUTES } from "@/constants/routes";

const LoginPage = lazy(() => import("@/pages/Login/LoginPage").then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import("@/pages/Dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const StudentsPage = lazy(() => import("@/pages/Students/StudentsPage").then((m) => ({ default: m.StudentsPage })));
const StudentDetailPage = lazy(() =>
  import("@/pages/Students/StudentDetailPage").then((m) => ({ default: m.StudentDetailPage })),
);
const LeaveRequestsPage = lazy(() =>
  import("@/pages/LeaveRequests/LeaveRequestsPage").then((m) => ({ default: m.LeaveRequestsPage })),
);
const ReportsPage = lazy(() => import("@/pages/Reports/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const AcademicPage = lazy(() => import("@/pages/Academic/AcademicPage").then((m) => ({ default: m.AcademicPage })));
const AnalyticsPage = lazy(() => import("@/pages/Analytics/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })));
const SubjectsPage = lazy(() => import("@/pages/Subjects/SubjectsPage").then((m) => ({ default: m.SubjectsPage })));
const TimetablesPage = lazy(() =>
  import("@/pages/Timetables/TimetablesPage").then((m) => ({ default: m.TimetablesPage })),
);
const AnnouncementsPage = lazy(() =>
  import("@/pages/Announcements/AnnouncementsPage").then((m) => ({ default: m.AnnouncementsPage })),
);
const MaterialsPage = lazy(() => import("@/pages/Materials/MaterialsPage").then((m) => ({ default: m.MaterialsPage })));
const NotificationsPage = lazy(() =>
  import("@/pages/Notifications/NotificationsPage").then((m) => ({ default: m.NotificationsPage })),
);
const UpdatesPage = lazy(() => import("@/pages/Updates/UpdatesPage").then((m) => ({ default: m.UpdatesPage })));
const AdminsPage = lazy(() => import("@/pages/Admins/AdminsPage").then((m) => ({ default: m.AdminsPage })));

const router = createBrowserRouter([
  { path: ROUTES.login, element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: ROUTES.dashboard, element: <DashboardPage /> },
          { path: ROUTES.analytics, element: <AnalyticsPage /> },
          { path: ROUTES.students, element: <StudentsPage /> },
          { path: ROUTES.studentDetail(), element: <StudentDetailPage /> },
          { path: ROUTES.leaveRequests, element: <LeaveRequestsPage /> },
          { path: ROUTES.reports, element: <ReportsPage /> },
          { path: ROUTES.academic, element: <AcademicPage /> },
          { path: ROUTES.subjects, element: <SubjectsPage /> },
          { path: ROUTES.timetables, element: <TimetablesPage /> },
          { path: ROUTES.announcements, element: <AnnouncementsPage /> },
          { path: ROUTES.materials, element: <MaterialsPage /> },
          { path: ROUTES.notifications, element: <NotificationsPage /> },
          { path: ROUTES.updates, element: <UpdatesPage /> },
          { path: ROUTES.admins, element: <AdminsPage /> },
        ],
      },
    ],
  },
]);

export function AdminRouter() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: "var(--color-text-muted)" }}>Loading…</div>}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
