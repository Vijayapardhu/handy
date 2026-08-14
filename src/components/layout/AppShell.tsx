import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import "@/styles/global.css";

export function AppShell() {
  return (
    <div className="app-shell">
      <OfflineBanner />
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
