import { cn } from "@/lib/utils/cn";
import type { LeaveRequestStatus } from "@/types/leave";
import styles from "./LeaveStatusBadge.module.css";

const LABELS: Record<LeaveRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export function LeaveStatusBadge({ status }: { status: LeaveRequestStatus }) {
  return <span className={cn(styles.badge, styles[status])}>{LABELS[status]}</span>;
}
