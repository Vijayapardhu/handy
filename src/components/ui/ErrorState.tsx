import { AlertTriangle } from "./icons";
import { Button } from "./Button";
import styles from "./ErrorState.module.css";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/** SRS §51 — always a human-readable message, technical detail stays in the console. */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className={styles.wrapper} role="alert">
      <AlertTriangle size={28} className={styles.icon} strokeWidth={1.75} />
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
