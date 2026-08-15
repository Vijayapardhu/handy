import styles from "../landing.module.css";
import { Faq } from "../components/Faq";
import { SectionHead } from "../components/SectionHead";

export function FaqSection() {
  return (
    <section className={styles.section} id="faq">
      <div className={`${styles.inner} ${styles.split}`}>
        <div className={styles.splitHead}>
          <SectionHead
            eyebrow="Questions"
            title="The ones everybody asks"
            lede="If something here is still unclear, the source is public and the developer answers email."
          />
        </div>

        <div data-reveal>
          <Faq />
        </div>
      </div>
    </section>
  );
}
