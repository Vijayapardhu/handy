import styles from "../landing.module.css";

/**
 * A phone showing one of the app's real screens, rebuilt in DOM.
 *
 * Screenshots would be a few hundred kilobytes each, go soft on a high-DPI
 * display, and need regenerating every time the app's design moves. These are
 * a couple of kilobytes of markup that stay crisp at any zoom and can be
 * edited in place — and because they use the colours the app actually uses,
 * they can't drift into showing a palette the product never had.
 *
 * The numbers are illustrative, not a real student's.
 */
export type ScreenId = "today" | "subjects" | "timetable" | "tasks" | "planner";

const LABELS: Record<ScreenId, string> = {
  today: "the Today screen with your classes and overall attendance",
  subjects: "the Subjects screen with per-subject attendance",
  timetable: "the weekly timetable",
  tasks: "the Deadlines screen",
  planner: "the attendance planner",
};

export function PhoneMockup({ screen = "today" }: { screen?: ScreenId }) {
  return (
    <div className={styles.phone} role="img" aria-label={`Handy showing ${LABELS[screen]}`}>
      <div className={styles.phoneScreen}>
        <svg className={styles.phoneBrandMark} viewBox="0 0 100 100" aria-hidden="true">
          <rect width="100" height="100" rx="22" />
          <path d="M33 26 V74 M67 26 V74 M33 50 H67" strokeWidth="11" strokeLinecap="round" fill="none" />
        </svg>
        <div className={styles.screenBody}>{body(screen)}</div>
        <BottomNav active={screen} />
      </div>
    </div>
  );
}

const NAV: { id: ScreenId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "subjects", label: "Subjects" },
  { id: "timetable", label: "Timetable" },
  { id: "tasks", label: "Tasks" },
];

