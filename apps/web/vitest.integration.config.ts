import { defineConfig } from "vitest/config";
import path from "path";

// Load .env.local so `pnpm test:integration` picks up
// NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY without
// requiring developers to export them in the shell. CI passes the
// vars in directly so the file is absent and loadEnvFile is a no-op.
try {
  process.loadEnvFile(path.resolve(__dirname, ".env.local"));
} catch {
  // .env.local is optional; if absent rely on the shell env.
}

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    pool: "forks",
    // Vitest 4: replaces deprecated poolOptions.forks.singleFork.
    // Forces sequential test-file execution so the integration tests
    // share a single local Supabase without contention.
    fileParallelism: false,
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
