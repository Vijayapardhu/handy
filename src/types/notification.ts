export type NotificationType = "timetable" | "attendance" | "target" | "leave" | "announcement";

export interface NotificationDoc {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
}
