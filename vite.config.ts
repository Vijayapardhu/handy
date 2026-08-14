import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Handy — Attendance Assistant",
        short_name: "Handy",
        description: "Understand → Calculate → Decide → Act",
        theme_color: "#f97316",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // Cache last-known timetable/attendance API responses (Firestore SDK
        // uses its own offline persistence; this covers static app shell + assets).
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        // The FCM service worker must be fetched fresh and registered on its
        // own scope — precaching another service worker's script through this
        // one causes stale-registration bugs that are miserable to debug.
        globIgnores: ["**/firebase-messaging-sw.js"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
