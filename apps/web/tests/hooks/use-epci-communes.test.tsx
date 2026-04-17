import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEpciCommunes } from "@/hooks/queries/use-epci-communes";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

function wrap(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("useEpciCommunes", () => {
  it("returns hydrated communes", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    qc.setQueryData(["epci-communes", "e-1"], [
      { id: "c-1", name: "Saint-Martin" },
      { id: "c-2", name: "Saint-Pierre" },
    ]);
    const { result } = renderHook(() => useEpciCommunes("e-1"), { wrapper: wrap(qc) });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.data).toHaveLength(2);
  });

  it("is disabled when epciId is null", () => {
    const qc = new QueryClient();
    const { result } = renderHook(() => useEpciCommunes(null), { wrapper: wrap(qc) });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
