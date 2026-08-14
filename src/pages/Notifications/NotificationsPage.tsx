import { Bell, Calendar, TrendingDown, Target, FileText, Megaphone, CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { TopHeader } from "@/components/layout/TopHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/hooks/useNotifications";
import { formatDisplayDate } from "@/lib/date";
import type { NotificationType } from "@/types/notification";
import { cn } from "@/lib/utils/cn";
import styles from "./NotificationsPage.module.css";

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  timetable: Calendar,
  attendance: TrendingDown,
  target: Target,
  leave: FileText,
  announcement: Megaphone,
};

export function NotificationsPage() {
  const { data: notifications, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <div>
      <TopHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
        action={
          unreadCount > 0 && (
            <Button size="sm" variant="ghost" onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
              <CheckCheck size={14} /> Mark all read
            </Button>
          )
        }
      />

      {isError && <ErrorState message="Unable to load notifications." onRetry={refetch} />}

      {!isError && isLoading && (
        <div className={styles.loadingStack}>
          <Skeleton height={64} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </div>
      )}

      {!isError && !isLoading && notifications && notifications.length === 0 && (
        <EmptyState icon={Bell} title="No notifications" description="Timetable changes, attendance alerts, and announcements will show up here." />
      )}

      {!isError && !isLoading && notifications && notifications.length > 0 && (
        <ul className={styles.list}>
          {notifications.map((n) => {
            const Icon = TYPE_ICON[n.type];
            const content = (
              <>
                <span className={cn(styles.iconWrap, styles[n.type])}>
                  <Icon size={17} />
                </span>
                <span className={styles.body}>
                  <span className={styles.titleRow}>
                    <span className={styles.notifTitle}>{n.title}</span>
                    {!n.read && <span className={styles.dot} />}
                  </span>
                  <span className={styles.notifBody}>{n.body}</span>
                  <span className={styles.date}>{formatDisplayDate(n.createdAt.slice(0, 10))}</span>
                </span>
              </>
            );
            return (
              <li key={n.id}>
                {n.actionUrl ? (
                  <Link
                    to={n.actionUrl}
                    className={styles.row}
                    onClick={() => !n.read && markRead.mutate(n.id)}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() => !n.read && markRead.mutate(n.id)}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
