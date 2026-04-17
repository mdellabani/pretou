import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    pool: "forks",
    // @ts-expect-error — singleFork is top-level in Vitest 4, types in this version haven't caught up yet
    singleFork: true,
    testTimeout: 15_000,
    hookTimeout: 15_000,
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
