import { Globe, Code2 } from "@/components/ui/icons";
import { TopHeader } from "@/components/layout/TopHeader";
import { Card } from "@/components/ui/Card";
import { LINKS } from "@/constants/download";
import { APP_VERSION } from "@/services/feedback/feedbackService";
import styles from "./AboutPage.module.css";

const WEBSITE_LABEL = LINKS.webApp.replace(/^https?:\/\//, "");
const PORTFOLIO_LABEL = LINKS.portfolio.replace(/^https?:\/\//, "");
const GITHUB_LABEL = LINKS.github.replace(/^https?:\/\//, "");

export function AboutPage() {
  return (
    <div className="page-narrow">
      <TopHeader title="About Handy" subtitle={`Version ${APP_VERSION}`} back />

      <div className={styles.identity}>
        <div className={styles.mark}>H</div>
        <div>
          <p className={styles.name}>Handy</p>
          <p className={styles.version}>Version {APP_VERSION}</p>
        </div>
      </div>

      <p className={styles.heading}>How it started</p>
      <p className={styles.body}>
        Every student at Aditya University has the same routine: open the portal, sign in, find the attendance page,
        read a table, and do the arithmetic in your head. How many can I miss? How many do I need? The answer
        matters — below 75% and you are in trouble — and the one place that knows it makes you work for it every
        single time.
      </p>
      <p className={styles.body}>
        Handy started as a way to stop doing that. Not a better portal — a straight answer. Open the app and the
        number is there, already translated into what it actually means: you can miss three more, or you need to
        attend the next thirteen in a row.
      </p>
      <p className={styles.body}>
        It grew from there, because once your attendance and timetable are in one place the rest follows: what
        class is next and where, which periods are free, what is due this week, a reminder before it is. All of it
        built around the same idea — the app should have done the thinking before you opened it.
      </p>

      <p className={styles.heading}>What Handy will not do</p>
      <p className={styles.body}>
        It will not invent a number. Every attendance figure comes from the college record exactly as the college
        holds it, and cannot be edited in the app — an app that let you tidy up your own attendance would only be
        lying to you more comfortably.
      </p>
      <p className={styles.body}>
        It will not show your attendance to other students, rank you against them, sell anything to advertisers, or
        charge you. There is no paid tier and there are no adverts.
      </p>

      <p className={styles.heading}>Who built it</p>
      <p className={styles.body}>
        Handy is built and maintained by Vijaya Pardhu Magapu — a student at Aditya University, writing it alongside
        the same coursework it is meant to help with. It is an independent project: not affiliated with, endorsed
        by, or operated by the university, which remains the authority on your attendance.
      </p>

      <Card padded={false} className={styles.linkGroup}>
        <a className={styles.linkRow} href={LINKS.webApp} target="_blank" rel="noopener noreferrer">
          <Globe size={18} className={styles.linkIcon} />
          <span className={styles.linkBody}>
            <span className={styles.linkTitle}>{WEBSITE_LABEL}</span>
            <span className={styles.linkSubtitle}>Handy on the web</span>
          </span>
        </a>
        <a className={styles.linkRow} href={LINKS.portfolio} target="_blank" rel="noopener noreferrer">
          <Globe size={18} className={styles.linkIcon} />
          <span className={styles.linkBody}>
            <span className={styles.linkTitle}>{PORTFOLIO_LABEL}</span>
            <span className={styles.linkSubtitle}>Portfolio</span>
          </span>
        </a>
        <a className={styles.linkRow} href={LINKS.github} target="_blank" rel="noopener noreferrer">
          <Code2 size={18} className={styles.linkIcon} />
          <span className={styles.linkBody}>
            <span className={styles.linkTitle}>{GITHUB_LABEL}</span>
            <span className={styles.linkSubtitle}>GitHub</span>
          </span>
        </a>
      </Card>

      <p className={styles.footer}>Made in Surampalem, between lectures.</p>
    </div>
  );
}
