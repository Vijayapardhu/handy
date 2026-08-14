import { AuthProvider } from "@/app/providers/AuthProvider";
import { QueryProvider } from "@/app/providers/QueryProvider";
import { NetworkStatusProvider } from "@/app/providers/NetworkStatusProvider";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import { AppRouter } from "@/app/router/AppRouter";

export default function App() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <NetworkStatusProvider>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </NetworkStatusProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
