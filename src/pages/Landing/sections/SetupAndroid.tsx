import styles from "../landing.module.css";
import { delay } from "../reveal";
import { ANDROID, LINKS } from "@/constants/download";

/**
 * The APK walkthrough. It is not on the Play Store, so this has to talk about
 * "install from unknown sources" plainly rather than hoping people work it out
 * — that dialog is where a sideload usually dies.
 */
export function SetupAndroid() {
  return (
    <section className={styles.section} id="android">
      <div className={styles.inner}>
        <div className={styles.setupHead}>
          <div className={styles.narrow}>
            <span className={styles.eyebrow} data-reveal>
              Install · Android
            </span>
            <h2 className={styles.h2} data-reveal style={delay(0.05)}>
              Get the app
            </h2>
            <p className={styles.lede} data-reveal style={delay(0.1)}>
              Handy is not on the Play Store, so this is a direct download. Android will ask you to
              confirm that once — step 2 is what that dialog is.
            </p>
          </div>

          <div className={styles.downloadCard} data-reveal style={delay(0.14)}>
            <div className={styles.downloadMeta}>
              <span className={styles.downloadMetaName}>Handy v{ANDROID.version}</span>
              {ANDROID.size} · {ANDROID.minAndroid} and up
              <br />
              Released {ANDROID.releasedOn}
            </div>
            <a className={styles.btnPrimary} href={ANDROID.url}>
              Download APK
            </a>
          </div>
        </div>

        <div className={styles.setupSteps}>
          <div className={styles.setupStep} data-reveal>
            <span className={styles.setupIndex} aria-hidden="true" />
            <div>
              <h3 className={styles.setupTitle}>Download the APK</h3>
              <p className={styles.setupBody}>
                Tap the button above on your phone. Chrome will warn you that this file type can harm
                your device — that warning appears for every APK, signed or not. Choose{" "}
                <span className={styles.kbd}>Download anyway</span>.
              </p>
            </div>
          </div>

          <div className={styles.setupStep} data-reveal>
            <span className={styles.setupIndex} aria-hidden="true" />
            <div>
              <h3 className={styles.setupTitle}>Allow installs from your browser</h3>
              <p className={styles.setupBody}>
                Open the downloaded file. If Android says installs from this source are blocked, tap{" "}
                <span className={styles.kbd}>Settings</span> in that dialog and turn on{" "}
                <span className={styles.kbd}>Allow from this source</span>. This is a per-app
                permission for the browser you downloaded with, not a system-wide setting — you can
                turn it back off afterwards.
              </p>
            </div>
          </div>

          <div className={styles.setupStep} data-reveal>
            <span className={styles.setupIndex} aria-hidden="true" />
            <div>
              <h3 className={styles.setupTitle}>Install and open</h3>
              <p className={styles.setupBody}>
                Tap <span className={styles.kbd}>Install</span>, then <span className={styles.kbd}>Open</span>.
                Play Protect may offer to scan the app first; letting it is fine.
              </p>
            </div>
          </div>

          <div className={styles.setupStep} data-reveal>
            <span className={styles.setupIndex} aria-hidden="true" />
            <div>
              <h3 className={styles.setupTitle}>Sign in with your roll number</h3>
              <p className={styles.setupBody}>
                Enter your roll number — that is the whole sign-in. There is no password to invent
                and no form to fill, because your account was already created by the extension. If
                the app says it cannot find your account, the extension has not captured your profile
                yet; do that first.
              </p>
            </div>
          </div>

          <div className={styles.setupStep} data-reveal>
            <span className={styles.setupIndex} aria-hidden="true" />
            <div>
              <h3 className={styles.setupTitle}>Add a widget</h3>
              <p className={styles.setupBody}>
                Long-press an empty spot on your home screen, choose{" "}
                <span className={styles.kbd}>Widgets</span>, scroll to Handy, and drag one out. Pick a
                palette and typeface in the app under Settings; the widget follows.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.note} data-reveal>
          <div className={styles.noteTitle}>
            <span aria-hidden="true">📱</span> On iPhone
          </div>
          <ul className={styles.noteList}>
            <li>
              There is no iOS build. Open <a href={LINKS.webApp}>{LINKS.webApp.replace("https://", "")}</a> in
              Safari, then Share → Add to Home Screen — it installs as an app and gives you every
              screen the Android build has.
            </li>
            <li>Home-screen widgets are the one thing you will not get; those are Android-only.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
