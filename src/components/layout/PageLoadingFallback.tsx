import { BrandLoader } from "./BrandLoader";
import styles from "./PageLoadingFallback.module.css";

/** Suspense fallback for lazy-loaded route chunks — shown only on the initial fetch of a page's code. */
export function PageLoadingFallback() {
  return (
    <div className={styles.wrapper}>
      <BrandLoader />
    </div>
  );
}
