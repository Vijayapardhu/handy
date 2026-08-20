import type { CSSProperties } from "react";
import { AlertTriangle, ExternalLink } from "@/components/ui/icons";
import { PLATFORM_BRAND } from "@/constants/codingBrand";
import { PLATFORM_META, type PlatformStats } from "@/types/coding";
import { cn } from "@/lib/utils/cn";
import styles from "./PlatformStatCard.module.css";

/**
 * One platform's numbers, in that platform's own color.
 *
 * Only the fields that came back are rendered. The five sites publish
 * genuinely different things — CodeChef has a rating and no difficulty split,
 * GeeksforGeeks has a streak and no rating, HackerRank has stars and no rank
 * — and a grid of "—" placeholders would say a site is broken when it is
 * simply a different site.
 *
 * The monogram plate and the top edge carry the platform's own brand color
 * (constants/codingBrand.ts), not Handy's accent — five tiles that all wore
 * the app's own orange would be five numbers in the same wrapper, and the
 * whole point of a grid is telling them apart before reading a word.
 *
 * A platform that failed keeps its card and states the failure, because
 * "CodeChef couldn't be read just now" is information; a card that quietly
 * vanishes reads as a solved count of zero.
 */
export function PlatformStatCard({ stats }: { stats: PlatformStats }) {
  const meta = PLATFORM_META[stats.platform];
  const brand = PLATFORM_BRAND[stats.platform];
  const brandVar = { "--brand": brand.color } as CSSProperties;

  if (stats.error) {
    return (
      <div className={cn(styles.card, styles.errorCard)} style={brandVar}>
        <div className={styles.head}>
          <span className={styles.monogram} data-error="true">
            {brand.monogram}
          </span>
          <span className={styles.name}>{meta.label}</span>
          <AlertTriangle size={14} className={styles.errorIcon} />
        </div>
        <p className={styles.errorText}>
          {stats.error === "not_found"
            ? `No profile at that username.`
            : `Couldn't read this profile just now.`}
        </p>
        <a className={styles.link} href={stats.profileUrl} target="_blank" rel="noreferrer noopener">
          {stats.handle} <ExternalLink size={11} />
        </a>
      </div>
    );
  }

  return (
    <div className={styles.card} style={brandVar}>
      <div className={styles.head}>
        <span className={styles.monogram}>{brand.monogram}</span>
        <span className={styles.name}>{meta.label}</span>
      </div>

      <p className={styles.solved}>
        {stats.solved ?? "—"}
        <span className={styles.solvedLabel}>solved</span>
      </p>

      {stats.rank && <span className={styles.rank}>{stats.rank}</span>}

      {stats.byDifficulty && (
        <div className={styles.split}>
          <span className={styles.easy}>{stats.byDifficulty.easy} easy</span>
          <span className={styles.medium}>{stats.byDifficulty.medium} med</span>
          <span className={styles.hard}>{stats.byDifficulty.hard} hard</span>
        </div>
      )}

      <div className={styles.meta}>
        {stats.rating !== null && (
          <span>
            {stats.rating} rating
            {stats.maxRating !== null && stats.maxRating > stats.rating && ` · best ${stats.maxRating}`}
          </span>
        )}
        {stats.contestsAttended ? <span>{stats.contestsAttended} contests</span> : null}
        {stats.globalRank !== null && <span>rank #{stats.globalRank.toLocaleString()}</span>}
      </div>

      <a className={styles.link} href={stats.profileUrl} target="_blank" rel="noreferrer noopener">
        {stats.handle} <ExternalLink size={11} />
      </a>
    </div>
  );
}
