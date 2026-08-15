import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, Megaphone, Paperclip } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useGroupAnnouncements, useMyClassGroups } from "@/hooks/useClassRep";
import { matchGroupKey } from "@/services/announcements/announcementService";
import { formatDisplayDate } from "@/lib/date";
import { ROUTES } from "@/constants/routes";
import styles from "./SubjectAnnouncements.module.css";

interface Props {
  subjectCode: string;
  facultyId: string;
}

/**
 * What the class rep has posted for this subject.
 *
 * A notification is a moment; this is where a note goes to still be findable
 * three weeks later, when a student is revising and remembers there was
 * something about the lab record. Filed under the subject because that is
 * where they will look for it, not under "notifications".
 */
export function SubjectAnnouncements({ subjectCode, facultyId }: Props) {
  const groups = useMyClassGroups();
  const groupKey = matchGroupKey(groups.data ?? [], subjectCode, facultyId);
  const announcements = useGroupAnnouncements(groupKey);

  // No group means this subject predates class groups, or the student has not
  // synced since they were introduced. Showing an empty "no announcements" box
  // would imply the rep has posted nothing, which is a different claim.
  if (!groups.isLoading && !groupKey) return null;

  if (groups.isLoading || announcements.isLoading) {
    return (
      <Card className={styles.card}>
        <Skeleton height={18} />
        <div style={{ height: 10 }} />
        <Skeleton height={44} />
      </Card>
    );
  }

  const items = announcements.data ?? [];

  return (
    <Card className={styles.card}>
      <div className={styles.head}>
        <Megaphone size={15} aria-hidden="true" />
        <h2 className={styles.title}>From your class rep</h2>
        {items.length > 0 && <span className={styles.count}>{items.length}</span>}
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>
          Nothing posted for this class yet. Notes and notices from your class representative will
          appear here.
        </p>
      ) : (
        <ul className={styles.list}>
          {items.slice(0, 5).map((item) => (
            <li key={item.id}>
              <Link to={ROUTES.announcement(item.id)} className={styles.row}>
                <span className={styles.rowBody}>
                  <span className={styles.rowTitle}>
                    {item.important && (
                      <AlertTriangle
                        size={13}
                        className={styles.importantIcon}
                        aria-label="Important"
                      />
                    )}
                    {item.title}
                  </span>
                  <span className={styles.rowMeta}>
                    {formatDisplayDate(item.createdAt.slice(0, 10))}
                    {item.media.length > 0 && (
                      <>
                        {" · "}
                        <Paperclip size={11} aria-hidden="true" /> {item.media.length}
                      </>
                    )}
                  </span>
                </span>
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
