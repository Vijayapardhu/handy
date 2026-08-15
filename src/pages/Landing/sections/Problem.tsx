import styles from "../landing.module.css";
import { delay } from "../reveal";

/**
 * The reason the product exists, stated as a comparison rather than a claim.
 * The left card is deliberately not a criticism of the portal — it does its
 * job, which is recording the number. It just stops there.
 */
export function Problem() {
  return (
    <section className={styles.section}>
      <div className={`${styles.inner} ${styles.narrow}`}>
        <span className={styles.eyebrow} data-reveal>
          The gap
        </span>
        <h2 className={styles.h2} data-reveal style={delay(0.05)}>
          A percentage is a fact. It isn&rsquo;t a decision.
        </h2>
        <p className={styles.lede} data-reveal style={delay(0.1)}>
          Every student ends up doing the same arithmetic in their head at the worst possible moment —
          usually the night before, usually wrong.
        </p>
      </div>

      <div className={styles.inner}>
        <div className={styles.problemGrid}>
          <div className={styles.problemCard} data-reveal>
            <div className={styles.problemLabel}>What the portal gives you</div>
            <div className={styles.problemBig}>73.42%</div>
            <ul className={styles.problemList}>
              <li>
                <span className={`${styles.problemMark} ${styles.markNo}`} aria-hidden="true">
                  ×
                </span>
                Is that safe? Depends on a threshold nobody put on the page.
              </li>
              <li>
                <span className={`${styles.problemMark} ${styles.markNo}`} aria-hidden="true">
                  ×
                </span>
                Can I skip Friday? Work it out yourself, per subject.
              </li>
              <li>
                <span className={`${styles.problemMark} ${styles.markNo}`} aria-hidden="true">
                  ×
                </span>
                Which subject is dragging me down? Scroll and compare.
              </li>
              <li>
                <span className={`${styles.problemMark} ${styles.markNo}`} aria-hidden="true">
                  ×
                </span>
                Only while you are logged in, on a desktop site, on the college network.
              </li>
            </ul>
          </div>

          <div className={`${styles.problemCard} ${styles.problemCardGood}`} data-reveal style={delay(0.08)}>
            <div className={styles.problemLabel}>What Handy gives you</div>
            <div className={styles.problemBig}>6 more absences</div>
            <ul className={styles.problemList}>
              <li>
                <span className={`${styles.problemMark} ${styles.markYes}`} aria-hidden="true">
                  ✓
                </span>
                Exactly how many classes you can still miss and hold your target.
              </li>
              <li>
                <span className={`${styles.problemMark} ${styles.markYes}`} aria-hidden="true">
                  ✓
                </span>
                The cost of three days off, per subject, before you take them.
              </li>
              <li>
                <span className={`${styles.problemMark} ${styles.markYes}`} aria-hidden="true">
                  ✓
                </span>
                An eight-week trend, so you see a slide while it is still fixable.
              </li>
              <li>
                <span className={`${styles.problemMark} ${styles.markYes}`} aria-hidden="true">
                  ✓
                </span>
                On your home screen, offline, without opening anything.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
