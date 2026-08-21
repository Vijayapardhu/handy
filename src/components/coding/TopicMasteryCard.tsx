import { Compass, Target } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { DSA_TOPIC_LABELS, MASTERY_BAND_LABELS } from "@/constants/dsaTopics";
import { nextFocusTopic, type TopicMastery } from "@/lib/calculations/mastery";
import { cn } from "@/lib/utils/cn";
import styles from "./TopicMasteryCard.module.css";

/** Enough to be useful without turning into a second scrollable list. */
const VISIBLE_TOPICS = 8;

/**
 * Which DSA topics a student has actually practised, and how deep.
 *
 * Built entirely from the solve log's own `topics` tags — see
 * lib/calculations/mastery.ts for exactly what the score does and does not
 * claim to measure. Nothing here is an AI opinion; every number is a plain
 * function of what was logged, which is also why an untagged solve (most
 * platforms don't publish topics, so most solves start untagged) simply
 * doesn't appear here rather than being guessed into some topic.
 */
export function TopicMasteryCard({ mastery }: { mastery: TopicMastery[] }) {
  const visible = mastery.slice(0, VISIBLE_TOPICS);
  const next = nextFocusTopic(mastery);

  return (
    <Card className={styles.card}>
      <p className={styles.heading}>
        <Target size={15} /> Topic mastery
      </p>

      <div className={styles.list}>
        {visible.map((entry) => (
          <div key={entry.topic} className={styles.row}>
            <div className={styles.rowHead}>
              <span className={styles.topicName}>{DSA_TOPIC_LABELS[entry.topic]}</span>
              <span className={cn(styles.band, styles[entry.band])}>
                {MASTERY_BAND_LABELS[entry.band]}
              </span>
            </div>
            <div className={styles.barTrack}>
              <div
                className={cn(styles.barFill, styles[entry.band])}
                style={{ width: `${entry.percent}%` }}
              />
            </div>
            <p className={styles.rowMeta}>
              {entry.solved} solved · {entry.byDifficulty.easy}E {entry.byDifficulty.medium}M{" "}
              {entry.byDifficulty.hard}H
            </p>
          </div>
        ))}
      </div>

      {next && (
        <div className={styles.next}>
          <Compass size={14} />
          <span>
            Focus next: <strong>{DSA_TOPIC_LABELS[next]}</strong>
          </span>
        </div>
      )}

      <p className={styles.footnote}>
        Only counts solves tagged with a topic — most platforms don't publish one, so tag a solve
        when you log it to have it count here.
      </p>
    </Card>
  );
}
