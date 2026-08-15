import styles from "../landing.module.css";
import { FEATURES } from "../data";
import { delay } from "../reveal";

export function Features() {
  return (
    <section className={styles.section} id="features">
      <div className={`${styles.inner} ${styles.narrow} ${styles.sectionHead}`}>
        <span className={styles.eyebrow} data-reveal>
          What you get
        </span>
        <h2 className={styles.h2} data-reveal style={delay(0.05)}>
          Everything the portal knows, plus what it never worked out for you.
        </h2>
      </div>

      <div className={styles.inner}>
        <div className={styles.featureGrid}>
          {FEATURES.map((f, i) => (
            <article
              key={f.title}
              className={styles.feature}
              data-reveal
              // Stagger by column, not by index — a nine-item list staggered
              // one-by-one takes most of a second to finish arriving.
              style={delay((i % 3) * 0.07)}
            >
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureBody}>{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
