import { cn } from "@/lib/utils/cn";
import type { StatusLevel } from "@/lib/calculations/attendance";
import styles from "./StatusBadge.module.css";

const LABELS: Record<StatusLevel, string> = {
  critical: "Critical",
  low: "Low",
  average: "Average",
  good: "Good",
  excellent: "Excellent",
  na: "N/A",
};

export function StatusBadge({ status, className }: { status: StatusLevel; className?: string }) {
  return <span className={cn(styles.badge, styles[status], className)}>{LABELS[status]}</span>;
}
