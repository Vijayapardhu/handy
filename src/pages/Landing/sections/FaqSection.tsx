import styles from "../landing.module.css";
import { Faq } from "../components/Faq";
import { delay } from "../reveal";

export function FaqSection() {
  return (
    <section className={`${styles.section} ${styles.sectionRuled}`} id="faq">
      <div className={`${styles.inner} ${styles.split}`}>
        <div className={styles.splitHead}>
          <span className={styles.eyebrow} data-reveal>
            Questions
          </span>
          <h2 className={styles.h2} data-reveal style={delay(0.05)}>
            The ones everybody asks
          </h2>
        </div>

        <div data-reveal>
          <Faq />
        </div>
      </div>
    </section>
  );
}
