import type { ReactNode } from "react";
import styles from "../landing.module.css";
import { delay } from "../reveal";

/**
 * The heading block every section on the page uses.
 *
 * This exists because consistency kept drifting: the page had grown three
 * different head treatments (a sticky split column, a left-aligned block above
 * a grid, and a centred one), each with its own spacing and its own reveal
 * stagger copy-pasted slightly differently — and one section with no heading
 * at all. Sharing the markup makes them identical by construction rather than
 * by everyone remembering.
 *
 * Two alignments, chosen by what the section holds, not by taste:
 *
 * - default — a sticky column beside prose or steps.
 * - `centered` — above content that is itself centred on one axis (a diagram,
 *   a carousel, a grid).
 *
 * `children` lands under the lede, for the few heads that carry something
 * extra like a download card.
 */
export function SectionHead({
  eyebrow,
  title,
  lede,
  centered = false,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  centered?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={centered ? styles.headCentered : undefined}>
      <span className={styles.eyebrow} data-reveal>
        <span className={styles.eyebrowTick} aria-hidden="true" />
        {eyebrow}
      </span>
      <h2 className={styles.h2} data-reveal style={delay(0.05)}>
        {title}
      </h2>
      {lede && (
        <p className={styles.lede} data-reveal style={delay(0.1)}>
          {lede}
        </p>
      )}
      {children}
    </div>
  );
}
