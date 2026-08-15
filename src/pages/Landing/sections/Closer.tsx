import { Link } from "react-router-dom";
import { Download04Icon, PuzzleIcon } from "@hugeicons/core-free-icons";
import styles from "../landing.module.css";
import { Icon } from "../components/Icon";
import { SectionHead } from "../components/SectionHead";
import { delay } from "../reveal";
import { ANDROID, EXTENSION } from "@/constants/download";
import { ROUTES } from "@/constants/routes";

/** Last call, for the reader who scrolled the whole way and is now convinced. */
export function Closer() {
  return (
    <section className={`${styles.section} ${styles.closer}`}>
      <div className={`${styles.inner} ${styles.closerInner}`}>
        <SectionHead
          centered
          eyebrow="Get started"
          title="Stop doing the arithmetic in your head."
          lede="Two downloads and one visit to a page you already visit. Then Handy keeps itself current for the rest of the semester."
        />
        <div className={styles.ctaRow} data-reveal style={delay(0.12)}>
          <a className={styles.btnPrimary} href={ANDROID.url}>
            <Icon icon={Download04Icon} size={17} />
            Download for Android
          </a>
          <a className={styles.btnGhost} href={EXTENSION.url}>
            <Icon icon={PuzzleIcon} size={17} />
            Get the extension
          </a>
        </div>
        <p className={styles.metaRow} data-reveal style={delay(0.18)}>
          <span>
            Prefer the browser? <Link to={ROUTES.login}>Open the web app</Link>
          </span>
        </p>
      </div>
    </section>
  );
}
