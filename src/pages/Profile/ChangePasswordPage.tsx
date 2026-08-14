import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { useAuth } from "@/app/providers/AuthProvider";
import { setExtensionPassword } from "@/services/extension/handyExtensionBridge";
import { changePassword } from "@/services/firebase/auth";
import { changePasswordSchema, type ChangePasswordFormValues } from "@/lib/validators/auth";
import { toFriendlyAuthMessage } from "@/lib/utils/errors";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import styles from "./ChangePasswordPage.module.css";

/**
 * Every account starts on the shared ACCOUNT_PASSWORD (the extension creates
 * accounts silently, so there's no point at which a student could pick one).
 * This screen is how they move off it — and, since `<roll>@handy.local`
 * addresses can't receive Firebase's reset email, the only way a password
 * ever changes at all.
 */
export function ChangePasswordPage() {
  const { student } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({ resolver: zodResolver(changePasswordSchema) });

  async function onSubmit(values: ChangePasswordFormValues) {
    setSubmitError(null);
    try {
      await changePassword(values.password);
      // Hand the new password straight to the browser extension, so its
      // background syncing carries on without ever prompting for it. Silent
      // and best-effort — the extension may not be installed here.
      if (student?.rollNumber) void setExtensionPassword(student.rollNumber, values.password);
      setDone(true);
    } catch (error) {
      setSubmitError(toFriendlyAuthMessage(error));
    }
  }

  return (
    <div>
      <TopHeader title="Change Password" back />
      <p className={styles.intro}>
        Your account uses the shared default password until you change it here. Pick something you'll
        remember — Handy can't email you a reset link.
      </p>

      {done ? (
        <Card className={styles.doneCard}>
          <ShieldCheck size={20} className={styles.doneIcon} />
          <div>
            <p className={styles.doneTitle}>Password updated</p>
            <p className={styles.doneHint}>
              Use it next time you sign in. The Handy College Sync extension has been handed the new
              password already, so it keeps syncing on its own.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
            <label className={styles.field}>
              <span className={styles.labelText}>New Password</span>
              <div className={styles.passwordWrap}>
                <input
                  className={styles.input}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
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

            <label className={styles.field}>
              <span className={styles.labelText}>Confirm New Password</span>
              <input
                className={styles.input}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                {...register("confirmPassword")}
                aria-invalid={Boolean(errors.confirmPassword)}
              />
              {errors.confirmPassword && (
                <span className={styles.fieldError}>{errors.confirmPassword.message}</span>
              )}
            </label>

            {submitError && (
              <p className={styles.submitError} role="alert">
                {submitError}
              </p>
            )}

            <Button type="submit" fullWidth loading={isSubmitting}>
              <KeyRound size={16} /> Update Password
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