function BottomNav({ active }: { active: ScreenId }) {
  // The planner opens from within Subjects, so it keeps that tab lit — the
  // same thing the real app does.
  const lit = active === "planner" ? "subjects" : active;
  return (
    <div className={styles.screenNav} aria-hidden="true">
      {NAV.map((item) => (
        <span
          key={item.id}
          className={`${styles.screenNavItem} ${item.id === lit ? styles.screenNavItemActive : ""}`}
        >
          <span className={styles.screenNavIcon} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function ScreenTitle({ over, title }: { over: string; title: string }) {
  return (
    <div>
      <div className={styles.screenDate}>{over}</div>
      <div className={styles.screenGreeting}>{title}</div>
    </div>
  );
}

function body(screen: ScreenId) {
  switch (screen) {
    case "subjects":
      return (
        <>
          <ScreenTitle over="Semester 5" title="Subjects" />
          {[
            ["Operating Systems", "91.30", "good"],
            ["DBMS", "84.00", "good"],
            ["Java Programming", "76.19", "ok"],
            ["Discrete Maths", "68.75", "bad"],
            ["Soft Skills", "72.40", "ok"],
          ].map(([name, pct, tone]) => (
            <div className={styles.screenRow} key={name}>
              <div className={styles.screenRowTop}>
                <span className={styles.screenRowName}>{name}</span>
                <span className={`${styles.screenRowPct} ${styles[`tone_${tone}`]}`}>{pct}%</span>
              </div>
              <div className={styles.screenBarSm}>
                <span
                  className={`${styles.screenBarFill} ${styles[`fill_${tone}`]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ))}
        </>
      );

    case "timetable":
      return (
        <>
          <ScreenTitle over="Week of 11 Aug" title="Timetable" />
          <div className={styles.screenDays}>
            {["M", "T", "W", "T", "F", "S"].map((d, i) => (
              <span key={i} className={`${styles.screenDay} ${i === 4 ? styles.screenDayActive : ""}`}>
                {d}
              </span>
            ))}
          </div>
          {[
            ["09:10", "Operating Systems", "C-204"],
            ["10:05", "Discrete Maths", "C-204"],
            ["11:00", "DBMS", "C-118"],
            ["01:40", "Java Lab", "Lab-3"],
            ["03:20", "Soft Skills", "B-011"],
          ].map(([time, name, room]) => (
            <div className={styles.screenClass} key={time}>
              <span className={styles.screenClassTime}>{time}</span>
              <span className={styles.screenClassName}>{name}</span>
              <span className={styles.screenClassRoom}>{room}</span>
            </div>
          ))}
        </>
      );

    case "tasks":
      return (
        <>
          <ScreenTitle over="4 open" title="Deadlines" />
          {[
            ["Today", "OS assignment 3", "bad"],
            ["Sun", "DBMS record book", "ok"],
            ["Tue", "Java lab manual", "ok"],
            ["Fri", "Maths tutorial 6", "good"],
          ].map(([when, what, tone]) => (
            <div className={styles.screenRow} key={what}>
              <div className={styles.screenRowTop}>
                <span className={styles.screenRowName}>{what}</span>
                <span className={`${styles.screenChip} ${styles[`chip_${tone}`]}`}>{when}</span>
              </div>
            </div>
          ))}
          <div className={styles.screenCard}>
            <div className={styles.screenSectionLabel}>Steps · OS assignment 3</div>
            <p className={styles.screenHint}>2 of 3 done · repeats weekly</p>
            <div className={styles.screenBar}>
              <span className={styles.screenBarFill} style={{ width: "66%" }} />
            </div>
          </div>
        </>
      );

    case "planner":
      return (
        <>
          <ScreenTitle over="Discrete Maths" title="Planner" />
          <div className={styles.screenCard}>
            <div className={styles.screenSectionLabel}>To reach 75%</div>
            <div className={styles.screenPctRow}>
              <span className={`${styles.screenPct} ${styles.tone_bad}`}>9</span>
              <span className={styles.screenPctLabel}>classes in a row</span>
            </div>
            <p className={styles.screenHint}>Currently 68.75% — 33 of 48 held.</p>
          </div>
          <div className={styles.screenCard}>
            <div className={styles.screenSectionLabel}>If you attend everything</div>
            <div className={styles.screenPctRow}>
              <span className={`${styles.screenPct} ${styles.tone_good}`}>81.2%</span>
              <span className={styles.screenPctLabel}>by 30 Nov</span>
            </div>
          </div>
          <div className={styles.screenCard}>
            <div className={styles.screenSectionLabel}>Safe absences</div>
            <div className={styles.screenPctRow}>
              <span className={styles.screenPct}>0</span>
              <span className={styles.screenPctLabel}>left this term</span>
            </div>
          </div>
        </>
      );

    case "today":
    default:
      return (
        <>
          <ScreenTitle over="Friday, 15 August" title="Good morning" />
          <div className={styles.screenCard}>
            <div className={styles.screenPctRow}>
              <span className={`${styles.screenPct} ${styles.tone_good}`}>82.14%</span>
              <span className={styles.screenPctLabel}>overall</span>
            </div>
            <div className={styles.screenBar}>
              <span className={styles.screenBarFill} style={{ width: "82%" }} />
            </div>
            <p className={styles.screenHint}>You can miss 6 more classes and still hold 75%.</p>
          </div>

          <div className={styles.screenSectionLabel}>Today</div>
          {[
            ["09:10", "Operating Systems", "C-204", true],
            ["11:00", "DBMS", "C-118", false],
            ["01:40", "Java Lab", "Lab-3", false],
          ].map(([time, name, room, now]) => (
            <div
              className={`${styles.screenClass} ${now ? styles.screenClassNow : ""}`}
              key={time as string}
            >
              <span className={styles.screenClassTime}>{time}</span>
              <span className={styles.screenClassName}>{name}</span>
              <span className={styles.screenClassRoom}>{room}</span>
            </div>
          ))}
        </>
      );
  }
}
