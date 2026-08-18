import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Eye, EyeOff, GraduationCap, RefreshCw } from "@/components/ui/icons";
import { TopHeader } from "@/components/layout/TopHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/app/providers/AuthProvider";
import { useAcademicRecord } from "@/hooks/useAcademicRecord";
import { PortalSignInError } from "@/services/students/portalSignInService";
import { detectCampus, usesPortalLogin } from "@/lib/campus";
import { parseGradeNumber, projectRequiredSgpa } from "@/lib/calculations/academicRecord";
import { cn } from "@/lib/utils/cn";
import type { SemesterGrades } from "@/types/academicRecord";
import styles from "./GradesPage.module.css";

/**
 * Grades and CGPA, scraped by the same AEC/ACET/AGBS portal sign-in that
 * already reads attendance — that data was always fetched, just discarded the
 * moment the response was sent (see api/verify.js). AUS's portal has no
 * equivalent page, so this stays honestly empty for those students rather
 * than guessing.
 */
export function GradesPage() {
  const { student, signInWithPortal } = useAuth();
  const queryClient = useQueryClient();
  const recordQuery = useAcademicRecord();

  const campus = student ? detectCampus(student.rollNumber).campus : null;
  const supportsGrades = usesPortalLogin(campus);

  const [openSemesters, setOpenSemesters] = useState<Set<string>>(new Set());
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const [targetCgpa, setTargetCgpa] = useState("8.5");
  const [totalSemesters, setTotalSemesters] = useState("8");

  const record = recordQuery.data ?? null;
  const cgpaNumber = record ? parseGradeNumber(record.cgpa) : null;
  const completedSemesters = record?.grades.length ?? 0;

  const projection = useMemo(() => {
    if (cgpaNumber === null) return null;
    const target = parseGradeNumber(targetCgpa);
    const total = Number.parseInt(totalSemesters, 10);
    if (target === null || !Number.isFinite(total) || total <= 0) return null;
    return projectRequiredSgpa(cgpaNumber, completedSemesters, total, target);
  }, [cgpaNumber, completedSemesters, targetCgpa, totalSemesters]);

  async function handleRefresh(event: FormEvent) {
    event.preventDefault();
    if (!student || !campus || !password) return;
    setRefreshError(null);
    setRefreshing(true);
    try {
      await signInWithPortal(student.rollNumber, password, campus);
      setPassword("");
      setRefreshOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["academicRecord"] });
    } catch (error) {
      setRefreshError(error instanceof PortalSignInError ? error.message : "Couldn't refresh your grades.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="page-narrow">
      <TopHeader
        title="Grades & CGPA"
        subtitle={record ? `Last updated ${new Date(record.updatedAt).toLocaleDateString()}` : undefined}
        back
        action={
          supportsGrades && record ? (
            <button
              type="button"
              className={styles.refreshButton}
              onClick={() => setRefreshOpen((v) => !v)}
              aria-label="Refresh grades"
            >
              <RefreshCw size={16} />
            </button>
          ) : undefined
        }
      />

      {!supportsGrades && (
        <EmptyState
          icon={GraduationCap}
          title="Not available for your college"
          description="Your college's portal doesn't expose semester grades the way it does attendance, so Handy has nothing to show here yet."
        />
      )}

      {supportsGrades && recordQuery.isLoading && (
        <div className={styles.stack}>
          <Skeleton height={140} />
          <Skeleton height={180} />
        </div>
      )}

      {supportsGrades && !recordQuery.isLoading && (
        <div className={styles.stack}>
          {(refreshOpen || !record) && (
            <Card className={styles.refreshCard}>
              <p className={styles.refreshTitle}>
                {record ? "Refresh your grades" : "Pull your grades from the portal"}
              </p>
              <p className={styles.refreshHint}>
                The same password you use on Campus Connect. It&rsquo;s sent to the college to read
                your grades and is never saved by Handy.
              </p>
              <form className={styles.refreshForm} onSubmit={handleRefresh}>
                <div className={styles.passwordWrap}>
                  <input
                    className={styles.input}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Portal password"
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
                {refreshError && (
                  <p className={styles.refreshError} role="alert">
                    {refreshError}
                  </p>
                )}
                <Button type="submit" fullWidth size="sm" loading={refreshing}>
                  {record ? "Refresh" : "Fetch my grades"}
                </Button>
              </form>
            </Card>
          )}

          {record && (
            <>
              <Card className={styles.cgpaCard}>
                <p className={styles.cgpaLabel}>Overall CGPA</p>
                <p className={styles.cgpaValue}>{record.cgpa === "N/A" ? "N/A" : record.cgpa}</p>
                <p className={styles.cgpaMeta}>
                  Across {completedSemesters} {completedSemesters === 1 ? "semester" : "semesters"}
                </p>
              </Card>

              {cgpaNumber !== null && (
                <Card className={styles.calcCard}>
                  <p className={styles.calcTitle}>What CGPA do I need?</p>
                  <p className={styles.calcHint}>
                    An estimate, not exact — it treats every semester as equally weighted, since credit
                    counts per subject aren&rsquo;t part of what the portal reports.
                  </p>
                  <div className={styles.calcRow}>
                    <label className={styles.calcField}>
                      <span>Target CGPA</span>
                      <input
                        className={styles.calcInput}
                        type="number"
                        step="0.01"
                        min="0"
                        max="10"
                        value={targetCgpa}
                        onChange={(e) => setTargetCgpa(e.target.value)}
                      />
                    </label>
                    <label className={styles.calcField}>
                      <span>Total semesters</span>
                      <input
                        className={styles.calcInput}
                        type="number"
                        step="1"
                        min={completedSemesters || 1}
                        value={totalSemesters}
                        onChange={(e) => setTotalSemesters(e.target.value)}
                      />
                    </label>
                  </div>

                  {projection && (
                    <p className={styles.calcResult}>
                      {projection.alreadyMet ? (
                        <>You&rsquo;ve already secured this target — even a 0 the rest of the way wouldn&rsquo;t lose it.</>
                      ) : projection.impossible ? (
                        <>
                          Not reachable from here — it would need an average SGPA of{" "}
                          <strong>{projection.neededAverageSgpa}</strong>, past the 10-point scale.
                        </>
                      ) : (
                        <>
                          You need an average SGPA of <strong>{projection.neededAverageSgpa}</strong> across
                          your remaining semesters.
                        </>
                      )}
                    </p>
                  )}
                </Card>
              )}

              <div className={styles.semesterList}>
                {[...record.grades].reverse().map((semester, index) => (
                  <SemesterAccordion
                    key={`${semester.semester}-${index}`}
                    semester={semester}
                    open={openSemesters.has(semester.semester)}
                    onToggle={() =>
                      setOpenSemesters((s) => {
                        const next = new Set(s);
                        if (next.has(semester.semester)) next.delete(semester.semester);
                        else next.add(semester.semester);
                        return next;
                      })
                    }
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SemesterAccordion({
  semester,
  open,
  onToggle,
}: {
  semester: SemesterGrades;
  open: boolean;
  onToggle: () => void;
}) {
  const hasFailure = semester.subjects.some((s) => s.result === "F");

  return (
    <Card padded={false} className={styles.semesterCard}>
      <button type="button" className={styles.semesterHeader} onClick={onToggle} aria-expanded={open}>
        <span className={styles.semesterName}>{semester.semester}</span>
        <span className={cn(styles.semesterSgpa, hasFailure && styles.semesterSgpaWarn)}>
          SGPA {semester.sgpa}
        </span>
        <ChevronDown size={16} className={cn(styles.chevron, open && styles.chevronOpen)} />
      </button>

      {open && (
        <ul className={styles.subjectList}>
          {semester.subjects.map((subject) => (
            <li key={subject.sNo} className={styles.subjectRow}>
              <span className={styles.subjectName}>{subject.courseName}</span>
              <span className={cn(styles.subjectGrade, subject.result === "F" && styles.subjectGradeFail)}>
                {subject.grade}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
