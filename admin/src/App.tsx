import { QueryProvider } from "@/app/providers/QueryProvider";
import { AdminAuthProvider } from "@/app/providers/AdminAuthProvider";
import { AdminRouter } from "@/app/router/AdminRouter";

export default function App() {
  return (
    <QueryProvider>
      <AdminAuthProvider>
        <AdminRouter />
      </AdminAuthProvider>
    </QueryProvider>
  );
}
