import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ExternalLink, RefreshCw, CheckCircle2, AlertTriangle, DownloadCloud } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { useCollegePortalSync } from "@/hooks/useCollegePortalSync";
import { importCollegePortalSnapshot } from "@/services/students/collegePortalImportService";
import { emailToRollNumber } from "@/services/firebase/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ROUTES } from "@/constants/routes";
import styles from "./ConnectPortalPage.module.css";

const PORTAL_URL = "https://info.aec.edu.in/aus/";

/**
 * Shown when a signed-in account has no data yet (`profileComplete: false`).
 *
 * Normally nobody sees this: the extension creates the account and syncs the
 * data in the same breath, so the first sign-in already has everything. It's
 * reachable for the case where the two came apart — signed in on a device
 * whose extension hasn't run, or a sync that failed — and gives two ways
 * forward: wait for the extension and re-check, or import a capture this
 * browser already holds.
 */
export function ConnectPortalPage() {
  const { user, student, refreshStudent } = useAuth();
  const navigate = useNavigate();
  const { isAvailable, isCheckingAvailability, snapshot, isSyncing, sync } = useCollegePortalSync();
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  if (!user) return <Navigate to={ROUTES.login} replace />;
  // Data arrived (most likely the extension synced it) — nothing to do here.
  if (student?.profileComplete) return <Navigate to={ROUTES.home} replace />;

  async function handleCheck() {
    await Promise.all([sync(), refreshStudent()]);
    setChecked(true);
  }

  async function handleImport() {
    if (!snapshot || !user) return;
    // `student` can still be null if the profile fetch lost its race, so fall
    // back to the roll number encoded in the Auth email.
    const rollNumber = student?.rollNumber ?? emailToRollNumber(user.email);
    if (!rollNumber) {
      setImportError("Couldn't determine your roll number. Try signing out and back in.");
      return;
    }
    setImportError(null);
    setImporting(true);
    try {
      await importCollegePortalSnapshot(user.uid, rollNumber, snapshot);
      await refreshStudent();
      navigate(ROUTES.home, { replace: true });
    } catch {
      setImportError("Couldn't save your data. Check your connection and try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Waiting for your data</h1>
        <p className={styles.subtitle}>
          Handy reads your attendance from Campus Connect through the Handy College Sync extension.
          Nothing has arrived for this account yet.
        </p>
      </div>

      <Card className={styles.card}>
        <ol className={styles.steps}>
          <li>
            Open{" "}
            <a href={PORTAL_URL} target="_blank" rel="noreferrer" className={styles.link}>
              Campus Connect <ExternalLink size={12} />
            </a>{" "}
            in a browser with the extension installed, and sign in as you normally would.
          </li>
          <li>Open your Student Profile page. The extension does the rest by itself.</li>
          <li>Come back here and check again.</li>
        </ol>

        <Button
          variant="secondary"
          fullWidth
          onClick={handleCheck}
          loading={isSyncing || isCheckingAvailability}
        >
          <RefreshCw size={16} /> Check again
        </Button>

        {checked && !isAvailable && (
          <p className={styles.hint}>
            Extension not detected in this browser. Your data will still be here once it syncs from
            wherever it is installed.
          </p>
        )}

        {snapshot && (
          <div className={styles.preview}>
            <div className={styles.previewHeader}>
              <CheckCircle2 size={16} className={styles.checkIcon} />
              <span>
                Found <strong>{snapshot.studentName ?? snapshot.rollNumber}</strong> —{" "}
                {snapshot.attendance.subjects.length} subjects
                {snapshot.timetable ? `, timetable ${snapshot.timetable.name}` : ""}
              </span>
            </div>

            {importError && (
              <p className={styles.warning}>
                <AlertTriangle size={14} /> {importError}
              </p>
            )}

            <Button fullWidth onClick={handleImport} loading={importing}>
              <DownloadCloud size={16} /> Use this data
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
