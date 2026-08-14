import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markAllAsRead, markAsRead } from "@/services/notifications/notificationService";
import { useAuth } from "@/app/providers/AuthProvider";

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications", user?.uid],
    queryFn: () => getNotifications(user!.uid),
    enabled: Boolean(user),
  });
}

export function useMarkNotificationRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => markAsRead(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.uid] }),
  });
}

export function useMarkAllNotificationsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllAsRead(user!.uid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.uid] }),
  });
}
