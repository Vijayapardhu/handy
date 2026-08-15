import styles from "../landing.module.css";

/**
 * The Today screen, rebuilt in DOM.
 *
 * A screenshot would be a few hundred kilobytes, go soft on a high-DPI
 * display, and need regenerating every time the app's design moves. This is a
 * couple of kilobytes of markup that stays crisp at any zoom and can be edited
 * in place — and because it uses the same colours the app does, it can't drift
 * into showing a palette the product never had.
 *
 * The numbers are illustrative, not a real student's.
 */
export function PhoneMockup() {
  return (
    <div className={styles.phone} role="img" aria-label="The Handy app showing today's classes and overall attendance">
      <div className={styles.phoneScreen}>
        <span className={styles.phoneNotch} />

        <div className={styles.screenBody}>
          <div>
            <div className={styles.screenDate}>Friday, 15 August</div>
            <div className={styles.screenGreeting}>Good morning</div>
          </div>

          <div className={styles.screenCard}>
            <div className={styles.screenPctRow}>
              <span className={styles.screenPct}>82.14%</span>
              <span className={styles.screenPctLabel}>overall</span>
            </div>
            <div className={styles.screenBar}>
              <span className={styles.screenBarFill} />
            </div>
            <p className={styles.screenHint}>You can miss 6 more classes and still hold 75%.</p>
          </div>

          <div className={styles.screenSectionLabel}>Today</div>

          <div className={`${styles.screenClass} ${styles.screenClassNow}`}>
            <span className={styles.screenClassTime}>09:10</span>
            <span className={styles.screenClassName}>Operating Systems</span>
            <span className={styles.screenClassRoom}>C-204</span>
          </div>
          <div className={styles.screenClass}>
            <span className={styles.screenClassTime}>11:00</span>
            <span className={styles.screenClassName}>DBMS</span>
            <span className={styles.screenClassRoom}>C-118</span>
          </div>
          <div className={styles.screenClass}>
            <span className={styles.screenClassTime}>01:40</span>
            <span className={styles.screenClassName}>Java Lab</span>
            <span className={styles.screenClassRoom}>Lab-3</span>
          </div>
        </div>

        <div className={styles.screenNav} aria-hidden="true">
          {["Today", "Subjects", "Timetable", "Tasks"].map((label, i) => (
            <span
              key={label}
              className={`${styles.screenNavItem} ${i === 0 ? styles.screenNavItemActive : ""}`}
            >
              <span className={styles.screenNavIcon} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
