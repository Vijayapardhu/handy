import { lazy, Suspense } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { ROUTES } from "@/constants/routes";
import { BrandLoader } from "./BrandLoader";
import styles from "./ProtectedRoute.module.css";

// Only ever rendered for a signed-out visitor, and in their own chunks — a
// signed-in student never downloads any of these (they get the same pages
// through AppRouter's own lazy imports instead).
const LandingPage = lazy(() => import("@/pages/Landing/LandingPage").then((m) => ({ default: m.LandingPage })));
const FaqPage = lazy(() => import("@/pages/Faq/FaqPage").then((m) => ({ default: m.FaqPage })));
const AboutPage = lazy(() => import("@/pages/About/AboutPage").then((m) => ({ default: m.AboutPage })));

/**
 * SRS §60 — unauthenticated users are redirected to /login; nothing renders
 * until auth state is known.
 *
 * Three exceptions, all public content with no student data in it: `/` is the
 * front door and gets the full landing page. `/faq` and `/about` get the same
 * pages a signed-in student sees — real, indexable content (help articles,
 * the app's story) that a search engine or a prospective student should be
 * able to reach without an account that doesn't exist for them yet (Handy has
 * no signup — see the extension). They render inside the plain app-shell
 * layout rather than the full AppShell: no bottom nav, since there is nowhere
 * for a signed-out visitor to nav to. (/faq's data read is public in
 * firestore.rules to match — the route guard alone wouldn't be enough.)
 *
 * Branching here rather than restructuring the router keeps every existing URL
 * intact, which matters: the extension's HANDY_URL, the manifest's
 * host_permissions and the PWA start_url are all pinned to them. And because
 * this component is the *parent* of the shell, returning early short-circuits
 * AppShell and RequireCompleteProfile entirely — no nav bar and no profile
 * gate can leak onto any of these.
 */
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className={styles.splash}>
        <BrandLoader />
      </div>
    );
  }

  if (!user) {
    if (location.pathname === ROUTES.home) {
      return (
        <Suspense
          fallback={
            <div className={`${styles.splash} ${styles.splashDark}`}>
              <BrandLoader />
            </div>
          }
        >
          <LandingPage />
        </Suspense>
      );
    }

    if (location.pathname === ROUTES.faq || location.pathname === ROUTES.about) {
      const Page = location.pathname === ROUTES.faq ? FaqPage : AboutPage;
      return (
        <Suspense
          fallback={
            <div className={styles.splash}>
              <BrandLoader />
            </div>
          }
        >
          <div className="app-shell">
            <main className="app-main">
              <Page />
            </main>
          </div>
        </Suspense>
      );
    }

    return <Navigate to={ROUTES.login} replace />;
  }

  return <Outlet />;
}
