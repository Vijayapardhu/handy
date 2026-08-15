import type { CSSProperties } from "react";
import styles from "../landing.module.css";
import type { WidgetTheme } from "../data";

/**
 * One home-screen widget, rendered in the palette currently selected on the
 * swatch row. The gradient, the two text colours and the corner radius are the
 * same values the Android drawables use (see data.ts), so switching a swatch
 * here shows what the launcher actually draws rather than an approximation.
 */
export function WidgetPreview({ id, theme }: { id: string; theme: WidgetTheme }) {
  const style = {
    "--w-from": theme.from,
    "--w-to": theme.to,
    "--w-primary": theme.primary,
    "--w-secondary": theme.secondary,
  } as CSSProperties;

  return (
    <div className={styles.widgetPreview} style={style}>
      {content(id)}
    </div>
  );
}

function content(id: string) {
  switch (id) {
    case "next":
      return (
        <>
          <div className={styles.widgetHead}>Next class</div>
          <div className={styles.widgetBig}>11:00</div>
          <div className={styles.widgetSub}>DBMS · C-118, Block C</div>
          <div className={styles.widgetSub}>starts in 42 min</div>
        </>
      );

    case "attendance":
      return (
        <>
          <div className={styles.widgetHead}>Attendance</div>
          <div className={styles.widgetBig}>82.14%</div>
          <div className={styles.widgetSub}>184 of 224 classes attended</div>
        </>
      );

    case "today":
      return (
        <>
          <div className={styles.widgetHead}>Today · 4 classes</div>
          {[
            ["09:10", "Operating Systems"],
            ["11:00", "DBMS"],
            ["01:40", "Java Lab"],
            ["03:20", "Soft Skills"],
          ].map(([time, name]) => (
            <div className={styles.widgetRow} key={time}>
              <span className={styles.widgetRowTime}>{time}</span>
              <span className={styles.widgetRowText}>{name}</span>
            </div>
          ))}
        </>
      );

    case "dues":
      return (
        <>
          <div className={styles.widgetHead}>Due soon</div>
          {[
            ["Today", "OS assignment 3"],
            ["Sun", "DBMS record"],
            ["Tue", "Java lab manual"],
          ].map(([when, what]) => (
            <div className={styles.widgetRow} key={what}>
              <span className={styles.widgetRowTime}>{when}</span>
              <span className={styles.widgetRowText}>{what}</span>
            </div>
          ))}
        </>
      );

    case "overview":
    default:
      return (
        <>
          <div className={styles.widgetHead}>Overview</div>
          <div className={styles.widgetBig}>82.14%</div>
          <div className={styles.widgetRow}>
            <span className={styles.widgetRowTime}>Next</span>
            <span className={styles.widgetRowText}>DBMS · 11:00</span>
          </div>
          <div className={styles.widgetRow}>
            <span className={styles.widgetRowTime}>Due</span>
            <span className={styles.widgetRowText}>OS assignment 3</span>
          </div>
        </>
      );
  }
}
