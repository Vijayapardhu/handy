import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // api/ holds the Vercel serverless function, and extension/ the browser
    // extension — both plain JS living outside src/ by their own conventions,
    // tests sitting next to the code they test.
    include: ["src/**/*.test.ts", "api/**/*.test.js", "extension/**/*.test.js"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
