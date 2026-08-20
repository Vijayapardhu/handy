import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarClock, Check, ExternalLink, Plus } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { useCreateTask } from "@/hooks/useTasks";
import { PLATFORM_BRAND } from "@/constants/codingBrand";
import { PLATFORM_META, type ContestItem } from "@/types/coding";
import styles from "./ContestList.module.css";

/**
 * What is coming up on Codeforces, LeetCode and CodeChef.
 *
 * GeeksforGeeks and HackerRank are missing on purpose: neither publishes an
 * upcoming-contest feed, and a list scraped off a marketing page would go
 * stale without ever saying so.
 *
 * Each row can become a deadline, which is the point of showing them here —
 * a contest a student remembers on Sunday evening is a contest they missed.
 * The reminder then rides the notification machinery the task list already
 * has, rather than needing one of its own.
 */
export function ContestList({ contests }: { contests: ContestItem[] }) {
  const createTask = useCreateTask();
  const [added, setAdded] = useState<Set<string>>(new Set());

  function handleAdd(contest: ContestItem) {
    const startsAt = parseISO(contest.startsAt);
    createTask.mutate(
      {
        title: contest.name,
        notes: `${PLATFORM_META[contest.platform].label} contest\n${contest.url}`,
        kind: "other",
        dueDate: format(startsAt, "yyyy-MM-dd"),
        dueTime: format(startsAt, "HH:mm"),
        // A day's notice is what makes a contest reminder useful; any less and
        // it arrives while the contest is starting.
        leadDays: 1,
      },
      { onSuccess: () => setAdded((previous) => new Set(previous).add(contest.url)) },
    );
  }

  return (
    <Card className={styles.card}>
      <p className={styles.title}>
        <CalendarClock size={15} /> Upcoming contests
      </p>

      <ul className={styles.list}>
        {contests.map((contest) => {
          const startsAt = parseISO(contest.startsAt);
          const isAdded = added.has(contest.url);
          return (
            <li key={contest.url} className={styles.row}>
              <span
                className={styles.dot}
                style={{ background: PLATFORM_BRAND[contest.platform].color }}
                aria-hidden="true"
              />
              <div className={styles.body}>
                <a
                  className={styles.name}
                  href={contest.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {contest.name} <ExternalLink size={11} />
                </a>
                <p className={styles.meta}>
                  {PLATFORM_META[contest.platform].label} · {format(startsAt, "EEE d MMM, h:mm a")}
                  {contest.durationMinutes ? ` · ${formatDuration(contest.durationMinutes)}` : ""}
                </p>
              </div>
              <button
                type="button"
                className={styles.add}
                onClick={() => handleAdd(contest)}
                disabled={isAdded}
                aria-label={isAdded ? `${contest.name} is on your list` : `Add ${contest.name} to deadlines`}
              >
                {isAdded ? <Check size={14} /> : <Plus size={14} />}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
