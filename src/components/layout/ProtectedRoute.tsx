import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { ROUTES } from "@/constants/routes";
import styles from "./ProtectedRoute.module.css";

/** SRS §60 — unauthenticated users are redirected to /login; nothing renders until auth state is known. */
export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className={styles.splash} role="status" aria-label="Loading">
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!user) return <Navigate to={ROUTES.login} replace />;

  return <Outlet />;
}
