import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, PartyPopper } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SUBJECT_ICONS } from "@/constants/subjectIcons";
import { ROUTES } from "@/constants/routes";
import type { SubjectWithStatus } from "@/services/subjects/subjectService";
import styles from "./NeedsAttentionList.module.css";

const MAX_ITEMS = 3;

/** SRS §8.3 — only the most urgent 2-3 subjects, never the full list, on the home page. */
export function NeedsAttentionList({ subjects }: { subjects: SubjectWithStatus[] }) {
  const atRisk = subjects
    .filter((s) => s.status === "critical" || s.status === "low")
    .sort((a, b) => (a.percentage ?? 0) - (b.percentage ?? 0))
    .slice(0, MAX_ITEMS);

  return (
    <Card padded={false} className={styles.card}>
      <div className={styles.header}>
        <span className={styles.headerLeft}>
          <span className={styles.iconWrap}>
            <AlertTriangle size={16} />
          </span>
          <span className={styles.headerTitle}>Needs Attention</span>
        </span>
        <Link to={ROUTES.subjects} className={styles.viewAll}>
          View all <ChevronRight size={14} />
        </Link>
      </div>

      {atRisk.length === 0 ? (
        <div className={styles.allGood}>
          <PartyPopper size={18} />
          <span>Nothing urgent — every subject is on track.</span>
        </div>
      ) : (
        <ul className={styles.list}>
          {atRisk.map((subject) => {
            const Icon = SUBJECT_ICONS[subject.icon];
            return (
              <li key={subject.subjectId}>
                <Link to={ROUTES.subjectDetail(subject.subjectId)} className={styles.row}>
                  <span className={styles.rowIcon}>
                    <Icon size={18} />
                  </span>
                  <span className={styles.rowBody}>
                    <span className={styles.rowName}>{subject.subjectName}</span>
                    <span className={styles.rowMeta}>
                      {subject.attended} / {subject.held} Classes
                    </span>
                  </span>
                  <StatusBadge status={subject.status} />
                  <ChevronRight size={16} className={styles.chevron} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className={styles.tip}>Focus on attending next classes to improve your percentage.</p>
    </Card>
  );
}
