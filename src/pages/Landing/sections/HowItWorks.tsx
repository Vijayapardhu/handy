import type { MutableRefObject } from "react";
import type Lenis from "lenis";
import styles from "../landing.module.css";
import { useScrollProgress } from "../hooks/useScrollProgress";
import { scrollToHash } from "../hooks/useLenis";
import { delay } from "../reveal";
import { LINKS } from "@/constants/download";

/**
 * Three steps, on a rail that fills as the section scrolls.
 *
 * The order matters and is not negotiable: there is no signup screen anywhere
 * in Handy, so the extension has to run before there is an account to sign in
 * to. Presenting "download the app" first would strand people at a login
 * screen for an account that does not exist yet.
 */
export function HowItWorks({ lenis }: { lenis: MutableRefObject<Lenis | null> }) {
  const railRef = useScrollProgress<HTMLDivElement>("cover");

  return (
    <section className={styles.section} id="how">
      <div className={`${styles.inner} ${styles.narrow} ${styles.sectionHead}`}>
        <span className={styles.eyebrow} data-reveal>
          How it works
        </span>
        <h2 className={styles.h2} data-reveal style={delay(0.05)}>
          Three steps, once. Then it keeps itself current.
        </h2>
        <p className={styles.lede} data-reveal style={delay(0.1)}>
          Handy has no signup form, because it never asks you for anything it can read from a page
          you are already signed in to.
        </p>
      </div>

      <div className={styles.inner}>
        <div className={styles.steps}>
          <div className={styles.stepsRail} aria-hidden="true" ref={railRef}>
            <span className={styles.stepsRailFill} />
          </div>

          <div className={styles.step} data-reveal>
            <span className={styles.stepNum}>1</span>
            <h3 className={styles.stepTitle}>Add the browser extension</h3>
            <p className={styles.stepBody}>
              Handy College Sync loads into Chrome or Edge in about a minute. It is the only piece
              that touches the college portal, and it only ever reads.{" "}
              <button type="button" className={styles.navLink} onClick={() => scrollToHash(lenis.current, "#extension")}>
                Full instructions ↓
              </button>
            </p>
          </div>

          <div className={styles.step} data-reveal style={delay(0.06)}>
            <span className={styles.stepNum}>2</span>
            <h3 className={styles.stepTitle}>Open your Campus Connect profile once</h3>
            <p className={styles.stepBody}>
              Sign in at <a href={LINKS.portal}>info.aec.edu.in</a> the way you always do — same page,
              same Cloudflare check, in your own tab — and open your Student Profile. The extension
              reads the attendance response the page has already fetched, then quietly collects your
              timetable in a background tab that closes itself.
            </p>
            <p className={styles.stepNote}>
              <span aria-hidden="true">🔒</span>
              Your college password is never typed into Handy, never sent anywhere, and never stored.
              The extension makes no request of its own — it only reads replies to requests the portal
              made itself.
            </p>
          </div>

          <div className={styles.step} data-reveal style={delay(0.12)}>
            <span className={styles.stepNum}>3</span>
            <h3 className={styles.stepTitle}>Open Handy</h3>
            <p className={styles.stepBody}>
              Your account already exists — the extension created it from your roll number and filled
              it with your real data. Sign in with the roll number on your phone or in the browser,
              drop a widget on your home screen, and you are done. Every later visit to your profile
              page tops the data up automatically.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
