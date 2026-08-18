import { useState, type FormEvent } from "react";
import { Code2, Eye, EyeOff, LogOut, PlugZap, RefreshCw } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useConnectHub, useDisconnectHub, useHubAttendance } from "@/hooks/useHubAttendance";
import { HubAttendanceError } from "@/services/attendance/hubAttendanceService";
import styles from "./HubPortalCard.module.css";

/**
 * Where a student sets up (and manages) their Hub/Maya login — Profile, not
 * Home. Home's HubAttendanceCard only ever *reads* this connection and
 * points here when there isn't one; entering the credential lives in exactly
 * one place, matching CollegePortalSyncCard's role for the AEC/ACET/AUS
 * portal just above it in ProfilePage.
 */
export function HubPortalCard() {
  const { data, isLoading, refetch, isFetching } = useHubAttendance(true);
  const connectMutation = useConnectHub();
  const disconnectMutation = useDisconnectHub();
  const [rollNumber, setRollNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  async function handleConnect(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!rollNumber.trim() || !password) {
      setFormError("Enter both your Hub roll number and password.");
      return;
    }
    try {
      await connectMutation.mutateAsync({ rollNumber: rollNumber.trim().toUpperCase(), password });
      setRollNumber("");
      setPassword("");
    } catch (error) {
      setFormError(error instanceof HubAttendanceError ? error.message : "Could not connect to the Hub.");
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
        <div className={styles.header}>
          <span className={styles.headerIcon} aria-hidden="true">
            <Code2 size={16} />
          </span>
          <p className={styles.title}>Connect the Hub</p>
        </div>

        <p className={styles.hint}>
          CodeForge and skills-hour attendance from Maya, alongside your regular attendance. This is
          your Hub login, separate from your Handy account — saved so you won&rsquo;t need to sign in
          again.
        </p>

        <form className={styles.form} onSubmit={handleConnect}>
          <label className={styles.field}>
            <span className={styles.labelText}>Hub Roll Number</span>
            <input
              className={styles.input}
              type="text"
              inputMode="text"
              autoComplete="username"
              autoCapitalize="characters"
              placeholder="26B21CS058"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.labelText}>Hub Password</span>
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
            <PlugZap size={16} /> Connect Hub
          </Button>
        </form>
      </Card>
    );
  }

  const snapshot = data.snapshot;

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <Code2 size={16} />
        </span>
        <div className={styles.headerBody}>
          <p className={styles.title}>Hub connected</p>
          <p className={styles.subtitle}>Roll number {snapshot?.rollNumber ?? "—"}</p>
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh Hub attendance"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <p className={styles.value}>
        {snapshot?.percentage == null ? "N/A" : `${snapshot.percentage.toFixed(2)}%`}
      </p>
      <p className={styles.footnote}>
        {snapshot
          ? `${snapshot.attendedSessions}/${snapshot.totalSessions} sessions across ${snapshot.courses.length} ${
              snapshot.courses.length === 1 ? "course" : "courses"
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
          <LogOut size={14} /> Disconnect Hub
        </Button>
      ) : (
        <div className={styles.confirmRow}>
          <p className={styles.confirmText}>Forget your saved Hub roll number and password?</p>
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
