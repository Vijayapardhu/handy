import { Trophy, Users } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import type { LeaderboardEntry } from "@/types/coding";
import styles from "./ClassLeaderboard.module.css";

/**
 * How the class is doing, by problems solved.
 *
 * "Class" is the student's own college, department, year and section, derived
 * from the portal — not something anyone types, and not the per-subject class
 * groups announcements use (a coding board that split by lecturer would make
 * no sense).
 *
 * The rows carry a name, a roll number and a total, and nothing else: the
 * server never sends a classmate's handles, streak or solve log, so there is
 * no version of this screen that leaks them. Opting out removes the row for
 * everyone rather than hiding it here.
 */
export function ClassLeaderboard({
  entries,
  sharing,
  onToggleSharing,
  toggling,
}: {
  entries: LeaderboardEntry[];
  sharing: boolean;
  onToggleSharing: (share: boolean) => void;
  toggling: boolean;
}) {
  return (
    <Card className={styles.card}>
      <div className={styles.head}>
        <p className={styles.title}>
          <Trophy size={15} /> Class board
        </p>
        <label className={styles.shareToggle}>
          <input
            type="checkbox"
            checked={sharing}
            disabled={toggling}
            onChange={(event) => onToggleSharing(event.target.checked)}
          />
          Show me
        </label>
      </div>

      {entries.length === 0 ? (
        <div className={styles.empty}>
          <Users size={22} />
          <p>
            {sharing
              ? "Nobody in your class has connected a coding profile yet. Be the first."
              : "You're hidden from the board. Tick “Show me” to join it."}
          </p>
        </div>
      ) : (
        <ol className={styles.list}>
          {entries.map((entry, index) => (
            <li key={entry.rollNumber + index} className={cn(styles.row, entry.isMe && styles.me)}>
              <span className={styles.rank}>{index + 1}</span>
              <span className={styles.name}>
                {entry.name}
                <span className={styles.roll}>{entry.rollNumber}</span>
              </span>
              <span className={styles.total}>{entry.totalSolved}</span>
            </li>
          ))}
        </ol>
      )}

      <p className={styles.note}>
        Totals only — nobody can see your usernames, your streak or your solutions.
      </p>
    </Card>
  );
}
