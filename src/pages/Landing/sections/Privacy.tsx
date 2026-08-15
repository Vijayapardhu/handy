import styles from "../landing.module.css";
import { delay } from "../reveal";

/**
 * What the extension reads and what it cannot see, stated as two lists rather
 * than a paragraph — this is the objection every student raises first, and a
 * wall of reassuring prose reads like evasion.
 *
 * Everything on the right is a genuine structural limit, not a policy promise:
 * the extension observes responses the portal already fetched and never issues
 * a request, so there is no path by which it could see a password.
 */
export function Privacy() {
  return (
    <section className={styles.section} id="privacy">
      <div className={`${styles.inner} ${styles.narrow} ${styles.sectionHead}`}>
        <span className={styles.eyebrow} data-reveal>
          Privacy
        </span>
        <h2 className={styles.h2} data-reveal style={delay(0.05)}>
          It reads one page. That is the whole of it.
        </h2>
        <p className={styles.lede} data-reveal style={delay(0.1)}>
          The extension runs on <code>info.aec.edu.in</code> and nowhere else, and it does not make
          requests — it watches the responses the portal&rsquo;s own scripts have already received
          once you are signed in.
        </p>
      </div>

      <div className={styles.inner}>
        <div className={styles.privacyGrid}>
          <div className={styles.privacyCol} data-reveal>
            <div className={styles.privacyHead}>
              <span className={`${styles.problemMark} ${styles.markYes}`} aria-hidden="true">
                ✓
              </span>
              What it reads
            </div>
            <ul className={styles.privacyList}>
              <li>Your name, roll number and the bio-data your profile page displays</li>
              <li>Per-subject classes held, classes attended, and the percentage</li>
              <li>Your weekly timetable grid</li>
            </ul>
          </div>

          <div className={styles.privacyCol} data-reveal style={delay(0.08)}>
            <div className={styles.privacyHead}>
              <span className={`${styles.problemMark} ${styles.markNo}`} aria-hidden="true">
                ×
              </span>
              What it never sees
            </div>
            <ul className={styles.privacyList}>
              <li>Your college username or password — there is nowhere to enter them</li>
              <li>Any other site, tab, or page you have open</li>
              <li>Your browsing history, cookies, or anything outside the portal</li>
              <li>Marks, fees, or anything else it was not written to parse</li>
            </ul>
          </div>
        </div>

        <div className={styles.note} data-reveal>
          <div className={styles.noteTitle}>
            <span aria-hidden="true">🔍</span> If you would rather check than take our word for it
          </div>
          <ul className={styles.noteList}>
            <li>
              The extension is loaded unpacked, so every file it runs is sitting in a folder on your
              own disk in plain JavaScript. Nothing is minified or bundled — you can read all of it.
            </li>
            <li>
              The whole project is open source, including the code that receives the sync on the
              server.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
