import styles from "../landing.module.css";
import { Faq } from "../components/Faq";
import { delay } from "../reveal";

export function FaqSection() {
  return (
    <section className={styles.section} id="faq">
      <div className={`${styles.inner} ${styles.narrow}`}>
        <span className={styles.eyebrow} data-reveal>
          Questions
        </span>
        <h2 className={`${styles.h2} ${styles.sectionHead}`} data-reveal style={delay(0.05)}>
          The ones everybody asks
        </h2>
        <div data-reveal style={delay(0.1)}>
          <Faq />
        </div>
      </div>
    </section>
  );
}
