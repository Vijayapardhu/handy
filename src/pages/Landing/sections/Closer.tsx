import styles from "../landing.module.css";
import { delay } from "../reveal";
import { ANDROID, EXTENSION, LINKS } from "@/constants/download";

/** Last call, for the reader who scrolled the whole way and is now convinced. */
export function Closer() {
  return (
    <section className={`${styles.section} ${styles.closer}`}>
      <div className={`${styles.inner} ${styles.narrow}`}>
        <h2 className={styles.h2} data-reveal>
          Stop doing the arithmetic in your head.
        </h2>
        <p className={styles.lede} data-reveal style={delay(0.06)}>
          Two downloads and one visit to a page you already visit. Then Handy keeps itself current for
          the rest of the semester.
        </p>
        <div className={styles.ctaRow} data-reveal style={delay(0.12)}>
          <a className={styles.btnPrimary} href={ANDROID.url}>
            Download for Android
          </a>
          <a className={styles.btnGhost} href={EXTENSION.url}>
            Get the extension
          </a>
        </div>
        <p className={styles.heroMeta} data-reveal style={delay(0.18)}>
          <span>
            Prefer the browser? <a href={LINKS.webApp}>Open the web app</a>
          </span>
        </p>
      </div>
    </section>
  );
}
