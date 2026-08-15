import { defineConfig } from "vitest/config";
import path from "node:path";

// Same shape as the root project's vitest.config.ts — api/ holds the Vercel
// serverless functions (plain JS, outside src/ by Vercel's convention), and
// tests sit next to what they cover.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "api/**/*.test.js"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
