import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import styles from "./ProgressRing.module.css";

interface ProgressRingProps {
  /** 0-100. Values are clamped. */
  percent: number;
  size?: number;
  strokeWidth?: number;
  /** CSS color. Defaults to the app accent — pass a platform brand color to break from it deliberately. */
  color?: string;
  trackColor?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * The ring OverallAttendanceCard drew first, pulled out so the rest of the
 * app can use the same flagship visual instead of re-deriving the SVG math
 * per screen. That card is still the reference for "what a ring on this app
 * looks like" — this only generalises it (any percent, any size, any color).
 */
export function ProgressRing({
  percent,
  size = 84,
  strokeWidth = 8,
  color,
  trackColor,
  children,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const dash = (clamped / 100) * circumference;
  const center = size / 2;

  return (
    <div className={cn(styles.ring, className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="presentation">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor ?? "var(--color-border)"}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color ?? "var(--color-primary)"}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
          className={styles.fill}
        />
      </svg>
      {children && (
        <div className={styles.center} aria-hidden="true">
          {children}
        </div>
      )}
    </div>
  );
}
