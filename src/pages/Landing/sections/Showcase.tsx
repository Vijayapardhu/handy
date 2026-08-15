import styles from "../landing.module.css";
import { PhoneCluster } from "../components/PhoneCluster";
import { useScrollProgress } from "../hooks/useScrollProgress";

/**
 * The product itself, pinned while the screens fan out.
 *
 * A tall section holding a `position: sticky` stage: the cluster is held in
 * the middle of the viewport for the section's height while `--progress` runs
 * 0 → 1, which is what opens the fan. Scroll distance still maps one-to-one to
 * the page — nothing is intercepted or slowed — so the scrollbar stays honest
 * and a reader who wants past it just keeps going.
 *
 * The stage is centred and sized to the phone, so nothing is ever cropped: the
 * whole device is on screen for the entire pin.
 */
export function Showcase() {
  const ref = useScrollProgress<HTMLDivElement>("pin");

  return (
    <section className={styles.showcase} ref={ref} aria-label="The Handy app">
      <div className={styles.showcaseStage}>
        <PhoneCluster />
        <p className={styles.showcaseCaption} data-reveal>
          Today, subjects, timetable, deadlines and the planner — the whole app, built from your own
          Campus Connect data.
        </p>
      </div>
    </section>
  );
}
