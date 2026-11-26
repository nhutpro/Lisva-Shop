import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Two groups of tests:
//  - unit: pure logic and React components. No database (fast, runs anywhere): `npm run test:unit`.
//  - integration: files named *.db.test.ts, run against the real lisva_test database: `npm run test:integration`.
// `npm test` runs both.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.db.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.db.test.ts"],
          // Applies the migrations to the test database first.
          globalSetup: ["./vitest.global-setup.ts"],
          // These tests share one database, so files run one after another.
          fileParallelism: false,
        },
      },
    ],
  },
});
