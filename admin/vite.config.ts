import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// No PWA plugin here, deliberately — this is an operator tool used on a
// laptop, not something anyone should install to a home screen or expect to
// work offline. Keeping it a plain SPA also means one fewer service-worker
// registration to reason about on a domain that already has none.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
  },
});
