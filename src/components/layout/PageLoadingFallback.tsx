import { Loader2 } from "lucide-react";
import styles from "./PageLoadingFallback.module.css";

/** Suspense fallback for lazy-loaded route chunks — shown only on the initial fetch of a page's code. */
export function PageLoadingFallback() {
  return (
    <div className={styles.wrapper} role="status" aria-label="Loading">
      <Loader2 size={28} className={styles.spinner} />
    </div>
  );
}
