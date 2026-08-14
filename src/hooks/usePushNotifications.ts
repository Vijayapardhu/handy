import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  enablePush,
  getPermissionState,
  isPushSupported,
  onPushMessage,
} from "@/services/notifications/pushService";

export type PushState = "checking" | "unsupported" | "default" | "granted" | "denied";

/**
 * Push permission state plus the action to request it.
 *
 * Also subscribes to foreground messages: while Handy is open the browser
 * shows nothing on its own, so an arriving push has to be turned into
 * something visible — here, a refresh of the in-app notification list.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<PushState>("checking");
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isPushSupported().then((supported) => {
      if (cancelled) return;
      if (!supported) {
        setState("unsupported");
        return;
      }
      const permission = getPermissionState();
      setState(permission === "unsupported" ? "unsupported" : permission);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state !== "granted") return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    onPushMessage(() => {
      // The payload duplicates a `notifications` document the sender also
      // wrote, so refetching is both simpler and more consistent than trying
      // to splice the push payload into the cache.
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }).then((fn) => {
      if (cancelled) fn();
      else unsubscribe = fn;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [state, queryClient]);

  const enable = useCallback(async () => {
    if (!user) return;
    setEnabling(true);
    try {
      const token = await enablePush(user.uid);
      setState(token ? "granted" : (getPermissionState() as PushState));
    } finally {
      setEnabling(false);
    }
  }, [user]);

  return { state, enable, enabling };
}
