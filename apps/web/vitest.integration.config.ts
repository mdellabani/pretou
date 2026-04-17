import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    pool: "forks",
    singleFork: true,
    testTimeout: 15_000,
    hookTimeout: 15_000,
    passWithNoTests: true,
  } as any,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
