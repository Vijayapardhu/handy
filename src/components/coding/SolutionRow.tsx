import { useState } from "react";
import { ChevronDown, Cpu, ExternalLink, Timer, Trash2 } from "@/components/ui/icons";
import { DSA_TOPIC_LABELS, type DsaTopic } from "@/constants/dsaTopics";
import { formatShortDate } from "@/lib/date";
import { PLATFORM_META, type CodingSolutionDoc } from "@/types/coding";
import { cn } from "@/lib/utils/cn";
import styles from "./SolutionRow.module.css";

/**
 * One logged solve.
 *
 * The two complexity badges are the loudest thing on the row on purpose —
 * they are the only part of a solve log a student re-reads. A problem with no
 * verdict shows an explicit "no complexity yet" rather than nothing, since a
 * blank would look identical to O(1).
 *
 * Expanding shows the reasoning and the code. The reasoning is kept next to
 * the verdict rather than hidden behind a second screen, because an estimate
 * nobody can check is an estimate nobody should trust.
 */
export function SolutionRow({
  solution,
  onDelete,
}: {
  solution: CodingSolutionDoc;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const complexity = solution.complexity;

  return (
    <div className={styles.row}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div className={styles.body}>
          <p className={styles.title}>{solution.title}</p>
          <p className={styles.meta}>
            {PLATFORM_META[solution.platform].label}
            {solution.difficulty && ` · ${solution.difficulty}`}
            {` · ${solution.language}`}
            {` · ${formatShortDate(solution.solvedAt)}`}
          </p>
          {solution.topics && solution.topics.length > 0 && (
            <div className={styles.topics}>
              {solution.topics.map((topic) => (
                <span key={topic} className={styles.topicTag}>
                  {DSA_TOPIC_LABELS[topic as DsaTopic] ?? topic}
                </span>
              ))}
            </div>
          )}
          {complexity ? (
            <div className={styles.badges}>
              <span className={styles.badge}>
                <Timer size={11} /> {complexity.time}
              </span>
              <span className={styles.badge}>
                <Cpu size={11} /> {complexity.space}
              </span>
              {complexity.source === "ai" && (
                <span className={styles.estimate} title={`Confidence: ${complexity.confidence}`}>
                  estimate
                </span>
              )}
            </div>
          ) : (
            <p className={styles.noComplexity}>No complexity recorded</p>
          )}
        </div>
        <ChevronDown size={16} className={cn(styles.chevron, open && styles.chevronOpen)} />
      </button>

      {open && (
        <div className={styles.details}>
          {complexity?.explanation && <p className={styles.explanation}>{complexity.explanation}</p>}
          {complexity?.bottleneck && (
            <p className={styles.detail}>
              <strong>Bottleneck:</strong> {complexity.bottleneck}
            </p>
          )}
          {complexity?.betterApproach && (
            <p className={styles.detail}>
              <strong>Could be faster:</strong> {complexity.betterApproach}
            </p>
          )}
          {solution.notes && <p className={styles.detail}>{solution.notes}</p>}
          {solution.code && <pre className={styles.code}>{solution.code}</pre>}

          <div className={styles.actions}>
            {solution.url && (
              <a
                className={styles.link}
                href={solution.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                Open problem <ExternalLink size={11} />
              </a>
            )}
            <button
              type="button"
              className={styles.delete}
              onClick={onDelete}
              aria-label={`Delete ${solution.title} from the solve log`}
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
