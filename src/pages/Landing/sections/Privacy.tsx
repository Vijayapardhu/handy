import { Cancel01Icon, CheckmarkCircle02Icon, Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import styles from "../landing.module.css";
import { Icon } from "../components/Icon";
import { SectionHead } from "../components/SectionHead";
import { delay } from "../reveal";

const READS = [
  "Your name, roll number and the bio-data your profile page displays",
  "Per-subject classes held, classes attended, and the percentage",
  "Your weekly timetable grid",
];

const NEVER = [
  "Your college username or password — there is nowhere to enter them",
  "Any other site, tab, or page you have open",
  "Your browsing history, cookies, or anything outside the portal",
  "Marks, fees, or anything else it was not written to parse",
];

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
      <div className={`${styles.inner} ${styles.split}`}>
        <div className={styles.splitHead}>
          <SectionHead
            eyebrow="Privacy"
            title="It reads one page. That is the whole of it."
            lede={
              <>
                The extension runs on <code>info.aec.edu.in</code> and nowhere else, and it does not
                make requests — it watches the responses the portal&rsquo;s own scripts have already
                received once you are signed in.
              </>
            }
          />
        </div>

        <div>
          <div className={styles.privacyGrid}>
            <div className={styles.privacyCol} data-reveal>
              <div className={styles.privacyHead}>
                <span className={styles.markYes}>
                  <Icon icon={Tick02Icon} size={13} />
                </span>
                What it reads
              </div>
              <ul className={styles.privacyList}>
                {READS.map((line) => (
                  <li key={line}>
                    <Icon icon={CheckmarkCircle02Icon} size={16} />
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.privacyCol} data-reveal style={delay(0.08)}>
              <div className={styles.privacyHead}>
                <span className={styles.markNo}>
                  <Icon icon={Cancel01Icon} size={13} />
                </span>
                What it never sees
              </div>
              <ul className={styles.privacyList}>
                {NEVER.map((line) => (
                  <li key={line}>
                    <Icon icon={Cancel01Icon} size={16} />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={styles.note} data-reveal>
            <div className={styles.noteTitle}>
              <Icon icon={Search01Icon} size={17} /> If you would rather check than take our word for
              it
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
      </div>
    </section>
  );
}
