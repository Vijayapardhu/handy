import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SUBJECT_ICONS } from "@/constants/subjectIcons";
import { ROUTES } from "@/constants/routes";
import type { SubjectWithStatus } from "@/services/subjects/subjectService";
import styles from "./SubjectRow.module.css";

export function SubjectRow({ subject }: { subject: SubjectWithStatus }) {
  const Icon = SUBJECT_ICONS[subject.icon];
  return (
    <Link to={ROUTES.subjectDetail(subject.subjectId)} className={styles.row}>
      <span className={styles.iconWrap} data-status={subject.status}>
        <Icon size={20} />
      </span>
      <span className={styles.body}>
        <span className={styles.name}>{subject.subjectName}</span>
        <ProgressBar value={subject.percentage ?? 0} status={subject.status} className={styles.progress} />
        <span className={styles.meta}>
          {subject.attended} / {subject.held} Classes
        </span>
      </span>
      <span className={styles.trailing}>
        <span className={styles.percentage}>
          {subject.percentage === null ? "N/A" : `${subject.percentage.toFixed(2)}%`}
        </span>
        <StatusBadge status={subject.status} />
        <ChevronRight size={18} className={styles.chevron} />
      </span>
    </Link>
  );
}
