import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ExternalLink, Trash2, PlugZap, DownloadCloud } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getAttendanceStatus } from "@/lib/calculations/attendance";
import { useCollegePortalSync } from "@/hooks/useCollegePortalSync";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  importCollegePortalSnapshot,
  selfImportSemesterId,
} from "@/services/students/collegePortalImportService";
import styles from "./CollegePortalSyncCard.module.css";

const PORTAL_URL = "https://info.aec.edu.in/aus/";

// Local preview thresholds — independent of the college-configured thresholds
// used for official attendance elsewhere in the app (this card previews an
// external, unofficial snapshot, not the Firestore-backed numbers).
const PREVIEW_THRESHOLDS = { critical: 0, low: 50, average: 65, good: 75, excellent: 90 };

export function CollegePortalSyncCard() {
  const { user, student, refreshStudent } = useAuth();
  const queryClient = useQueryClient();
  const { isAvailable, isCheckingAvailability, snapshot, isSyncing, sync, clear } = useCollegePortalSync();
  const [justSynced, setJustSynced] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [justImported, setJustImported] = useState(false);

  /**
   * Importing rewrites the student's semesterId into their private
   * `self-<uid>` namespace, which for an admin-provisioned account would
   * silently cut them off from their real cohort's subjects and timetable.
   * So the write is offered only to students whose record already came from
   * a portal import in the first place.
   */
  const isSelfImported = Boolean(student && student.semesterId === selfImportSemesterId(student.id));

  async function handleSync() {
    await sync();
    setJustSynced(true);
    setTimeout(() => setJustSynced(false), 2000);
  }

  async function handleImport() {
    if (!snapshot || !user || !student) return;
    setImportError(null);
    setImporting(true);
    try {
      await importCollegePortalSnapshot(user.uid, student.rollNumber, snapshot);
      await refreshStudent();
      // Home and the subject screens read these; without this they'd keep
      // showing the pre-sync numbers until the cache expired on its own.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subjectsWithAttendance"] }),
        queryClient.invalidateQueries({ queryKey: ["attendanceSummary"] }),
        queryClient.invalidateQueries({ queryKey: ["subject"] }),
      ]);
      setJustImported(true);
      setTimeout(() => setJustImported(false), 2500);
    } catch {
      setImportError("Couldn't update your attendance. Check your connection and try again.");
    } finally {
      setImporting(false);
    }
  }

  if (isCheckingAvailability) {
    return null;
  }

  if (!isAvailable) {
    return (
      <Card className={styles.card}>
        <div className={styles.notInstalled}>
          <PlugZap size={18} className={styles.plugIcon} />
          <div>
            <p className={styles.title}>Sync from College Portal</p>
            <p className={styles.hint}>
              Install the "Handy College Sync" browser extension, then log into Campus Connect and open
              your Student Profile page — it reads your attendance from the page you're already logged
              into and hands it to Handy. See <code>extension/README.md</code> for setup.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <p className={styles.title}>Sync from College Portal</p>
        <Button variant="secondary" size="sm" onClick={handleSync} loading={isSyncing}>
          <RefreshCw size={14} /> {justSynced ? "Synced" : "Sync now"}
        </Button>
      </div>

      {!snapshot && (
        <p className={styles.hint}>
          No snapshot yet. Open{" "}
          <a href={PORTAL_URL} target="_blank" rel="noreferrer" className={styles.link}>
            Campus Connect <ExternalLink size={12} />
          </a>{" "}
          and view your Student Profile page, then come back and sync.
        </p>
      )}

      {snapshot && (
        <>
          <p className={styles.captured}>Captured {new Date(snapshot.capturedAt).toLocaleString()}</p>

          {snapshot.attendance.total && (
            <div className={styles.total}>
              <span className={styles.totalValue}>{snapshot.attendance.total.percent.toFixed(2)}%</span>
              <span className={styles.totalMeta}>
                {snapshot.attendance.total.attended}/{snapshot.attendance.total.held} classes overall
              </span>
            </div>
          )}

          <div className={styles.subjects}>
            {snapshot.attendance.subjects.map((subject) => (
              <div key={subject.slNo} className={styles.subjectRow}>
                <span className={styles.subjectName}>{subject.name}</span>
                <span className={styles.subjectMeta}>
                  {subject.attended}/{subject.held}
                </span>
                <StatusBadge status={getAttendanceStatus(subject.percent, PREVIEW_THRESHOLDS)} />
              </div>
            ))}
          </div>

          {isSelfImported && (
            <Button fullWidth onClick={handleImport} loading={importing} className={styles.importBtn}>
              <DownloadCloud size={14} /> {justImported ? "Attendance updated" : "Update my attendance"}
            </Button>
          )}

          {!isSelfImported && (
            <p className={styles.hint}>
              Your attendance is maintained by your college, so this stays a read-only preview — importing
              would replace your official record with this snapshot.
            </p>
          )}

          {importError && <p className={styles.warning}>{importError}</p>}

          <Button variant="ghost" size="sm" onClick={clear} className={styles.clearBtn}>
            <Trash2 size={14} /> Clear captured snapshot
          </Button>
        </>
      )}
    </Card>
  );
}
