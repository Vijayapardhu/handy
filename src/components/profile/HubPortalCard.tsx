import { useState, type FormEvent } from "react";
import { ChevronDown, Code2, Eye, EyeOff, LogOut, PlugZap, RefreshCw } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { codeForgeStats, getHubStatus } from "@/lib/calculations/hubAttendance";
import { useConnectHub, useDisconnectHub, useHubAttendance, useRefreshHubAttendance } from "@/hooks/useHubAttendance";
import { HubAttendanceError } from "@/services/attendance/hubAttendanceService";
import { cn } from "@/lib/utils/cn";
import styles from "./HubPortalCard.module.css";

/**
 * Where a student sets up (and manages) their Hub/Maya login — Profile, not
 * Home. Home's HubAttendanceCard only ever *reads* this connection and
 * points here when there isn't one; entering the credential lives in exactly
 * one place, matching CollegePortalSyncCard's role for the AEC/ACET/AUS
 * portal just above it in ProfilePage.
 */
export function HubPortalCard() {
  const { data, isLoading } = useHubAttendance(true);
  const connectMutation = useConnectHub();
  const disconnectMutation = useDisconnectHub();
  const refreshMutation = useRefreshHubAttendance();
  const [rollNumber, setRollNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  // Closed by default — the roll number/password fields only need to be seen
  // once, and shouldn't be sitting open on a page a student visits for lots
  // of other reasons too.
  const [formOpen, setFormOpen] = useState(false);

  async function handleConnect(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!rollNumber.trim() || !password) {
      setFormError("Enter both your CodeForge roll number and password.");
      return;
    }
    try {
      await connectMutation.mutateAsync({ rollNumber: rollNumber.trim().toUpperCase(), password });
      setRollNumber("");
      setPassword("");
    } catch (error) {
      setFormError(error instanceof HubAttendanceError ? error.message : "Could not connect to CodeForge.");
    }
  }

  async function handleDisconnect() {
    await disconnectMutation.mutateAsync();
    setConfirmingDisconnect(false);
  }

  // Same "say nothing while we check" beat as CollegePortalSyncCard — a
  // connect form flashing for a moment before the real (linked) state loads
  // would read as a prompt to redo something already done.
  if (isLoading) return null;

  if (!data?.linked) {
    return (
      <Card className={styles.card}>
        <button
          type="button"
          className={styles.toggleHeader}
          onClick={() => setFormOpen((v) => !v)}
          aria-expanded={formOpen}
        >
          <span className={styles.headerIcon} aria-hidden="true">
            <Code2 size={18} />
          </span>
          <p className={styles.title}>Connect CodeForge</p>
          <ChevronDown size={16} className={cn(styles.toggleChevron, formOpen && styles.toggleChevronOpen)} />
        </button>

        {formOpen && (
          <>
            <p className={styles.hint}>
              CodeForge and skills-hour attendance from Maya, alongside your regular attendance. This
              is your CodeForge login, separate from your Handy account — saved so you won&rsquo;t
              need to sign in again.
            </p>

            <form className={styles.form} onSubmit={handleConnect}>
              <label className={styles.field}>
                <span className={styles.labelText}>CodeForge Roll Number</span>
                <input
                  className={styles.input}
                  type="text"
                  inputMode="text"
                  autoComplete="username"
                  autoCapitalize="characters"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.labelText}>CodeForge Password</span>
                <div className={styles.passwordWrap}>
                  <input
                    className={styles.input}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.togglePassword}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              {formError && (
                <p className={styles.formError} role="alert">
                  {formError}
                </p>
              )}

              <Button type="submit" fullWidth size="sm" loading={connectMutation.isPending}>
                <PlugZap size={16} /> Connect CodeForge
              </Button>
            </form>
          </>
        )}
      </Card>
    );
  }

  const snapshot = data.snapshot;
  const cf = snapshot ? codeForgeStats(snapshot) : null;

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <Code2 size={18} />
        </span>
        <div className={styles.headerBody}>
          <p className={styles.title}>CodeForge connected</p>
          <p className={styles.subtitle}>Roll number {snapshot?.rollNumber ?? "—"}</p>
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          aria-label="Refresh CodeForge attendance"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className={styles.valueRow}>
        <p className={styles.value}>
          {cf?.percentage == null ? "N/A" : `${cf.percentage.toFixed(2)}%`}
        </p>
        <StatusBadge status={getHubStatus(cf?.percentage ?? null)} />
      </div>
      <p className={styles.footnote}>
        {cf
          ? `${cf.attendedSessions}/${cf.totalSessions} sessions across ${cf.courses.length} CodeForge ${
              cf.courses.length === 1 ? "course" : "courses"
            }`
          : "No data yet"}
      </p>

      {!confirmingDisconnect ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmingDisconnect(true)}
          className={styles.disconnectTrigger}
        >
          <LogOut size={14} /> Disconnect CodeForge
        </Button>
      ) : (
        <div className={styles.confirmRow}>
          <p className={styles.confirmText}>Forget your saved CodeForge roll number and password?</p>
          <div className={styles.confirmActions}>
            <Button variant="secondary" size="sm" onClick={() => setConfirmingDisconnect(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" loading={disconnectMutation.isPending} onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
