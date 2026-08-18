import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, PartyPopper, TrendingUp } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { ROUTES } from "@/constants/routes";
import { calculateRequiredClasses } from "@/lib/calculations/attendance";
import type { SubjectWithStatus } from "@/services/subjects/subjectService";
import styles from "./NeedsAttentionList.module.css";

const MAX_ITEMS = 5;

/**
 * Percentage-first, like mobile's _AtRiskStrip (today_screen.dart) — the
 * number a student is worried about, and what it costs to fix it, rather
 * than a raw attended/held count. A horizontal strip for the same reason
 * mobile uses one: home-screen space is for the two or three subjects
 * nearest the line, not the full list (SRS §8.3).
 */
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
        <div className={styles.strip}>
          {atRisk.map((subject) => {
            const required = calculateRequiredClasses(subject.attended, subject.held, subject.targetAttendance);
            return (
              <Link
                key={subject.subjectId}
                to={ROUTES.subjectDetail(subject.subjectId)}
                className={styles.riskCard}
                data-status={subject.status}
              >
                <span className={styles.riskName}>{subject.shortName || subject.subjectName}</span>
                <span className={styles.riskPercentage}>
                  {subject.percentage === null ? "N/A" : `${subject.percentage.toFixed(2)}%`}
                </span>
                <span className={styles.riskNeed}>
                  {required.status === "unreachable"
                    ? "target out of reach"
                    : `need ${required.classesNeeded} more`}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <Link to={ROUTES.attendanceTrend} className={styles.tip}>
        <TrendingUp size={16} className={styles.tipIcon} />
        <span>Focus on attending next classes to improve your percentage.</span>
        <ChevronRight size={16} className={styles.tipChevron} />
      </Link>
    </Card>
  );
}
