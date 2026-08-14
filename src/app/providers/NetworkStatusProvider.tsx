import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const NetworkStatusContext = createContext<boolean>(true);

/** Drives the "You're offline, showing your last synced data" banner (SRS §47-48). */
export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return <NetworkStatusContext.Provider value={online}>{children}</NetworkStatusContext.Provider>;
}

export function useIsOnline(): boolean {
  return useContext(NetworkStatusContext);
}
