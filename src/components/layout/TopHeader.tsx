import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "@/components/ui/icons";
import styles from "./TopHeader.module.css";

interface TopHeaderProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
}

export function TopHeader({ title, subtitle, back, action }: TopHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <div className={styles.titleGroup}>
          {back && (
            <button
              type="button"
              className={styles.backButton}
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className={styles.title}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
        </div>
        {action && <div className={styles.action}>{action}</div>}
      </div>
    </header>
  );
}
