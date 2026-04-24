import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Chokidar ignore list for Vitest's watch mode. Must be kept in sync with any
// directories that shouldn't trip inotify (e.g. the Rust target/ dir has
// thousands of .rlib artifacts — without this, `pnpm test` in watch mode will
// ENOSPC on Linux systems with the default fs.inotify.max_user_watches).
const watchIgnored = [
  "**/node_modules/**",
  "**/dist/**",
  "**/coverage/**",
  "**/.git/**",
  "**/src-tauri/**",
  "**/test-results/**",
  "**/playwright-report/**",
];

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: watchIgnored,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    css: true,
    server: {
      watch: {
        ignored: watchIgnored,
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules/",
        "src/test/",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/types/**",
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/*.config.*",
        "src-tauri/",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
  },
});
