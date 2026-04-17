import { describe, expect, it } from "vitest";
import { makeQueryClient } from "@/lib/query/client";

describe("makeQueryClient", () => {
  it("applies a 5-minute staleTime default", () => {
    const qc = makeQueryClient();
    const defaults = qc.getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(1000 * 60 * 5);
  });

  it("applies a 30-minute gcTime default", () => {
    const qc = makeQueryClient();
    const defaults = qc.getDefaultOptions().queries;
    expect(defaults?.gcTime).toBe(1000 * 60 * 30);
  });

  it("retries twice on failure", () => {
    const qc = makeQueryClient();
    expect(qc.getDefaultOptions().queries?.retry).toBe(2);
  });

  it("does not refetch on window focus (we rely on Realtime for freshness)", () => {
    const qc = makeQueryClient();
    expect(qc.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
  });

  it("returns a new instance each call", () => {
    expect(makeQueryClient()).not.toBe(makeQueryClient());
  });
});
