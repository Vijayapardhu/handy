import type { MutableRefObject } from "react";
import type Lenis from "lenis";
import { Link } from "react-router-dom";
import { ArrowDown01Icon, Download04Icon } from "@hugeicons/core-free-icons";
import styles from "../landing.module.css";
import { BrandMark } from "../components/BrandMark";
import { Icon } from "../components/Icon";
import { scrollToHash } from "../hooks/useLenis";
import { delay } from "../reveal";
import { ANDROID } from "@/constants/download";
import { ROUTES } from "@/constants/routes";

/**
 * A single centred column, vertically centred in the first screen.
 *
 * No device here. An earlier pass sat a phone under the copy and let the fold
 * crop it, which landed the cut in a different place on every screen size and
 * often clipped the device before its fade had even started. The phones now
 * get a section of their own (Showcase) where they are never cropped at all;
 * this screen is one focal axis — badge, headline, promise, action — and a cue
 * to keep going.
 */
export function Hero({ lenis }: { lenis: MutableRefObject<Lenis | null> }) {
  return (
    <section className={styles.hero} id="top">
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroGridLines} aria-hidden="true" />

      <div className={styles.heroInner}>
        <span className={styles.badge} data-reveal>
          <BrandMark size={22} />
          Built for Aditya University
        </span>

        <h1 className={styles.h1} data-reveal style={delay(0.06)}>
          Your attendance, <em>with the answer attached</em>.
        </h1>

        <p className={styles.heroSub} data-reveal style={delay(0.12)}>
          Campus Connect tells you the percentage. Handy tells you what it means — how many classes
          you can still miss, what happens if you take Friday off, and which subject is about to
          become a problem.
        </p>

        <div className={styles.ctaRow} data-reveal style={delay(0.18)}>
          <a className={styles.btnPrimary} href={ANDROID.url}>
            <Icon icon={Download04Icon} size={17} />
            Download for Android
          </a>
          <button type="button" className={styles.btnGhost} onClick={() => scrollToHash(lenis.current, "#how")}>
            How it works
            <Icon icon={ArrowDown01Icon} size={17} />
          </button>
        </div>

        <p className={styles.metaRow} data-reveal style={delay(0.24)}>
          <span>
            v{ANDROID.version} · {ANDROID.size} · {ANDROID.minAndroid} and up
          </span>
          <span aria-hidden="true">·</span>
          <span>
            On iPhone? <Link to={ROUTES.login}>Use the web app</Link>
          </span>
        </p>
      </div>

      <span className={styles.scrollCue} data-reveal style={delay(0.34)} aria-hidden="true">
        Scroll
        <Icon icon={ArrowDown01Icon} size={16} />
      </span>
    </section>
  );
}
