import { SUBJECT_ICONS } from "@/constants/subjectIcons";
import type { SubjectLeaveImpact } from "@/types/leave";
import styles from "./LeaveImpactTable.module.css";

function impactTone(impact: number | null): "positive" | "minor" | "negative" {
  if (impact === null) return "minor";
  if (impact > -0.01) return "positive";
  if (impact >= -2) return "minor";
  return "negative";
}

export function LeaveImpactTable({ subjects }: { subjects: SubjectLeaveImpact[] }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <span />
        <span>Before</span>
        <span />
        <span>After</span>
        <span>Impact</span>
      </div>
      <ul className={styles.list}>
        {subjects.map((s) => {
          const Icon = SUBJECT_ICONS[s.icon as keyof typeof SUBJECT_ICONS] ?? SUBJECT_ICONS.book;
          const tone = impactTone(s.impact);
          return (
            <li key={s.subjectId} className={styles.row}>
              <span className={styles.subject}>
                <span className={styles.iconWrap}>
                  <Icon size={16} />
                </span>
                <span>
                  <span className={styles.subjectName}>{s.subjectName}</span>
                  <span className={styles.classCount}>
                    {s.classesOnDate} class{s.classesOnDate === 1 ? "" : "es"}
                  </span>
                </span>
              </span>
              <span className={styles.percent}>
                {s.beforePercentage === null ? "N/A" : `${s.beforePercentage}%`}
              </span>
              <span className={styles.arrow}>→</span>
              <span className={styles.percent}>
                {s.afterPercentage === null ? "N/A" : `${s.afterPercentage}%`}
              </span>
              <span className={styles.impact} data-tone={tone}>
                {s.impact === null ? "N/A" : `${s.impact > 0 ? "+" : ""}${s.impact}%`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
