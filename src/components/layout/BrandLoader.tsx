import styles from "./BrandLoader.module.css";

/**
 * An animated take on the Handy mark, shown wherever the page has nothing
 * else to show yet — auth state resolving, a route chunk still downloading.
 *
 * Replaces a generic spinner ring with the one shape a visitor already
 * associates with Handy: the glyph draws itself in on arrival, then settles
 * into a slow breathing pulse for however long the wait turns out to be,
 * rather than sitting frozen or spinning forever with no sense of progress.
 */
export function BrandLoader() {
  return (
    <div className={styles.wrap} role="status" aria-label="Loading">
      <svg className={styles.mark} viewBox="0 0 100 100" aria-hidden="true">
        <rect className={styles.tile} width="100" height="100" rx="22" />
        <path className={styles.glyph} d="M33 26 V74 M67 26 V74 M33 50 H67" strokeWidth="11" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}
