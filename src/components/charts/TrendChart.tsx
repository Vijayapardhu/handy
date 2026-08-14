import { useId } from "react";
import styles from "./TrendChart.module.css";

export interface TrendPoint {
  label: string;
  /** 0-100, or null when there's no data for that point (rendered as a gap). */
  value: number | null;
}

interface TrendChartProps {
  points: TrendPoint[];
  /** Optional horizontal reference line, e.g. the college's minimum attendance %. */
  target?: number;
  height?: number;
}

const VIEW_WIDTH = 300;
const PADDING_X = 8;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 20;

/**
 * Dependency-free SVG line + area chart. Values are plotted on a fixed 0-100
 * y-axis (attendance is always a percentage), so no y-axis scaling math is
 * needed beyond padding. Null values leave a gap in the line rather than
 * being drawn as 0%, which would misrepresent "no classes that week" as
 * "missed every class that week".
 */
export function TrendChart({ points, target, height = 140 }: TrendChartProps) {
  const gradientId = useId();
  const plotHeight = height - PADDING_TOP - PADDING_BOTTOM;
  const plotWidth = VIEW_WIDTH - PADDING_X * 2;

  const xFor = (i: number) => PADDING_X + (points.length <= 1 ? plotWidth / 2 : (i / (points.length - 1)) * plotWidth);
  const yFor = (value: number) => PADDING_TOP + plotHeight - (Math.min(100, Math.max(0, value)) / 100) * plotHeight;

  const plotted = points.map((p, i) => ({ ...p, x: xFor(i), y: p.value === null ? null : yFor(p.value) }));
  const known = plotted.filter((p): p is typeof p & { y: number } => p.y !== null);

  const linePath = known.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath =
    known.length > 0
      ? `${linePath} L ${known[known.length - 1].x} ${PADDING_TOP + plotHeight} L ${known[0].x} ${PADDING_TOP + plotHeight} Z`
      : "";
  const targetY = target !== undefined ? yFor(target) : null;

  if (known.length === 0) {
    return <p className={styles.empty}>Not enough recent data to chart a trend yet.</p>;
  }

  return (
    <div className={styles.wrapper}>
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label="Attendance trend chart">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {targetY !== null && (
          <line
            x1={PADDING_X}
            x2={VIEW_WIDTH - PADDING_X}
            y1={targetY}
            y2={targetY}
            className={styles.targetLine}
          />
        )}

        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />}
        {linePath && <path d={linePath} fill="none" className={styles.line} />}

        {known.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} className={styles.dot} />
        ))}
      </svg>
      <div className={styles.labels}>
        {points.map((p, i) => (
          <span key={i} className={styles.label}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
