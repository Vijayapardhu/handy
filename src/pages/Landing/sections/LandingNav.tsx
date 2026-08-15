import { useEffect, useState, type MutableRefObject } from "react";
import type Lenis from "lenis";
import { Cancel01Icon, Download04Icon, Menu01Icon } from "@hugeicons/core-free-icons";
import styles from "../landing.module.css";
import { BrandMark } from "../components/BrandMark";
import { Icon } from "../components/Icon";
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
          <BrandMark size={30} className={styles.brandMark} />
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
          <Icon icon={Download04Icon} size={16} />
          Download APK
        </a>

        <button
          type="button"
          className={styles.navToggle}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Icon icon={menuOpen ? Cancel01Icon : Menu01Icon} size={19} />
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
