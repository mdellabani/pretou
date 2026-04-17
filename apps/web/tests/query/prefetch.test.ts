import { describe, expect, it } from "vitest";
import { prefetchAndDehydrate } from "@/lib/query/prefetch";

describe("prefetchAndDehydrate", () => {
  it("returns a dehydrated state containing the prefetched query data", async () => {
    const state = await prefetchAndDehydrate(async (qc) => {
      await qc.prefetchQuery({
        queryKey: ["hello"],
        queryFn: async () => ({ greeting: "bonjour" }),
      });
    });

    // Dehydrated state shape: { queries: [...], mutations: [...] }
    expect(state).toHaveProperty("queries");
    expect(Array.isArray(state.queries)).toBe(true);
    const entry = state.queries.find((q) => JSON.stringify(q.queryKey) === JSON.stringify(["hello"]));
    expect(entry).toBeDefined();
    expect(entry?.state.data).toEqual({ greeting: "bonjour" });
  });

  it("awaits the caller's prefetch callback before dehydrating", async () => {
    let prefetchFinished = false;
    const state = await prefetchAndDehydrate(async (qc) => {
      await qc.prefetchQuery({
        queryKey: ["delayed"],
        queryFn: async () => {
          await new Promise((r) => setTimeout(r, 10));
          return 42;
        },
      });
      prefetchFinished = true;
    });
    expect(prefetchFinished).toBe(true);
    const entry = state.queries.find((q) => JSON.stringify(q.queryKey) === JSON.stringify(["delayed"]));
    expect(entry?.state.data).toBe(42);
  });

  it("produces a cache-free state when no prefetch is performed", async () => {
    const state = await prefetchAndDehydrate(async () => {
      /* no-op */
    });
    expect(state.queries).toEqual([]);
  });
});
