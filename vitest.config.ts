import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // api/ holds the Vercel serverless function, which is plain JS and lives
    // outside src/ by Vercel's convention — its tests sit next to it.
    include: ["src/**/*.test.ts", "api/**/*.test.js"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
