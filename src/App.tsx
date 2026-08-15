// Vite build, so this is the /react entry point — the /next one in Vercel's
// setup instructions would fail to resolve here.
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { QueryProvider } from "@/app/providers/QueryProvider";
import { NetworkStatusProvider } from "@/app/providers/NetworkStatusProvider";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import { AccentProvider } from "@/app/providers/AccentProvider";
import { AppRouter } from "@/app/router/AppRouter";

export default function App() {
  return (
    <ThemeProvider>
      <AccentProvider>
        <QueryProvider>
          <NetworkStatusProvider>
            <AuthProvider>
              <AppRouter />
              {/* Page views only — no props, so nothing about a student is sent. */}
              <Analytics />
            </AuthProvider>
          </NetworkStatusProvider>
        </QueryProvider>
      </AccentProvider>
    </ThemeProvider>
  );
}
