import type { ReactNode } from "react";
import { Inbox, type IconComponent } from "./icons";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  icon?: IconComponent;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** SRS §50 — every list/page needs a purpose-built empty state, never a blank screen. */
export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.wrapper} role="status">
      <div className={styles.iconWrap}>
        <Icon size={28} strokeWidth={1.75} />
      </div>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
