import { Link } from "react-router-dom";
import { FileText, Plus, CalendarClock } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { LeaveStatusBadge } from "@/components/leaves/LeaveStatusBadge";
import { useLeaveRequests } from "@/hooks/useLeaves";
import { formatDisplayDate, formatShortDate } from "@/lib/date";
import { ROUTES } from "@/constants/routes";
import styles from "./LeavesPage.module.css";

export function LeavesPage() {
  const { data: leaves, isLoading, isError, refetch } = useLeaveRequests();

  return (
    <div>
      <TopHeader
        title="Leaves"
        subtitle="Requests, planner and history"
        action={
          <Link to={ROUTES.leaveRequestNew}>
            <Button size="sm">
              <Plus size={14} /> New
            </Button>
          </Link>
        }
      />

      <Link to={ROUTES.leavePlanner} className={styles.plannerCta}>
        <span className={styles.plannerIcon}>
          <CalendarClock size={18} />
        </span>
        <span>
          <span className={styles.plannerTitle}>Leave Planner</span>
          <span className={styles.plannerSubtitle}>Check impact before you apply</span>
        </span>
      </Link>

      {isError && <ErrorState message="Unable to load your leave requests." onRetry={refetch} />}

      {!isError && isLoading && (
        <div className={styles.loadingStack}>
          <Skeleton height={80} />
          <Skeleton height={80} />
        </div>
      )}

      {!isError && !isLoading && leaves && leaves.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No leave requests"
          description="You don't have any leave requests yet."
          action={
            <Link to={ROUTES.leaveRequestNew}>
              <Button size="sm">Apply for leave</Button>
            </Link>
          }
        />
      )}

      {!isError && !isLoading && leaves && leaves.length > 0 && (
        <ul className={styles.list}>
          {leaves.map((leave) => (
            <li key={leave.id}>
              <Card className={styles.leaveCard}>
                <div className={styles.leaveTop}>
                  <span className={styles.leaveDates}>
                    {leave.startDate === leave.endDate
                      ? formatDisplayDate(leave.startDate)
                      : `${formatShortDate(leave.startDate)} – ${formatShortDate(leave.endDate)}`}
                  </span>
                  <LeaveStatusBadge status={leave.status} />
                </div>
                <p className={styles.leaveReason}>{leave.reason}</p>
                <p className={styles.leaveSubmitted}>
                  Submitted {formatDisplayDate(leave.submittedAt.slice(0, 10))}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
