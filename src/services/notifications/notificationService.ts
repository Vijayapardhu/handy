import { doc, getDocs, orderBy, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "@/app/config/firebase";
import { COLLECTIONS, notificationsCol } from "@/services/firebase/collections";
import type { NotificationDoc } from "@/types/notification";

export async function getNotifications(userId: string): Promise<NotificationDoc[]> {
  const q = query(
    notificationsCol(),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export async function markAsRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.notifications, notificationId), { read: true });
}

export async function markAllAsRead(userId: string): Promise<void> {
  const q = query(notificationsCol(), where("userId", "==", userId), where("read", "==", false));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;
  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}
