import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAdminAuth } from "@/app/providers/AdminAuthProvider";
import { ROUTES } from "@/constants/routes";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const { user, admin, loading, notAnAdmin, signIn } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user && admin) return <Navigate to={ROUTES.dashboard} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch {
      setError("Couldn't sign in — check the email and password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={`${styles.card} card cardPad`}>
        <div className={styles.head}>
          <span className={styles.mark} aria-hidden="true">
            H
          </span>
          <div>
            <div className={styles.title}>Handy Admin</div>
            <div className={styles.sub}>Sign in with your admin account</div>
          </div>
        </div>

        {(error || notAnAdmin) && (
          <p className="errorBanner">
            {notAnAdmin
              ? "That account isn't an admin, or admin access has been revoked."
              : error}
          </p>
        )}

        <form className={styles.form} onSubmit={onSubmit}>
          <label className="field">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="label">Password</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btnPrimary" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
