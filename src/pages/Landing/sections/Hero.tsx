import type { MutableRefObject } from "react";
import type Lenis from "lenis";
import styles from "../landing.module.css";
import { PhoneMockup } from "../components/PhoneMockup";
import { useScrollProgress } from "../hooks/useScrollProgress";
import { scrollToHash } from "../hooks/useLenis";
import { delay } from "../reveal";
import { ANDROID, LINKS } from "@/constants/download";

export function Hero({ lenis }: { lenis: MutableRefObject<Lenis | null> }) {
  // `enter` rather than `cover`: the phone should finish its move by the time
  // the hero's top reaches the top of the screen, not keep turning for the
  // whole section.
  const phoneRef = useScrollProgress<HTMLDivElement>("enter");

  return (
    <section className={styles.hero} id="top">
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroGrid} aria-hidden="true" />

      <div className={styles.heroInner}>
        <div>
          <span className={styles.badge} data-reveal>
            <span className={styles.badgeDot} aria-hidden="true">
              A
            </span>
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
              <svg
                viewBox="0 0 16 16"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M8 1.5v9M4.5 7.5L8 11l3.5-3.5M2 13.5h12" />
              </svg>
              Download for Android
            </a>
            <button type="button" className={styles.btnGhost} onClick={() => scrollToHash(lenis.current, "#how")}>
              How it works
            </button>
          </div>

          <p className={styles.heroMeta} data-reveal style={delay(0.24)}>
            <span>
              v{ANDROID.version} · {ANDROID.size} · {ANDROID.minAndroid} and up
            </span>
            <span aria-hidden="true">·</span>
            <span>
              On iPhone? <a href={LINKS.webApp}>Use the web app</a>
            </span>
          </p>
        </div>

        <div className={styles.heroPhoneWrap} data-reveal style={delay(0.1)}>
          <div className={styles.heroPhone} ref={phoneRef}>
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
