import { useState } from "react";
import { Check, ExternalLink, Plus, Target } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { useCreateTask } from "@/hooks/useTasks";
import { PLATFORM_BRAND } from "@/constants/codingBrand";
import { todayIso } from "@/lib/date";
import type { DailyProblem } from "@/types/coding";
import styles from "./DailyProblemCard.module.css";

const LEETCODE = PLATFORM_BRAND.leetcode;

/**
 * LeetCode's problem of the day.
 *
 * The one thing on this page that is the same for everybody, and the cheapest
 * possible answer to "what should I practise": there is a problem, it is
 * today's, here it is.
 *
 * "Add to deadlines" writes it into the same task list as an assignment. That
 * is the whole reason practice lives on this page rather than a separate one:
 * a student's day is one list, and an intention that is not on it does not
 * happen.
 */
export function DailyProblemCard({ daily }: { daily: DailyProblem }) {
  const createTask = useCreateTask();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    createTask.mutate(
      {
        title: `Daily problem: ${daily.title}`,
        notes: `${daily.url}\n\n${daily.difficulty ?? "unrated"}${daily.tags.length ? ` · ${daily.tags.join(", ")}` : ""}`,
        kind: "other",
        dueDate: todayIso(),
      },
      { onSuccess: () => setAdded(true) },
    );
  }

  return (
    <Card className={styles.card}>
      <div className={styles.head}>
        <p className={styles.label}>
          <Target size={14} /> Today's problem
          <span className={styles.source} style={{ color: LEETCODE.color, background: `color-mix(in srgb, ${LEETCODE.color} 15%, transparent)` }}>
            LeetCode
          </span>
        </p>
        {daily.difficulty && (
          <span className={styles.difficulty} data-level={daily.difficulty}>
            {daily.difficulty}
          </span>
        )}
      </div>

      <a className={styles.title} href={daily.url} target="_blank" rel="noreferrer noopener">
        {daily.title} <ExternalLink size={13} />
      </a>

      {daily.tags.length > 0 && (
        <div className={styles.tags}>
          {daily.tags.slice(0, 4).map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        className={styles.add}
        onClick={handleAdd}
        disabled={added || createTask.isPending}
      >
        {added ? (
          <>
            <Check size={13} /> On your list
          </>
        ) : (
          <>
            <Plus size={13} /> Add to deadlines
          </>
        )}
      </button>
    </Card>
  );
}
