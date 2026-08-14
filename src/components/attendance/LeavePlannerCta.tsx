import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import styles from "./LeavePlannerCta.module.css";

/** SRS §8.5 */
export function LeavePlannerCta() {
  return (
    <Link to={ROUTES.leavePlanner} className={styles.card}>
      <span className={styles.iconWrap}>
        <CalendarClock size={22} />
      </span>
      <span className={styles.body}>
        <span className={styles.title}>Planning to take leave?</span>
        <span className={styles.subtitle}>Check how it will affect your attendance.</span>
      </span>
      <span className={styles.arrow}>
        <ArrowRight size={18} />
      </span>
    </Link>
  );
}
