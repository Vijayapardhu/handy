import { lazy, Suspense } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { ROUTES } from "@/constants/routes";
import styles from "./ProtectedRoute.module.css";

// Only ever rendered for a signed-out visitor, and in its own chunk — a
// signed-in student never downloads the marketing page.
const LandingPage = lazy(() => import("@/pages/Landing/LandingPage").then((m) => ({ default: m.LandingPage })));

/**
 * SRS §60 — unauthenticated users are redirected to /login; nothing renders
 * until auth state is known.
 *
 * With one exception: `/` is also the public front door. A signed-out visitor
 * there gets the landing page instead of a bounce to /login, since bouncing a
 * first-time visitor to a sign-in form for an account that does not exist yet
 * (Handy has no signup — see the extension) is a dead end.
 *
 * Branching here rather than restructuring the router keeps every existing URL
 * intact, which matters: the extension's HANDY_URL, the manifest's
 * host_permissions and the PWA start_url are all pinned to them. And because
 * this component is the *parent* of the shell, returning the landing
 * short-circuits AppShell and RequireCompleteProfile entirely — no nav bar and
 * no profile gate can leak onto it.
 */
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className={styles.splash} role="status" aria-label="Loading">
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!user) {
    if (location.pathname === ROUTES.home) {
      return (
        <Suspense fallback={<div className={styles.splash} />}>
          <LandingPage />
        </Suspense>
      );
    }
    return <Navigate to={ROUTES.login} replace />;
  }

  return <Outlet />;
}
