import { cn } from "@/lib/utils/cn";
import styles from "./Skeleton.module.css";

/** SRS §49 — meaningful loading states, never a blank screen. */
export function Skeleton({ className, height = 16 }: { className?: string; height?: number }) {
  return <div className={cn(styles.skeleton, className)} style={{ height }} />;
}

export function SkeletonCard() {
  return (
    <div className={styles.card}>
      <Skeleton height={14} className={styles.w60} />
      <Skeleton height={28} className={styles.w40} />
      <Skeleton height={8} className={styles.w100} />
    </div>
  );
}
