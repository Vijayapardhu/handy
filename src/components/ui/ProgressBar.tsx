import { cn } from "@/lib/utils/cn";
import type { StatusLevel } from "@/lib/calculations/attendance";
import styles from "./ProgressBar.module.css";

interface ProgressBarProps {
  /** 0-100. Values are clamped. */
  value: number;
  status?: StatusLevel;
  className?: string;
}

export function ProgressBar({ value, status = "good", className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn(styles.track, className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn(styles.fill, styles[status])} style={{ width: `${clamped}%` }} />
    </div>
  );
}
