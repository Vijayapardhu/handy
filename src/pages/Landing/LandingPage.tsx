import { useEffect, useRef } from "react";
import styles from "./landing.module.css";
import { useLenis, scrollToHash } from "./hooks/useLenis";
import { useReveal } from "./hooks/useReveal";
import { LandingNav } from "./sections/LandingNav";
import { Hero } from "./sections/Hero";
import { Showcase } from "./sections/Showcase";
import { Problem } from "./sections/Problem";
import { HowItWorks } from "./sections/HowItWorks";
import { Features } from "./sections/Features";
import { Widgets } from "./sections/Widgets";
import { SetupAndroid } from "./sections/SetupAndroid";
import { SetupExtension } from "./sections/SetupExtension";
import { Privacy } from "./sections/Privacy";
import { Developer } from "./sections/Developer";
import { FaqSection } from "./sections/FaqSection";
import { Closer } from "./sections/Closer";
import { Footer } from "./sections/Footer";

/**
 * The public front door, shown at `/` to anyone who isn't signed in.
 *
 * It lives inside the same SPA rather than as a separate site so it can share
 * the design tokens and stay on the primary URL, but it is a genuinely
 * different kind of page: its own dark palette (`data-landing`), its own
 * scrolling behaviour, and no app chrome. Everything it needs is in this
 * folder, and it is lazy-loaded, so a signed-in student never downloads a byte
 * of it.
 */
export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const lenis = useLenis();
  useReveal(rootRef);

  useEffect(() => {
    // The app's global.css pins html/body to height: 100% for the phone-shell
    // layout. A marketing page is a document that scrolls, so those caps are
    // lifted for as long as this page is mounted and restored on the way out.
    const { documentElement: html, body } = document;
    const previous = { html: html.style.height, body: body.style.height, bg: body.style.background };
    html.style.height = "auto";
    body.style.height = "auto";
    body.style.background = "#07090f";

    return () => {
      html.style.height = previous.html;
      body.style.height = previous.body;
      body.style.background = previous.bg;
    };
  }, []);

  useEffect(() => {
    // A shared /#extension link must land on the right section. The browser's
    // own jump happens before this page has mounted (it is lazy-loaded and the
    // markup doesn't exist yet), so the scroll is redone once it does.
    const hash = window.location.hash;
    if (!hash || hash === "#top") return;
    const id = window.setTimeout(() => scrollToHash(lenis.current, hash, { immediate: true }), 120);
    return () => window.clearTimeout(id);
  }, [lenis]);

  return (
    <div className={styles.page} data-landing ref={rootRef}>
      <LandingNav lenis={lenis} />
      <main>
        <Hero lenis={lenis} />
        <Showcase />
        <Problem />
        <HowItWorks lenis={lenis} />
        <Features />
        <Widgets lenis={lenis} />
        <SetupAndroid />
        <SetupExtension />
        <Privacy />
        <Developer />
        <FaqSection />
        <Closer />
      </main>
      <Footer />
    </div>
  );
}
