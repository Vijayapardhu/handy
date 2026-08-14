import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Target, CheckCircle2, Info, Flag, ShieldCheck, TrendingDown } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { SUBJECT_ICONS } from "@/constants/subjectIcons";
import { useSubjectsWithAttendance } from "@/hooks/useSubjects";
import { useCollegeConfig } from "@/hooks/useCollegeConfig";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  aggregateAttendance,
  calculateProjectedAttendance,
  calculateRequiredClasses,
  calculateSafeAbsences,
  roundPercentage,
} from "@/lib/calculations/attendance";
import { cn } from "@/lib/utils/cn";
import styles from "./AttendancePlannerPage.module.css";

type Tab = "reach" | "regular" | "goals";

export function AttendancePlannerPage() {
  const { subjectId } = useParams<{ subjectId?: string }>();
  const { student } = useAuth();
  const subjectsQuery = useSubjectsWithAttendance();
  const configQuery = useCollegeConfig(student?.collegeId);
  const [tab, setTab] = useState<Tab>("reach");
  const [regularClassesPerWeek, setRegularClassesPerWeek] = useState(5);

  const subjects = useMemo(() => {
    if (!subjectsQuery.data) return [];
    return subjectId ? subjectsQuery.data.filter((s) => s.subjectId === subjectId) : subjectsQuery.data;
  }, [subjectsQuery.data, subjectId]);

  const overall = useMemo(() => {
    if (!subjectsQuery.data) return null;
    return aggregateAttendance(subjectsQuery.data.map((s) => ({ attended: s.attended, held: s.held })));
  }, [subjectsQuery.data]);

  const target = configQuery.data?.minimumAttendancePercentage ?? 75;
  const onTrackCount = subjects.filter((s) => (s.percentage ?? 0) >= s.targetAttendance).length;

  const isLoading = subjectsQuery.isLoading || configQuery.isLoading;
  const isError = subjectsQuery.isError || configQuery.isError;

  return (
    <div className="page-narrow">
      <TopHeader title="Attendance Planner" subtitle="Plan your path to the target" back={Boolean(subjectId)} />

      {isLoading && <Skeleton height={92} className={styles.summarySkeleton} />}

      {!isLoading && !isError && (
        <Card className={styles.summaryCard}>
          <div>
            <p className={styles.summaryLabel}>Your Target</p>
            <p className={styles.summaryTarget}>{target}%</p>
            <p className={styles.summaryHint}>Minimum required by your college</p>
          </div>
          <div className={styles.summaryDivider} />
          <div>
            <p className={styles.summaryLabel}>Overall Attendance</p>
            <p className={styles.summaryOverall}>
              {overall?.percentage === null || overall?.percentage === undefined
                ? "N/A"
                : `${overall.percentage.toFixed(2)}%`}
            </p>
            {overall?.percentage !== null && overall?.percentage !== undefined && overall.percentage < target && (
              <p className={styles.summaryWarn}>Needs Improvement</p>
            )}
          </div>
        </Card>
      )}

      <div className={styles.tabs}>
        <button className={cn(styles.tab, tab === "reach" && styles.tabActive)} onClick={() => setTab("reach")}>
          <Target size={14} /> To Reach {target}%
        </button>
        <button className={cn(styles.tab, tab === "regular" && styles.tabActive)} onClick={() => setTab("regular")}>
          If I Attend Regularly
        </button>
        <button className={cn(styles.tab, tab === "goals" && styles.tabActive)} onClick={() => setTab("goals")}>
          <Flag size={14} /> Subject Goals
        </button>
      </div>

      {isError && <ErrorState message="Unable to load the planner right now." onRetry={() => { subjectsQuery.refetch(); configQuery.refetch(); }} />}

      {!isError && isLoading && (
        <div className={styles.loadingStack}>
          <Skeleton height={70} />
          <Skeleton height={70} />
          <Skeleton height={70} />
        </div>
      )}

      {!isError && !isLoading && subjects.length === 0 && (
        <EmptyState title="No subjects to plan" description="Your subjects haven't been published yet." />
      )}

      {!isError && !isLoading && subjects.length > 0 && tab === "reach" && (
        <div className={styles.list}>
          <p className={styles.listHint}>Attend consecutive classes to reach your target</p>
          {subjects.map((s) => {
            const Icon = SUBJECT_ICONS[s.icon];
            const result = calculateRequiredClasses(s.attended, s.held, s.targetAttendance);
            return (
              <Card key={s.subjectId} className={styles.row}>
                <span className={styles.rowIcon}>
                  <Icon size={18} />
                </span>
                <span className={styles.rowBody}>
                  <span className={styles.rowName}>{s.subjectName}</span>
                  <span className={styles.rowMeta}>
                    {s.attended} / {s.held} Classes Attended
                  </span>
                  <ProgressBar value={s.percentage ?? 0} status={s.status} className={styles.rowProgress} />
                </span>
                {result.status === "target_reached" ? (
                  <span className={styles.reached}>
                    <CheckCircle2 size={16} />
                    Target Reached
                    <span className={styles.reachedPct}>{s.percentage}%</span>
                  </span>
                ) : result.status === "unreachable" ? (
                  <span className={styles.unreachable}>Not reachable this term</span>
                ) : (
                  <span className={styles.need}>
                    Need
                    <span className={styles.needNumber}>{result.classesNeeded}</span>
                    consecutive classes
                  </span>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {!isError && !isLoading && subjects.length > 0 && tab === "regular" && (
        <div className={styles.list}>
          <label className={styles.sliderRow}>
            <span>Classes attended per week, per subject</span>
            <input
              type="range"
              min={0}
              max={10}
              value={regularClassesPerWeek}
              onChange={(e) => setRegularClassesPerWeek(Number(e.target.value))}
            />
            <span className={styles.sliderValue}>{regularClassesPerWeek}</span>
          </label>
          <p className={styles.listHint}>
            <Info size={13} /> Projection over the next 4 weeks if you attend this consistently — this never
            changes your official record.
          </p>
          {subjects.map((s) => {
            const Icon = SUBJECT_ICONS[s.icon];
            const futurePresent = regularClassesPerWeek * 4;
            const projected = roundPercentage(
              calculateProjectedAttendance(s.attended, s.held, futurePresent, 0),
            );
            return (
              <Card key={s.subjectId} className={styles.row}>
                <span className={styles.rowIcon}>
                  <Icon size={18} />
                </span>
                <span className={styles.rowBody}>
                  <span className={styles.rowName}>{s.subjectName}</span>
                  <span className={styles.rowMeta}>
                    {s.percentage ?? 0}% → {projected ?? "N/A"}% in 4 weeks
                  </span>
                </span>
              </Card>
            );
          })}
        </div>
      )}

      {!isError && !isLoading && subjects.length > 0 && tab === "goals" && (
        <div className={styles.list}>
          <p className={styles.listHint}>
            <Info size={13} /> Your goal for each subject is your college&rsquo;s minimum ({target}%), or a
            subject-specific target if one has been set.
          </p>
          {subjects.map((s) => {
            const Icon = SUBJECT_ICONS[s.icon];
            const onTrack = (s.percentage ?? 0) >= s.targetAttendance;
            const safe = calculateSafeAbsences(s.attended, s.held, s.targetAttendance);
            const required = calculateRequiredClasses(s.attended, s.held, s.targetAttendance);
            return (
              <Card key={s.subjectId} className={styles.goalCard}>
                <div className={styles.goalTop}>
                  <span className={styles.rowIcon}>
                    <Icon size={18} />
                  </span>
                  <span className={styles.rowBody}>
                    <span className={styles.rowName}>{s.subjectName}</span>
                    <span className={styles.rowMeta}>
                      Goal: {s.targetAttendance}% · Currently {s.percentage === null ? "N/A" : `${s.percentage}%`}
                    </span>
                  </span>
                  <span className={cn(styles.goalFlag, onTrack ? styles.goalFlagOn : styles.goalFlagOff)}>
                    <Flag size={14} />
                  </span>
                </div>
                <ProgressBar value={s.percentage ?? 0} status={s.status} />
                <p className={styles.goalNote}>
                  {onTrack ? (
                    safe.status === "can_miss" && safe.maxAbsences > 0 ? (
                      <>
                        <ShieldCheck size={13} /> You can miss <strong>{safe.maxAbsences}</strong> more class
                        {safe.maxAbsences === 1 ? "" : "es"} and stay at or above your goal.
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={13} /> Right at your goal — attending your next class keeps you safe.
                      </>
                    )
                  ) : required.status === "needs_classes" ? (
                    <>
                      <TrendingDown size={13} /> Attend <strong>{required.classesNeeded}</strong> classes in a row to
                      reach your goal.
                    </>
                  ) : (
                    <>
                      <TrendingDown size={13} /> Not reachable this term — talk to your department about
                      condonation options.
                    </>
                  )}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {!isError && !isLoading && subjects.length > 0 && (
        <div className={styles.footerBanner}>
          <p className={styles.footerTitle}>
            {onTrackCount === subjects.length ? "You're on the right track!" : "Stay consistent"}
          </p>
          <p className={styles.footerSubtitle}>{onTrackCount} / {subjects.length} subjects on track</p>
        </div>
      )}
    </div>
  );
}
