import { useState } from "react";
import { CheckCircle2, Compass, ExternalLink, Lock } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { DSA_TOPICS, DSA_TOPIC_LABELS, MASTERY_BAND_LABELS, topicResourceLinks } from "@/constants/dsaTopics";
import { PLATFORM_BRAND } from "@/constants/codingBrand";
import { nextFocusTopic, roadmapMastery } from "@/lib/calculations/mastery";
import { useSolutions, useTopicExplainer } from "@/hooks/useCoding";
import { todayIso } from "@/lib/date";
import { cn } from "@/lib/utils/cn";
import type { DsaTopic } from "@/constants/dsaTopics";
import styles from "./RoadmapTab.module.css";

/**
 * All 25 canonical DSA topics, in curated learning-path order, each showing
 * real mastery — never a summary card's top eight, the whole path.
 *
 * "Locked" is cosmetic, not a restriction: it marks a topic that is both
 * untouched and sits after the one topic nextFocusTopic() actually
 * recommends next, so the path reads as an order to consider rather than a
 * gate. A student who jumps ahead and solves a graph problem before finishing
 * arrays sees that solve counted immediately — locked only ever describes
 * "not reached yet", never "not allowed yet".
 *
 * Tapping a topic opens what it is (an explanation generated once per topic
 * and cached forever, see api/topic-explainer.js) and where to read up and
 * practise it — a real per-topic link for LeetCode and Codeforces (the only
 * two platforms whose tag data Handy actually trusts), a GeeksforGeeks search
 * link, and CodeChef/HackerRank's general practice pages. See
 * topicResourceLinks in constants/dsaTopics.ts for exactly why each of those
 * five is built the way it is.
 */
export function RoadmapTab() {
  const solutionsQuery = useSolutions();
  const [selected, setSelected] = useState<DsaTopic | null>(null);

  if (solutionsQuery.isLoading) {
    return (
      <div className={styles.loadingStack}>
        <Skeleton height={72} />
        <Skeleton height={72} />
        <Skeleton height={72} />
      </div>
    );
  }

  const solutions = solutionsQuery.data ?? [];
  const roadmap = roadmapMastery(solutions, todayIso());
  const focus = nextFocusTopic(roadmap);
  const focusIndex = focus ? DSA_TOPICS.indexOf(focus) : -1;

  return (
    <div className={styles.stack}>
      <p className={styles.intro}>
        The 25 topics competitive problems draw from, in the order most students find easiest to
        build on. A percent here comes only from solves you tagged when logging them. Tap a topic
        to read what it is and where to practise it.
      </p>

      <ol className={styles.path}>
        {roadmap.map((entry, index) => {
          const isFocus = entry.topic === focus;
          const isLocked = entry.solved === 0 && focusIndex >= 0 && index > focusIndex;
          const isMastered = entry.band === "mastered" || entry.band === "advanced";
          const isOpen = selected === entry.topic;

          return (
            <li key={entry.topic} className={styles.step}>
              <div className={styles.rail}>
                <span
                  className={cn(
                    styles.marker,
                    styles[entry.band],
                    isFocus && styles.markerFocus,
                    isLocked && styles.markerLocked,
                  )}
                >
                  {isLocked ? (
                    <Lock size={12} />
                  ) : isMastered ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    index + 1
                  )}
                </span>
                {index < roadmap.length - 1 && <span className={styles.line} />}
              </div>

              <Card
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                className={cn(
                  styles.card,
                  isFocus && styles.cardFocus,
                  isLocked && styles.cardLocked,
                )}
                onClick={() => setSelected((current) => (current === entry.topic ? null : entry.topic))}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setSelected((current) => (current === entry.topic ? null : entry.topic));
                }}
              >
                <div className={styles.head}>
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

                <p className={styles.meta}>
                  {isLocked
                    ? "Not reached yet"
                    : `${entry.solved} solved · ${entry.byDifficulty.easy}E ${entry.byDifficulty.medium}M ${entry.byDifficulty.hard}H`}
                </p>

                {isFocus && (
                  <p className={styles.focusNote}>
                    <Compass size={13} /> Focus next
                  </p>
                )}

                {isOpen && <TopicDetail topic={entry.topic} />}
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const LINK_PLATFORMS = ["leetcode", "codeforces", "geeksforgeeks", "codechef", "hackerrank"] as const;
const LINK_LABELS: Record<(typeof LINK_PLATFORMS)[number], string> = {
  leetcode: "LeetCode",
  codeforces: "Codeforces",
  geeksforgeeks: "GeeksforGeeks",
  codechef: "CodeChef",
  hackerrank: "HackerRank",
};

function TopicDetail({ topic }: { topic: DsaTopic }) {
  const explainer = useTopicExplainer(topic);
  const links = topicResourceLinks(topic);

  return (
    <div className={styles.detail} onClick={(event) => event.stopPropagation()}>
      {explainer.isLoading && (
        <div className={styles.explanationLoading}>
          <Skeleton height={14} />
          <Skeleton height={14} />
        </div>
      )}
      {explainer.isError && (
        <p className={styles.explanationError}>
          {explainer.error instanceof Error ? explainer.error.message : "Could not load an explanation."}
        </p>
      )}
      {explainer.data && <p className={styles.explanation}>{explainer.data.text}</p>}

      <div className={styles.linkRow}>
        {LINK_PLATFORMS.map((id) => {
          const href = links[id];
          if (!href) return null;
          const brand = id === "leetcode" || id === "codeforces" ? PLATFORM_BRAND[id] : null;
          return (
            <a
              key={id}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className={styles.link}
              style={brand ? { borderColor: brand.color, color: brand.color } : undefined}
            >
              {LINK_LABELS[id]} <ExternalLink size={11} />
            </a>
          );
        })}
      </div>
    </div>
  );
}
