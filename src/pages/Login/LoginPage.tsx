import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowRight, Eye, EyeOff, Puzzle } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { loginSchema, type LoginFormValues } from "@/lib/validators/auth";
import { toFriendlyAuthMessage } from "@/lib/utils/errors";
import {
  getExtensionAccount,
  setExtensionPassword,
  type ExtensionAccount,
} from "@/services/extension/handyExtensionBridge";
import { ACCOUNT_PASSWORD } from "@/services/firebase/auth";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/constants/routes";
import styles from "./LoginPage.module.css";

/**
 * Sign-in is roll number only. Accounts are created by the browser extension
 * with a known default password (see ACCOUNT_PASSWORD), so asking every
 * student to type a password they were simply told would be pure friction —
 * the field appears only for someone who has changed theirs, or after a
 * password failure reveals that they must have.
 */
export function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [extensionAccount, setExtensionAccount] = useState<ExtensionAccount | null>(null);
  const [continuing, setContinuing] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  // Resolves to null when the extension isn't installed or hasn't captured
  // anything — in which case there's nothing to continue as.
  useEffect(() => {
    let cancelled = false;
    getExtensionAccount().then((account) => {
      if (!cancelled) setExtensionAccount(account);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && user) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? ROUTES.home;
    return <Navigate to={redirectTo} replace />;
  }

  async function onSubmit(values: LoginFormValues) {
    setSubmitError(null);
    const password = values.password || ACCOUNT_PASSWORD;
    try {
      await signIn(values.rollNumber, password);
      // Re-link the extension if its stored credential went stale (the
      // student changed their password elsewhere). Best-effort: it may not be
      // installed, and it must never block signing in.
      if (values.password) void setExtensionPassword(values.rollNumber, password);
      navigate(ROUTES.home, { replace: true });
    } catch (error) {
      // A rejected default password means this student changed theirs, which
      // is the only reason to put a password field on screen.
      if (!values.password && isPasswordError(error)) {
        setNeedsPassword(true);
        setSubmitError("Looks like you changed your password — enter it below.");
        return;
      }
      setSubmitError(toFriendlyAuthMessage(error));
    }
  }

  async function continueAsExtensionAccount() {
    if (!extensionAccount) return;
    setSubmitError(null);
    setContinuing(true);
    try {
      await signIn(extensionAccount.rollNumber, extensionAccount.password);
      navigate(ROUTES.home, { replace: true });
    } catch (error) {
      setContinuing(false);
      setSubmitError(toFriendlyAuthMessage(error));
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.brand}>
        <div className={styles.logo}>H</div>
        <h1 className={styles.appName}>Handy</h1>
        <p className={styles.tagline}>Your attendance, straight from the college portal</p>
      </div>

      <div className={styles.card}>
        {extensionAccount ? (
          <>
            <button
              type="button"
              className={styles.identityButton}
              onClick={continueAsExtensionAccount}
              disabled={continuing}
            >
              <span className={styles.identityAvatar}>{extensionAccount.rollNumber.slice(-2)}</span>
              <span className={styles.identityBody}>
                <span className={styles.identityLabel}>Continue as</span>
                <span className={styles.identityRoll}>{extensionAccount.rollNumber}</span>
              </span>
              <ArrowRight size={18} className={styles.identityChevron} />
            </button>
            <div className={styles.divider}>
              <span>or use another roll number</span>
            </div>
          </>
        ) : null}

        <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
          <label className={styles.field}>
            <span className={styles.labelText}>Roll Number</span>
            <input
              className={styles.input}
              type="text"
              inputMode="text"
              autoComplete="username"
              placeholder="26B21CS058"
              autoCapitalize="characters"
              autoFocus={!extensionAccount}
              {...register("rollNumber")}
              aria-invalid={Boolean(errors.rollNumber)}
            />
            {errors.rollNumber && <span className={styles.fieldError}>{errors.rollNumber.message}</span>}
          </label>

          {needsPassword && (
            <label className={styles.field}>
              <span className={styles.labelText}>Password</span>
              <div className={styles.passwordWrap}>
                <input
                  className={styles.input}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  autoFocus
                  {...register("password")}
                  aria-invalid={Boolean(errors.password)}
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <span className={styles.fieldError}>{errors.password.message}</span>}
            </label>
          )}

          {submitError && (
            <p className={styles.submitError} role="alert">
              {submitError}
            </p>
          )}

          <Button type="submit" fullWidth loading={isSubmitting}>
            Sign In <ArrowRight size={16} />
          </Button>

          {!needsPassword && (
            <button
              type="button"
              className={styles.textLink}
              onClick={() => setNeedsPassword(true)}
            >
              I changed my password
            </button>
          )}
        </form>
      </div>

      {!extensionAccount && (
        <p className={styles.footNote}>
          <Puzzle size={14} /> No account yet? Install the Handy College Sync extension and open your
          Campus Connect profile — your account is created for you.
        </p>
      )}
    </div>
  );
}

/** Firebase reports a bad password differently depending on email-enumeration protection. */
function isPasswordError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? "";
  return (
    code === "auth/wrong-password" ||
    code === "auth/invalid-credential" ||
    code === "auth/invalid-login-credentials"
  );
}
