import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { ROUTES } from "@/constants/routes";
import styles from "./ProtectedRoute.module.css";

/**
 * Onboarding gate. A self-registered account starts out with no real data at
 * all — name, subjects and attendance only exist once the student has
 * captured them from the college portal (see ConnectPortalPage /
 * collegePortalImportService). Until that has happened every screen would
 * render empty, so the whole app is held behind this and the student is sent
 * to /connect-portal.
 *
 * Sits inside ProtectedRoute (a signed-in user is a precondition) but wraps
 * only the AppShell subtree — /connect-portal itself is deliberately outside
 * it, otherwise the redirect would loop.
 */
export function RequireCompleteProfile() {
  const { user, student, loading } = useAuth();

  if (loading) {
    return (
      <div className={styles.splash} role="status" aria-label="Loading">
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!user) return <Navigate to={ROUTES.login} replace />;

  // A null student means the `students/{uid}` doc is missing or unreadable —
  // an account that was interrupted mid-signup. /connect-portal is the
  // recovery path for that too: it re-creates the stub before importing.
  if (!student || student.profileComplete !== true) {
    return <Navigate to={ROUTES.connectPortal} replace />;
  }

  return <Outlet />;
}
