import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/constants/routes";
import styles from "./NotFoundPage.module.css";

export function NotFoundPage() {
  return (
    <div className={styles.wrapper}>
      <p className={styles.code}>404</p>
      <p className={styles.title}>Page not found</p>
      <Link to={ROUTES.home}>
        <Button size="sm">Back to Home</Button>
      </Link>
    </div>
  );
}
