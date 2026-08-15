import styles from "../landing.module.css";
import { BrandMark } from "../components/BrandMark";
import { ANDROID, EXTENSION, LINKS } from "@/constants/download";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div>
          <span className={styles.brand}>
            <BrandMark size={30} className={styles.brandMark} />
            Handy
          </span>
          <p className={styles.downloadMeta}>
            Attendance, timetable and deadlines
            <br />
            for Aditya University students.
          </p>
        </div>

        <nav className={styles.footerLinks} aria-label="Sections">
          <span className={styles.footerLinksTitle}>The page</span>
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#android">Install on Android</a>
          <a href="#extension">Extension setup</a>
          <a href="#privacy">Privacy</a>
          <a href="#faq">FAQ</a>
        </nav>

        <nav className={styles.footerLinks} aria-label="Project">
          <span className={styles.footerLinksTitle}>Project</span>
          <a href={LINKS.webApp}>Web app</a>
          <a href={LINKS.repo}>Source</a>
          <a href={LINKS.releases}>Releases</a>
          <a href={LINKS.issues}>Report a problem</a>
          <a href={`mailto:${LINKS.contactEmail}`}>Contact</a>
        </nav>
      </div>

      <p className={styles.footerFine}>
        Handy is an independent student project. It is not affiliated with, endorsed by, or supported
        by Aditya University; &ldquo;Campus Connect&rdquo; is named only to identify the portal it
        reads. Everything Handy shows comes from that portal and is only ever as current as your last
        sync — for anything official, check with your department. App v{ANDROID.version} · extension
        v{EXTENSION.version}.
      </p>
    </footer>
  );
}
