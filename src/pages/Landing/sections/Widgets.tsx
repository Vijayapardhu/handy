import { useState } from "react";
import styles from "../landing.module.css";
import { WIDGETS, WIDGET_THEMES, type WidgetTheme } from "../data";
import { WidgetPreview } from "../components/WidgetPreview";
import { useScrollProgress } from "../hooks/useScrollProgress";
import { delay } from "../reveal";

/**
 * The widget rail — the one section that spends the scroll budget on
 * something other than reading. The track pans sideways as the section passes
 * the viewport, so the five widgets are revealed by the same gesture that
 * moves the page.
 *
 * On touch that inverts into a plain swipeable rail (see the media query in
 * landing.module.css): panning a rail the reader can also drag means two
 * inputs fighting over one position.
 */
export function Widgets() {
  const trackRef = useScrollProgress<HTMLDivElement>("cover");
  // Widened to the union: WIDGET_THEMES is `as const`, so inferring from
  // element 0 alone would type the state as "accent only".
  const [theme, setTheme] = useState<WidgetTheme>(WIDGET_THEMES[0]);

  return (
    <section className={styles.section} id="widgets">
      <div className={`${styles.inner} ${styles.narrow} ${styles.sectionHead}`}>
        <span className={styles.eyebrow} data-reveal>
          Home screen
        </span>
        <h2 className={styles.h2} data-reveal style={delay(0.05)}>
          Five widgets. Eight palettes. No unlocking.
        </h2>
        <p className={styles.lede} data-reveal style={delay(0.1)}>
          Most days the only question is &ldquo;where am I meant to be, and am I still fine?&rdquo;.
          That answer belongs on the home screen, not three taps into an app. Each widget resizes to
          the space you give it and picks up the palette and typeface you chose.
        </p>
      </div>

      <div className={styles.inner}>
        <div className={styles.widgetViewport} data-reveal>
          <div className={styles.widgetTrack} ref={trackRef}>
            {WIDGETS.map((w) => (
              <div className={styles.widgetItem} key={w.id}>
                <WidgetPreview id={w.id} theme={theme} />
                <div className={styles.widgetCaption}>
                  <div className={styles.widgetCaptionName}>{w.name}</div>
                  <p className={styles.widgetCaptionBlurb}>{w.blurb}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.inner}>
        <div className={styles.swatches} data-reveal role="group" aria-label="Widget palette">
          {WIDGET_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.swatch} ${t.id === theme.id ? styles.swatchActive : ""}`}
              style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
              aria-label={`${t.label} palette`}
              aria-pressed={t.id === theme.id}
              onClick={() => setTheme(t)}
            />
          ))}
          <span className={styles.swatchLabel}>{theme.label}</span>
        </div>
      </div>
    </section>
  );
}
