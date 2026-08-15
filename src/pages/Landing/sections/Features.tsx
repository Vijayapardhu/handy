import styles from "../landing.module.css";
import { Icon } from "../components/Icon";
import { SectionHead } from "../components/SectionHead";
import { FEATURES } from "../data";
import { delay } from "../reveal";

/**
 * A bento rather than a nine-up grid of identical cards.
 *
 * The planner is the reason the app exists, so it leads at double width with
 * the three figures it actually produces. Every card the same size says every
 * feature matters equally, which is both untrue and hard to scan.
 */
export function Features() {
  return (
    <section className={`${styles.section} ${styles.sectionRuled}`} id="features">
      <div className={styles.inner}>
        <div className={styles.sectionHead}>
          <SectionHead
            centered
            eyebrow="What you get"
            title="Everything the portal knows, plus what it never worked out for you."
          />
        </div>

        <div className={styles.featureGrid}>
          {FEATURES.map((f, i) => (
            <article
              key={f.title}
              className={`${styles.feature} ${"featured" in f && f.featured ? styles.featureLead : ""}`}
              data-reveal
              // Stagger by column, not by index — a nine-item list staggered
              // one-by-one takes most of a second to finish arriving.
              style={delay((i % 3) * 0.07)}
            >
              <span className={styles.featureIcon}>
                <Icon icon={f.icon} size={21} />
              </span>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureBody}>{f.body}</p>

              {"stats" in f && (
                <div className={styles.featureStats}>
                  {f.stats.map((s) => (
                    <div className={styles.featureStat} key={s.label}>
                      <span className={styles.featureStatValue}>{s.value}</span>
                      <span className={styles.featureStatLabel}>{s.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
