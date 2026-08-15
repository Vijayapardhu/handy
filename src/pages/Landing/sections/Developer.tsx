import { Globe02Icon, Mail01Icon, SourceCodeIcon } from "@hugeicons/core-free-icons";
import styles from "../landing.module.css";
import { Icon } from "../components/Icon";
import { BrandMark } from "../components/BrandMark";
import { SectionHead } from "../components/SectionHead";
import { LINKS } from "@/constants/download";

/**
 * Who made this, and why.
 *
 * Every fact here is mirrored from the Android app's About screen
 * (mobile/lib/screens/support_screens.dart) — the name, the origin, the
 * "between lectures" line, the links. That screen is the source of truth and
 * was written by the developer himself; nothing on this page is invented about
 * a real person. **If one changes, change the other.**
 *
 * It earns its place rather than being an ego section: the honest answer to
 * "who is behind this and can I trust it with my attendance" is a named
 * student at the same university, with a portfolio and a public repo, which is
 * more reassuring than an anonymous product voice would be.
 */

const PROFILE_LINKS = [
  {
    icon: Globe02Icon,
    label: "vijayaapardhu.dev",
    detail: "Portfolio",
    href: LINKS.portfolio,
  },
  {
    icon: SourceCodeIcon,
    label: "github.com/Vijayapardhu",
    detail: "Code, including this app",
    href: LINKS.github,
  },
  {
    icon: Mail01Icon,
    label: LINKS.contactEmail,
    detail: "Bugs, ideas, complaints",
    href: `mailto:${LINKS.contactEmail}`,
  },
];

export function Developer() {
  return (
    <section className={styles.section} id="developer">
      <div className={`${styles.inner} ${styles.split}`}>
        <div className={styles.splitHead}>
          <SectionHead
            eyebrow="Who built it"
            title="Made between lectures, for the same problem."
            lede={
              <>
                Handy is one student&rsquo;s project, not a company&rsquo;s product. It is written
                alongside the same coursework it is meant to help with.
              </>
            }
          />
        </div>

        <div>
          <div className={styles.devCard} data-reveal>
            <div className={styles.devIdentity}>
              <BrandMark size={52} className={styles.devMark} />
              <div>
                <div className={styles.devName}>Vijaya Pardhu Magapu</div>
                <div className={styles.devRole}>Student · Aditya University</div>
              </div>
            </div>

            <div className={styles.devStory}>
              <p>
                Every student here has the same routine: open the portal, sign in, find the
                attendance page, read a table, and do the arithmetic in your head. The answer
                matters — below 75% and you are in trouble — and the one place that knows it makes
                you work for it, every single time.
              </p>
              <p>
                Handy started as a way to stop doing that. Not a better portal, a straight answer.
                Everything else followed from it: once your attendance and timetable are in one
                place, what is next, what is free and what is due all come for free.
              </p>
            </div>

            <div className={styles.devLinks}>
              {PROFILE_LINKS.map((l) => (
                <a className={styles.devLink} href={l.href} key={l.href}>
                  <span className={styles.devLinkIcon}>
                    <Icon icon={l.icon} size={17} />
                  </span>
                  <span className={styles.devLinkText}>
                    <span className={styles.devLinkLabel}>{l.label}</span>
                    <span className={styles.devLinkDetail}>{l.detail}</span>
                  </span>
                </a>
              ))}
            </div>

            <p className={styles.devSignature}>Made in Surampalem, between lectures.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
