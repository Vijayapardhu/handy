import { Link } from "react-router-dom";
import { Download04Icon, Idea01Icon, Alert02Icon } from "@hugeicons/core-free-icons";
import styles from "../landing.module.css";
import { Icon } from "../components/Icon";
import { SectionHead } from "../components/SectionHead";
import { delay } from "../reveal";
import { EXTENSION, LINKS } from "@/constants/download";
import { ROUTES } from "@/constants/routes";

/**
 * The fiddliest part of onboarding, written out in full.
 *
 * Every note in the troubleshooting box below is a failure that actually
 * happened during development and is documented in extension/README.md — the
 * background timetable tab, the badge states, the profile page living inside
 * an iframe. They are here because a student hitting one of them has no way to
 * know it is expected.
 */
export function SetupExtension() {
  return (
    <section className={styles.section} id="extension">
      <div className={`${styles.inner} ${styles.split}`}>
        <div className={styles.splitHead}>
          <SectionHead
            eyebrow="Install · Extension"
            title="Set up Handy College Sync"
            lede="This is the piece that reads your data out of Campus Connect and creates your account. It runs in Chrome or Edge on a laptop or desktop — once, on any machine you use."
          >
            <div className={styles.downloadCard} data-reveal style={delay(0.14)}>
              <div className={styles.downloadMeta}>
                <span className={styles.downloadMetaName}>College Sync v{EXTENSION.version}</span>
                Chrome · Edge · Brave
                <br />
                Loaded unpacked — not on the Web Store
              </div>
              <a className={styles.btnPrimary} href={EXTENSION.url}>
                <Icon icon={Download04Icon} size={17} />
                Download ZIP
              </a>
            </div>
          </SectionHead>
        </div>

        <div>
          <div className={styles.setupSteps}>
            <div className={styles.setupStep} data-reveal>
              <span className={styles.setupIndex} aria-hidden="true" />
              <div>
                <h3 className={styles.setupTitle}>Download and unzip</h3>
                <p className={styles.setupBody}>
                  Unzip it somewhere permanent — your Documents folder, not Downloads. Chrome loads
                  the extension from this folder every time it starts, so moving or deleting it later
                  disables the extension.
                </p>
              </div>
            </div>

            <div className={styles.setupStep} data-reveal>
              <span className={styles.setupIndex} aria-hidden="true" />
              <div>
                <h3 className={styles.setupTitle}>Open the extensions page</h3>
                <p className={styles.setupBody}>
                  Go to <span className={styles.kbd}>chrome://extensions</span> (or{" "}
                  <span className={styles.kbd}>edge://extensions</span>). It has to be typed into the
                  address bar — links to it do not work, by design.
                </p>
              </div>
            </div>

            <div className={styles.setupStep} data-reveal>
              <span className={styles.setupIndex} aria-hidden="true" />
              <div>
                <h3 className={styles.setupTitle}>Turn on Developer mode</h3>
                <p className={styles.setupBody}>
                  The toggle is in the top-right corner of that page. Nothing appears until it is on.
                </p>
              </div>
            </div>

            <div className={styles.setupStep} data-reveal>
              <span className={styles.setupIndex} aria-hidden="true" />
              <div>
                <h3 className={styles.setupTitle}>Load unpacked</h3>
                <p className={styles.setupBody}>
                  Click <span className={styles.kbd}>Load unpacked</span> and select the unzipped
                  folder — the one containing <span className={styles.kbd}>manifest.json</span>, not
                  its parent. Handy College Sync appears in the list. Pin it to the toolbar so you can
                  see its badge.
                </p>
              </div>
            </div>

            <div className={styles.setupStep} data-reveal>
              <span className={styles.setupIndex} aria-hidden="true" />
              <div>
                <h3 className={styles.setupTitle}>Log into Campus Connect as usual</h3>
                <p className={styles.setupBody}>
                  Open <a href={LINKS.portal}>info.aec.edu.in/aus</a> and sign in exactly as you
                  always do — the extension takes no part in this, and never sees what you type.
                </p>
              </div>
            </div>

            <div className={styles.setupStep} data-reveal>
              <span className={styles.setupIndex} aria-hidden="true" />
              <div>
                <h3 className={styles.setupTitle}>Open your Student Profile</h3>
                <p className={styles.setupBody}>
                  Navigate to the page that shows your attendance —{" "}
                  <span className={styles.kbd}>Menu → Profile</span>, the one with your subject-wise
                  percentages on it. That single page is all the extension needs. Give it a few
                  seconds: the badge turns into a green check when your data has synced.
                </p>
              </div>
            </div>

            <div className={styles.setupStep} data-reveal>
              <span className={styles.setupIndex} aria-hidden="true" />
              <div>
                <h3 className={styles.setupTitle}>Open Handy and sign in</h3>
                <p className={styles.setupBody}>
                  Your account now exists. Use your roll number on{" "}
                  <Link to={ROUTES.login}>the web app</Link> or in the Android app. Every future visit to
                  your profile page refreshes the data on its own — you never have to come back here.
                </p>
              </div>
            </div>
          </div>

          <div className={styles.note} data-reveal>
            <div className={styles.noteTitle}>
              <Icon icon={Idea01Icon} size={17} /> Things that look wrong but are not
            </div>
            <ul className={styles.noteList}>
              <li>
                <strong>A tab opens and closes by itself.</strong> The timetable is only fetched when
                something is selected on the timetable page, so the extension opens it in the
                background, picks one, and closes the tab as soon as the data lands. That is expected.
              </li>
              <li>
                <strong>The badge shows a red exclamation mark.</strong> A sync failed. Click the icon
                to see what it captured and why — it will not fail silently and leave you with stale
                numbers.
              </li>
              <li>
                <strong>The popup asks you to open Handy and sign in once.</strong> That appears only
                after you have changed your Handy password on another device. Signing in once in the
                web app hands the new credential back to the extension and syncing resumes on its own.
              </li>
              <li>
                <strong>Nothing captured after a couple of minutes.</strong> Make sure you are on the
                profile page with your attendance visible, then reload it. Reloading the extension
                from <span className={styles.kbd}>chrome://extensions</span> and revisiting the page
                fixes nearly everything else.
              </li>
            </ul>
          </div>

          <div className={`${styles.note} ${styles.noteWarn}`} data-reveal>
            <div className={styles.noteTitle}>
              <Icon icon={Alert02Icon} size={17} /> Worth knowing before you start
            </div>
            <ul className={styles.noteList}>
              <li>
                New accounts are created with a shared default password. Until you change it, someone
                who knows your roll number could sign in as you and read your attendance. Change it in{" "}
                <span className={styles.kbd}>Profile → Change Password</span> the first time you open
                Handy.
              </li>
              <li>
                There is no password reset. Handy accounts are not tied to a real email address, so no
                reset link can be sent. If you change your password, do not forget it.
              </li>
              <li>
                Handy is a student project, not a university system. It is not affiliated with or
                endorsed by Aditya University, and the university does not support it.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
