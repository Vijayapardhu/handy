import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
  { ignores: ["dist", "dev-dist", "node_modules", "extension/build", "extension/icons"] },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: globals.browser,
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-unused-vars": "off",
    },
  },
  {
    // Node-executed config/tooling files — not shipped to the browser.
    files: [
      "*.config.{ts,js,mjs}",
      "scripts/**/*.mjs",
      "extension/scripts/**/*.mjs",
      "extension/test/server.mjs",
      // Vercel serverless functions — Node runtime, server-side only.
      "api/**/*.js",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // The extension's own runtime code — plain (non-module) scripts that run
    // in a browser/content-script/service-worker context with the WebExtension
    // `chrome.*` API, not through the app's Vite/TS toolchain.
    files: ["extension/src/**/*.js", "extension/popup/**/*.js"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions },
    },
  },
];
