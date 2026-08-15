import type { MutableRefObject } from "react";
import type Lenis from "lenis";
import { ArrowDown01Icon, Download04Icon } from "@hugeicons/core-free-icons";
import styles from "../landing.module.css";
import { PhoneMockup } from "../components/PhoneMockup";
import { BrandMark } from "../components/BrandMark";
import { Icon } from "../components/Icon";
import { useScrollProgress } from "../hooks/useScrollProgress";
import { scrollToHash } from "../hooks/useLenis";
import { delay } from "../reveal";
import { ANDROID, LINKS } from "@/constants/download";

/**
 * A single centred column, vertically centred in the first screen.
 *
 * The earlier two-column split put the headline hard against the left gutter
 * with the phone floating opposite it — which reads as a layout with two
 * subjects rather than one. Centring gives the page one focal axis: badge,
 * headline, promise, action, then the product itself directly beneath, cropped
 * by the fold so there is an obvious reason to keep scrolling.
 */
export function Hero({ lenis }: { lenis: MutableRefObject<Lenis | null> }) {
  // `enter` rather than `cover`: the phone should finish its move by the time
  // the hero's top reaches the top of the screen, not keep turning for the
  // whole section.
  const phoneRef = useScrollProgress<HTMLDivElement>("enter");

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
            On iPhone? <a href={LINKS.webApp}>Use the web app</a>
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
