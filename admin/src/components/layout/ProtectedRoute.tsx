import { Navigate, Outlet } from "react-router-dom";
import { useAdminAuth } from "@/app/providers/AdminAuthProvider";
import { ROUTES } from "@/constants/routes";

/**
 * Route-level gate — the UX layer only. The real boundary is
 * firestore.rules' isAdmin() and admin/api/_admin.js's requireAdmin(); this
 * component existing or not existing changes nothing about what a signed-in
 * non-admin can actually read or write.
 */
export function ProtectedRoute() {
  const { user, admin, loading } = useAdminAuth();

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", color: "var(--color-text-muted)" }}>
        Loading…
      </div>
    );
  }

  if (!user || !admin) return <Navigate to={ROUTES.login} replace />;

  return <Outlet />;
}
