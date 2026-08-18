import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import styles from "./CardSwiper.module.css";

interface CardSwiperProps {
  children: ReactNode[];
  /** Announced to screen readers as each slide's name — e.g. ["Overall Attendance", "Hub Attendance"]. */
  labels: string[];
}

/**
 * A stack of cards swiped between horizontally, one card wide, snapping to
 * whichever side a drag crossed 20% of the track toward. Built for exactly
 * the Home page's Overall/Hub attendance pair, but takes any number of
 * children.
 *
 * `touch-action: pan-y` on the track (see the CSS module) is what keeps the
 * page's own vertical scroll working on a touch device — without it, capturing
 * the pointer for horizontal drag would swallow every touch gesture on the
 * card, including a plain scroll.
 */
export function CardSwiper({ children, labels }: CardSwiperProps) {
  const count = children.length;
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);
  /**
   * A card face can hold a <Link> (the connected Hub card links to its
   * breakdown page). A drag that ends over that link would otherwise fire a
   * native click right after pointerup and navigate unintentionally — this is
   * what suppresses exactly that one click, and only that one.
   */
  const didDragRef = useRef(false);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (count <= 1) return;
    startX.current = event.clientX;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const next = event.clientX - startX.current;
    if (Math.abs(next) > 8) didDragRef.current = true;
    setDragX(next);
  }

  function settle() {
    const width = trackRef.current?.offsetWidth ?? 1;
    const threshold = width * 0.2;
    setIndex((current) => {
      if (dragX <= -threshold && current < count - 1) return current + 1;
      if (dragX >= threshold && current > 0) return current - 1;
      return current;
    });
    setDragging(false);
    setDragX(0);
  }

  function onTrackClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!didDragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    didDragRef.current = false;
  }

  const trackWidth = trackRef.current?.offsetWidth ?? 1;
  const offsetPercent = -index * 100 + (dragX / trackWidth) * 100;

  return (
    <div className={styles.viewport}>
      <div
        ref={trackRef}
        className={styles.track}
        style={{
          transform: `translateX(${offsetPercent}%)`,
          transition: dragging ? "none" : "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={settle}
        onPointerCancel={settle}
        onClickCapture={onTrackClickCapture}
      >
        {children.map((child, i) => (
          <div
            className={styles.slide}
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={labels[i] ?? `Card ${i + 1}`}
            aria-hidden={i !== index}
          >
            {child}
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className={styles.dots} role="tablist" aria-label="Attendance cards">
          {children.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={labels[i] ?? `Card ${i + 1}`}
              className={cn(styles.dot, i === index && styles.dotActive)}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
