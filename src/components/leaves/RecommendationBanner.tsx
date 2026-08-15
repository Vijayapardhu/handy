import { ShieldAlert, ShieldCheck, ShieldQuestion } from "@/components/ui/icons";
import type { LeaveRecommendation } from "@/types/leave";
import styles from "./RecommendationBanner.module.css";

const CONTENT: Record<
  LeaveRecommendation,
  { icon: typeof ShieldCheck; title: string; description: string }
> = {
  safe: {
    icon: ShieldCheck,
    title: "Leave is relatively safe",
    description: "Your attendance remains above the target.",
  },
  caution: {
    icon: ShieldQuestion,
    title: "Leave will reduce your attendance",
    description: "Consider attending this day if possible.",
  },
  not_recommended: {
    icon: ShieldAlert,
    title: "Not Recommended",
    description: "Taking leave on this day will bring your attendance below the required target.",
  },
};

export function RecommendationBanner({
  recommendation,
  affectedSubjectCount,
}: {
  recommendation: LeaveRecommendation;
  affectedSubjectCount: number;
}) {
  const { icon: Icon, title, description } = CONTENT[recommendation];
  return (
    <div className={styles.banner} data-tone={recommendation}>
      <Icon size={20} className={styles.icon} />
      <div>
        <p className={styles.title}>{title}</p>
        <p className={styles.description}>
          {description} {affectedSubjectCount > 0 && `Affects ${affectedSubjectCount} subject${affectedSubjectCount === 1 ? "" : "s"}.`}
        </p>
      </div>
    </div>
  );
}
