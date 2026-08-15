import { useEffect, useState, type MutableRefObject } from "react";
import type Lenis from "lenis";
import styles from "../landing.module.css";
import { scrollToHash } from "../hooks/useLenis";
import { ANDROID } from "@/constants/download";

const LINKS = [
  { hash: "#features", label: "Features" },
  { hash: "#how", label: "How it works" },
  { hash: "#android", label: "Install" },
  { hash: "#extension", label: "Extension" },
  { hash: "#faq", label: "FAQ" },
];

export function LandingNav({ lenis }: { lenis: MutableRefObject<Lenis | null> }) {
  const [stuck, setStuck] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // Plain scroll listener rather than Lenis' own event: this has to work on
    // touch and under reduced motion, where there is no Lenis instance.
    const onScroll = () => setStuck(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function go(hash: string) {
    setMenuOpen(false);
    scrollToHash(lenis.current, hash);
    // Keep the address bar shareable without letting the browser's own jump
    // fight the smooth scroll that just started.
    window.history.replaceState(null, "", hash);
  }

  function toTop() {
    setMenuOpen(false);
    if (lenis.current) lenis.current.scrollTo(0, { duration: 1.2 });
    else window.scrollTo({ top: 0, behavior: "smooth" });
    window.history.replaceState(null, "", window.location.pathname);
  }

  return (
    <header className={`${styles.nav} ${stuck ? styles.navStuck : ""}`}>
      <nav className={styles.navInner} aria-label="Main">
        <a
          className={styles.brand}
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            toTop();
          }}
        >
          <span className={styles.brandMark} aria-hidden="true">
            H
          </span>
          Handy
        </a>

        <div className={styles.navLinks}>
          {LINKS.map((l) => (
            <button key={l.hash} type="button" className={styles.navLink} onClick={() => go(l.hash)}>
              {l.label}
            </button>
          ))}
        </div>

        <a className={`${styles.btnPrimary} ${styles.btnSmall}`} href={ANDROID.url}>
          Download APK
        </a>

        <button
          type="button"
          className={styles.navToggle}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {menuOpen ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
          </svg>
        </button>

        {menuOpen && (
          <div className={styles.navSheet}>
            {LINKS.map((l) => (
              <button key={l.hash} type="button" className={styles.navLink} onClick={() => go(l.hash)}>
                {l.label}
              </button>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
}
