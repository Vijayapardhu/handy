import { WifiOff } from "lucide-react";
import { useIsOnline } from "@/app/providers/NetworkStatusProvider";
import styles from "./OfflineBanner.module.css";

/** SRS §47-48: never pretend a write synced while offline — this banner is the honest signal. */
export function OfflineBanner() {
  const online = useIsOnline();
  if (online) return null;
  return (
    <div className={styles.banner} role="status">
      <WifiOff size={16} />
      <span>You&rsquo;re offline. Showing your last synced data.</span>
    </div>
  );
}
