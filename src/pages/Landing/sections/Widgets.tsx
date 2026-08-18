import { useState, type CSSProperties, type MutableRefObject } from "react";
import type Lenis from "lenis";
import styles from "../landing.module.css";
import { WIDGETS, WIDGET_THEMES, type WidgetTheme } from "../data";
import { WidgetPreview } from "../components/WidgetPreview";
import { Icon } from "../components/Icon";
import { SectionHead } from "../components/SectionHead";
import { useScrollProgress } from "../hooks/useScrollProgress";
import { useCarouselSnap } from "../hooks/useCarouselSnap";

/**
 * A one-at-a-time carousel, held while you scroll through it.
 *
 * The section is tall and the stage inside it is sticky, so it stays put while
 * the page scrolls past; that distance is spent sliding the current widget out
 * to the left and bringing the next in from the right. Only one is ever on
 * screen, at a size worth actually reading.
 *
 * All of the movement is CSS driven by one `--progress` custom property (see
 * .widgetSlide) — each slide works out its own position from its index, so
 * adding a sixth widget means adding it to WIDGETS and nothing else.
 *
 * The rail this replaced showed all six at once at a size where you could not
 * read any of them, and on a wide screen it had nothing to pan.
 */
export function Widgets({ lenis }: { lenis: MutableRefObject<Lenis | null> }) {
  const sectionRef = useScrollProgress<HTMLElement>("pin");
  // Rests on a whole widget rather than wherever the wheel stopped — landing
  // mid-transition leaves two half-faded widgets and neither readable.
  useCarouselSnap(sectionRef, lenis, WIDGETS.length);
  // Widened to the union: WIDGET_THEMES is `as const`, so inferring from
  // element 0 alone would type the state as "accent only".
  const [theme, setTheme] = useState<WidgetTheme>(WIDGET_THEMES[0]);

  return (
    <section className={styles.widgets} id="widgets" ref={sectionRef}>
      <div className={styles.widgetsStage}>
        <SectionHead
          centered
          eyebrow="Home screen"
          title="Six widgets. Eight palettes. No unlocking."
          lede={
            <>
              Most days the only question is &ldquo;where am I meant to be, and am I still
              fine?&rdquo; That answer belongs on the home screen, not three taps into an app.
            </>
          }
        />

        <div className={styles.widgetDeck}>
          {WIDGETS.map((w, i) => (
            <div className={styles.widgetSlide} key={w.id} style={{ "--i": i } as CSSProperties}>
              <WidgetPreview id={w.id} theme={theme} />
              <div className={styles.widgetCaption}>
                <div className={styles.widgetCaptionName}>
                  <Icon icon={w.icon} size={19} />
                  {w.name}
                </div>
                <p className={styles.widgetCaptionBlurb}>{w.blurb}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.widgetsFoot}>
          <div className={styles.widgetDots} role="presentation">
            {WIDGETS.map((w, i) => (
              <span className={styles.widgetDot} key={w.id} style={{ "--i": i } as CSSProperties} />
            ))}
          </div>

          <div className={styles.swatches} role="group" aria-label="Widget palette">
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
      </div>
    </section>
  );
}
