import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Code2, LogOut } from "@/components/ui/icons";
import { TopHeader } from "@/components/layout/TopHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { codeForgeStats, getHubStatus } from "@/lib/calculations/hubAttendance";
import { useDisconnectHub, useHubAttendance } from "@/hooks/useHubAttendance";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { HubCourse, HubModule } from "@/types/hubAttendance";
import styles from "./HubAttendancePage.module.css";

/** A single topic whose name is just the module's name again says nothing extra — skip listing it twice. */
function hasDistinctTopics(module: HubModule): boolean {
  if (module.topics.length > 1) return true;
  if (module.topics.length === 0) return false;
  return module.topics[0].topicName.trim().toLowerCase() !== module.moduleName.trim().toLowerCase();
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** A student can be enrolled in the same course (e.g. "Arithmetic Ability") across separate batches — batchId alone doesn't distinguish them. */
function courseKey(course: HubCourse): string {
  return `${course.batchId}_${course.technologyId}`;
}

/**
 * Full breakdown behind the Home page's Hub Attendance card.
 *
 * A course can carry a couple dozen modules the student hasn't reached yet
 * (0/0 sessions) — dumping every one flat, as this page originally did, reads
 * as noise before it reads as data. Two disclosure levels fix that: courses
 * collapse to a name and a percentage until tapped, and within an opened
 * course, modules that haven't started yet collapse behind their own toggle
 * rather than padding out the list the student actually came to read.
 */
export function HubAttendancePage() {
  const { data, isLoading, isError, refetch } = useHubAttendance(true);
  const disconnectMutation = useDisconnectHub();
  const navigate = useNavigate();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [openCourses, setOpenCourses] = useState<Set<string>>(new Set());
  const [openUpcoming, setOpenUpcoming] = useState<Set<string>>(new Set());

  const snapshot = data?.snapshot ?? null;

  // CodeForge only for the headline; the list further down still shows every
  // course, sectioned, because a student does want to see the ability ones —
  // they just do not belong in the CodeForge percentage.
  const cf = useMemo(() => (snapshot ? codeForgeStats(snapshot) : null), [snapshot]);

  // Worst attendance first (the one that most needs looking at is already
  // visible); courses that haven't started yet trail behind, by name rather
  // than by a percentage that doesn't exist.
  const sortCourses = (courses: HubCourse[]) =>
    [...courses].sort((a, b) => {
      const aStarted = a.percentage !== null;
      const bStarted = b.percentage !== null;
      if (aStarted !== bStarted) return aStarted ? -1 : 1;
      if (aStarted && bStarted) return (a.percentage as number) - (b.percentage as number);
      return (a.technologyName ?? "").localeCompare(b.technologyName ?? "");
    });

  const codeForgeCourses = useMemo(() => sortCourses(cf?.courses ?? []), [cf]);
  const otherCourses = useMemo(() => sortCourses(cf?.otherCourses ?? []), [cf]);

  async function handleDisconnect() {
    await disconnectMutation.mutateAsync();
    navigate(ROUTES.home, { replace: true });
  }

  return (
    <div>
      <TopHeader
        title="CodeForge Attendance"
        subtitle={snapshot?.studentName ?? undefined}
        back
        action={
          data?.linked ? (
            <button
              type="button"
              className={styles.disconnectButton}
              onClick={() => setConfirmingDisconnect(true)}
              aria-label="Disconnect CodeForge"
            >
              <LogOut size={18} />
            </button>
          ) : undefined
        }
      />

      <div className={styles.page}>
        {isLoading && (
          <div className={styles.stack}>
            <Skeleton height={110} />
            <Skeleton height={220} />
          </div>
        )}

        {!isLoading && isError && (
          <ErrorState message="Couldn't load CodeForge attendance." onRetry={() => refetch()} />
        )}

        {!isLoading && !isError && !data?.linked && (
          <EmptyState
            icon={Code2}
            title="CodeForge not connected"
            description="Connect your CodeForge roll number and password from your Profile to see attendance here."
          />
        )}

        {!isLoading && !isError && data?.linked && snapshot && (
          <div className={styles.stack}>
            <Card className={styles.summaryCard}>
              <div className={styles.summaryTop}>
                <div>
                  <p className={styles.summaryLabel}>Overall CodeForge Attendance</p>
                  <p className={styles.summaryValue}>
                    {cf === null || cf.percentage === null ? "N/A" : `${cf.percentage.toFixed(2)}%`}
                  </p>
                </div>
                <StatusBadge status={getHubStatus(cf?.percentage ?? null)} />
              </div>

              <ProgressBar value={cf?.percentage ?? 0} status={getHubStatus(cf?.percentage ?? null)} />

              <p className={styles.summarySub}>
                {cf?.attendedSessions ?? 0}/{cf?.totalSessions ?? 0} sessions across{" "}
                {codeForgeCourses.length} CodeForge{" "}
                {codeForgeCourses.length === 1 ? "course" : "courses"}
              </p>
            </Card>

            {codeForgeCourses.length === 0 && otherCourses.length === 0 ? (
              <EmptyState
                icon={Code2}
                title="Nothing recorded yet"
                description="CodeForge hasn't reported any sessions for your courses yet."
              />
            ) : (
              <div className={styles.courseList}>
                {/* CodeForge first — what the headline counts — then the
                    ability courses under their own heading, so it is clear
                    which feed the percentage and which do not. */}
                {codeForgeCourses.map((course) => (
                  <CourseAccordion
                    key={courseKey(course)}
                    course={course}
                    open={openCourses.has(courseKey(course))}
                    onToggle={() => setOpenCourses((s) => toggleInSet(s, courseKey(course)))}
                    upcomingOpen={openUpcoming.has(courseKey(course))}
                    onToggleUpcoming={() => setOpenUpcoming((s) => toggleInSet(s, courseKey(course)))}
                  />
                ))}
                {otherCourses.length > 0 && (
                  <p className={styles.sectionLabel}>Also on your Maya login</p>
                )}
                {otherCourses.map((course) => (
                  <CourseAccordion
                    key={courseKey(course)}
                    course={course}
                    open={openCourses.has(courseKey(course))}
                    onToggle={() => setOpenCourses((s) => toggleInSet(s, courseKey(course)))}
                    upcomingOpen={openUpcoming.has(courseKey(course))}
                    onToggleUpcoming={() => setOpenUpcoming((s) => toggleInSet(s, courseKey(course)))}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {confirmingDisconnect && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-label="Disconnect CodeForge">
          <Card className={styles.confirmCard}>
            <p className={styles.confirmTitle}>Disconnect CodeForge?</p>
            <p className={styles.confirmBody}>
              Handy will forget your CodeForge roll number and password. You can reconnect any time
              from your Profile.
            </p>
            <div className={styles.confirmActions}>
              <Button variant="secondary" size="sm" onClick={() => setConfirmingDisconnect(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={disconnectMutation.isPending}
                onClick={handleDisconnect}
              >
                Disconnect
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function CourseAccordion({
  course,
  open,
  onToggle,
  upcomingOpen,
  onToggleUpcoming,
}: {
  course: HubCourse;
  open: boolean;
  onToggle: () => void;
  upcomingOpen: boolean;
  onToggleUpcoming: () => void;
}) {
  const title = course.technologyName ?? course.courseName ?? "Course";
  const showBadgeLine = Boolean(course.courseName && course.courseName !== course.technologyName);
  const startedModules = course.modules.filter((m) => m.totalSessions > 0);
  const upcomingModules = course.modules.filter((m) => m.totalSessions === 0);
  const status = getHubStatus(course.percentage);

  return (
    <Card padded={false} className={styles.courseCard}>
      <button type="button" className={styles.courseHeader} onClick={onToggle} aria-expanded={open}>
        <span className={styles.courseHeaderIcon} aria-hidden="true">
          <Code2 size={18} />
        </span>
        <span className={styles.courseHeaderBody}>
          <span className={styles.courseName}>{title}</span>
          {showBadgeLine && <span className={styles.courseSub}>{course.courseName}</span>}
        </span>
        <span className={styles.coursePercentage} data-status={status}>
          {course.percentage === null ? "N/A" : `${course.percentage.toFixed(0)}%`}
        </span>
        <ChevronDown size={16} className={cn(styles.chevron, open && styles.chevronOpen)} />
      </button>

      {open && (
        <div className={styles.courseBody}>
          {startedModules.length === 0 ? (
            <p className={styles.notStartedText}>No sessions held yet for this course.</p>
          ) : (
            <ul className={styles.moduleList}>
              {startedModules.map((module) => (
                <ModuleRow key={module.moduleId} module={module} />
              ))}
            </ul>
          )}

          {upcomingModules.length > 0 && (
            <div className={styles.upcomingSection}>
              <button type="button" className={styles.upcomingToggle} onClick={onToggleUpcoming}>
                {upcomingOpen ? "Hide" : "Show"} {upcomingModules.length}{" "}
                {upcomingModules.length === 1 ? "module" : "modules"} not started yet
                <ChevronDown size={13} className={cn(styles.chevron, upcomingOpen && styles.chevronOpen)} />
              </button>
              {upcomingOpen && (
                <ul className={styles.upcomingList}>
                  {upcomingModules.map((module) => (
                    <li key={module.moduleId} className={styles.upcomingRow}>
                      {module.moduleName}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ModuleRow({ module }: { module: HubModule }) {
  const showTopics = hasDistinctTopics(module);
  return (
    <li className={styles.moduleRow}>
      <div className={styles.moduleTop}>
        <p className={styles.moduleName}>{module.moduleName}</p>
        <span className={styles.moduleCount}>
          {module.attendedSessions}/{module.totalSessions}
        </span>
      </div>
      {showTopics &&
        module.topics.map((topic) => (
          <div key={topic.topicName} className={styles.topicRow}>
            <span>{topic.topicName}</span>
            <span>
              {topic.attendedCount}/{topic.totalSessions}
            </span>
          </div>
        ))}
    </li>
  );
}
