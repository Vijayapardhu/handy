import type { CSSProperties } from "react";
import styles from "../landing.module.css";
import { PhoneMockup, type ScreenId } from "./PhoneMockup";

/**
 * Five screens that start stacked behind one another and fan out as the
 * section scrolls.
 *
 * Each phone declares where it ends up — an x offset, a y offset, a rotation
 * and a final scale — and the stylesheet interpolates every one of those from
 * "exactly behind the middle phone" to that resting place using the section's
 * `--progress`. So the whole animation is four numbers per phone, and the
 * timing, easing and clamping live in CSS where the compositor can run them.
 *
 * Ordering is deliberate: the two nearest the middle sit on top of the two
 * outer ones, so the fan opens outward-and-downward like a hand of cards
 * rather than crossing over itself.
 */
type Placed = {
  screen: ScreenId;
  x: number;
  y: number;
  rotate: number;
  scale: number;
  z: number;
};

const CLUSTER: Placed[] = [
  { screen: "planner", x: -2, y: 0.62, rotate: -11, scale: 0.82, z: 1 },
  { screen: "timetable", x: -1, y: 0.2, rotate: -6, scale: 0.9, z: 2 },
  { screen: "subjects", x: 1, y: 0.2, rotate: 6, scale: 0.9, z: 2 },
  { screen: "tasks", x: 2, y: 0.62, rotate: 11, scale: 0.82, z: 1 },
  // The hero screen, always front and centre and never transformed.
  { screen: "today", x: 0, y: 0, rotate: 0, scale: 1, z: 3 },
];

export function PhoneCluster() {
  return (
    <div className={styles.cluster}>
      {CLUSTER.map((p) => (
        <div
          key={p.screen}
          className={p.x === 0 ? styles.clusterMain : styles.clusterSide}
          style={
            {
              "--x": p.x,
              "--y": p.y,
              "--rotate": `${p.rotate}deg`,
              "--scale": p.scale,
              zIndex: p.z,
            } as CSSProperties
          }
        >
          <PhoneMockup screen={p.screen} />
        </div>
      ))}
    </div>
  );
}
