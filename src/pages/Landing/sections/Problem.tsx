import styles from "../landing.module.css";
import { SectionHead } from "../components/SectionHead";
import { useScrollProgress } from "../hooks/useScrollProgress";

/**
 * The reason the product exists, drawn as a derivation rather than argued.
 *
 * One number at the top, the four answers that fall out of it underneath. The
 * point it makes visually is that the portal and Handy are not looking at
 * different data — they are looking at the *same* number, and the portal just
 * stops at the top of the diagram.
 *
 * Kept deliberately sparse. An earlier pass gave every answer a question, a
 * figure, a unit and a clarifying line, which is four things to read times
 * four cards before you reach the next section — on a page whose argument is
 * that people should not have to do work to get an answer. Each card is now
 * two short lines: what you would ask, and the answer.
 *
 * Every figure is real arithmetic on 58 of 79 classes attended, not
 * decoration. If the numbers change they have to stay consistent with each
 * other, because a student will check them.
 */

const LEAVES = [
  // (58 + 5) / (79 + 5) = 75.00% exactly
  { question: "Can I still reach 75%?", value: "5", unit: "in a row" },
  // Already below the threshold, so there is no budget left to spend.
  { question: "Anything to spare?", value: "None", unit: "" },
  // (58 + 26) / (79 + 26) = 80.0% exactly, with 26 classes left in the term
  { question: "Where do I finish?", value: "80.0%", unit: "" },
  // 58 / (79 + 3) = 70.73% — a drop of 2.69 points
  { question: "Cost of skipping Friday?", value: "−2.7", unit: "points" },
];

export function Problem() {
  const treeRef = useScrollProgress<HTMLDivElement>("enter");

  return (
    <section className={styles.section}>
      <div className={`${styles.inner} ${styles.sectionHead}`}>
        <SectionHead
          centered
          eyebrow="The gap"
          title={<>A percentage is a fact. It isn&rsquo;t a decision.</>}
          lede="Campus Connect gives you the number. Handy gives you what to do about it."
        />
      </div>

      {/*
        `data-reveal` goes on the whole diagram, not on its parts. The wire —
        trunk, pill, bar, stubs — is laid out by the flow, so revealing the
        cards individually slid them 18px away from connectors that stayed put,
        and the diagram spent the entire animation visibly coming apart. It now
        arrives as one object, and the only thing that animates internally is
        the wire drawing itself in via --draw.
      */}
      <div className={styles.inner} data-reveal>
        <div className={styles.tree} ref={treeRef}>
          <div className={styles.treeSource}>
            <span className={styles.treeSourceTag}>Campus Connect</span>
            <span className={styles.treeSourceValue}>73.42%</span>
            <span className={styles.treeSourceMeta}>Discrete Maths · 58 of 79</span>
          </div>

          {/* Connectors are CSS rather than SVG: they share the leaves' grid,
              so they stay aligned as it reflows from four columns to two to
              one, with no viewBox maths. */}
          <div className={styles.treeTrunk} aria-hidden="true" />
          <span className={styles.treeHandoffPill}>Handy works out</span>
          <div className={styles.treeTrunk} aria-hidden="true" />

          <div className={styles.treeBranch} aria-hidden="true">
            <span className={styles.treeBar} />
            {LEAVES.map((l) => (
              <span className={styles.treeStub} key={l.question} />
            ))}
          </div>

          <div className={styles.treeLeaves}>
            {LEAVES.map((l) => (
              <div className={styles.leaf} key={l.question}>
                <span className={styles.leafQuestion}>{l.question}</span>
                <span className={styles.leafValue}>
                  {l.value}
                  {l.unit && <span className={styles.leafUnit}>{l.unit}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
