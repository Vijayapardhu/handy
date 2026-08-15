import styles from "../landing.module.css";

/**
 * Just the wordmark.
 *
 * The link columns and the fine print that used to live here are gone on
 * purpose — but nothing they carried was lost, which is the only reason this
 * is safe to do:
 *
 * - navigation → the sticky top nav covers every section;
 * - portfolio, GitHub and contact → the Developer section;
 * - the web-app link → the hero and the closing call to action;
 * - the "not affiliated with Aditya University" disclaimer → stated in the
 *   FAQ's first answer and again in the extension section's warning box.
 *
 * That last one matters. If those two statements are ever removed, this
 * footer has to get the disclaimer back.
 */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerWordmark}>Handy</div>
    </footer>
  );
}
