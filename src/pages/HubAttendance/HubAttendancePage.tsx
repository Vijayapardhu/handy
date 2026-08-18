import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Code2, LogOut } from "@/components/ui/icons";
import { TopHeader } from "@/components/layout/TopHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDisconnectHub, useHubAttendance } from "@/hooks/useHubAttendance";
import { ROUTES } from "@/constants/routes";
import styles from "./HubAttendancePage.module.css";

/** Full breakdown behind the Home page's Hub Attendance card — course by course, module by module. */
export function HubAttendancePage() {
  const { data, isLoading, isError, refetch } = useHubAttendance(true);
  const disconnectMutation = useDisconnectHub();
  const navigate = useNavigate();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  async function handleDisconnect() {
    await disconnectMutation.mutateAsync();
    navigate(ROUTES.home, { replace: true });
  }

  const snapshot = data?.snapshot ?? null;

  return (
    <div>
      <TopHeader
        title="Hub Attendance"
        subtitle={snapshot?.studentName ?? undefined}
        back
        action={
          data?.linked ? (
            <button
              type="button"
              className={styles.disconnectButton}
              onClick={() => setConfirmingDisconnect(true)}
              aria-label="Disconnect the Hub"
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
          <ErrorState message="Couldn't load Hub attendance." onRetry={() => refetch()} />
        )}

        {!isLoading && !isError && !data?.linked && (
          <EmptyState
            icon={Code2}
            title="Hub not connected"
            description="Connect your Hub roll number and password from your Profile to see attendance here."
          />
        )}

        {!isLoading && !isError && data?.linked && snapshot && (
          <div className={styles.stack}>
            <Card className={styles.summaryCard}>
              <p className={styles.summaryLabel}>Overall Hub Attendance</p>
              <p className={styles.summaryValue}>
                {snapshot.percentage === null ? "N/A" : `${snapshot.percentage.toFixed(2)}%`}
              </p>
              <p className={styles.summarySub}>
                {snapshot.attendedSessions}/{snapshot.totalSessions} sessions across{" "}
                {snapshot.courses.length} {snapshot.courses.length === 1 ? "course" : "courses"}
              </p>
            </Card>

            {snapshot.courses.length === 0 ? (
              <EmptyState
                icon={Code2}
                title="Nothing recorded yet"
                description="The Hub hasn't reported any sessions for your courses yet."
              />
            ) : (
              <div className={styles.courseList}>
                {snapshot.courses.map((course) => (
                  <Card key={course.batchId} className={styles.courseCard}>
                    <div className={styles.courseHeader}>
                      <div>
                        <p className={styles.courseName}>{course.technologyName ?? course.courseName ?? "Course"}</p>
                        {course.courseName && course.courseName !== course.technologyName && (
                          <p className={styles.courseSub}>{course.courseName}</p>
                        )}
                      </div>
                      <span className={styles.coursePercentage}>
                        {course.percentage === null ? "N/A" : `${course.percentage.toFixed(0)}%`}
                      </span>
                    </div>

                    <ul className={styles.moduleList}>
                      {course.modules.map((module) => (
                        <li key={module.moduleId} className={styles.moduleRow}>
                          <div className={styles.moduleTop}>
                            <p className={styles.moduleName}>{module.moduleName}</p>
                            <span className={styles.moduleCount}>
                              {module.attendedSessions}/{module.totalSessions}
                            </span>
                          </div>
                          {module.topics.map((topic) => (
                            <div key={topic.topicName} className={styles.topicRow}>
                              <span>{topic.topicName}</span>
                              <span>
                                {topic.attendedCount}/{topic.totalSessions}
                              </span>
                            </div>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {confirmingDisconnect && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-label="Disconnect the Hub">
          <Card className={styles.confirmCard}>
            <p className={styles.confirmTitle}>Disconnect the Hub?</p>
            <p className={styles.confirmBody}>
              Handy will forget your Hub roll number and password. You can reconnect any time from
              Home.
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
