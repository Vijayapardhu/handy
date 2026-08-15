import { useState } from "react";
import styles from "../landing.module.css";
import { FAQS } from "../data";

/**
 * Accordion, built on buttons and aria-expanded rather than <details>, because
 * the open/close needs to animate and `details` can't be transitioned reliably
 * across browsers yet. The height animation is CSS-only (grid-template-rows
 * 0fr → 1fr), so nothing measures the panel in JavaScript.
 *
 * Multiple panels can be open at once — closing someone's answer to show them
 * another one is a small hostility on a page whose whole job is answering
 * questions.
 */
export function Faq() {
  const [open, setOpen] = useState<Set<number>>(new Set([0]));

  function toggle(i: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(i)) next.add(i);
      return next;
    });
  }

  return (
    <div className={styles.faqList}>
      {FAQS.map((item, i) => {
        const isOpen = open.has(i);
        return (
          <div className={styles.faqItem} key={item.q}>
            <h3>
              <button
                type="button"
                className={styles.faqQ}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${i}`}
                id={`faq-q-${i}`}
                onClick={() => toggle(i)}
              >
                {item.q}
                <svg
                  className={`${styles.faqSign} ${isOpen ? styles.faqSignOpen : ""}`}
                  viewBox="0 0 14 14"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M7 1v12M1 7h12" />
                </svg>
              </button>
            </h3>
            <div
              className={`${styles.faqAWrap} ${isOpen ? styles.faqAWrapOpen : ""}`}
              id={`faq-panel-${i}`}
              role="region"
              aria-labelledby={`faq-q-${i}`}
            >
              <div className={styles.faqA}>
                <p className={styles.faqAInner}>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
