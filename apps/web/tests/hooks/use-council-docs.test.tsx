import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, beforeEach, describe, it, expect } from "vitest";
import { useCouncilDocs } from "@/hooks/queries/use-council-docs";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useCouncilDocs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates cached data from query client", async () => {
    const queryClient = new QueryClient();
    const testDocs = [{ id: "d-1", title: "Compte rendu" }];

    queryClient.setQueryData(["council-docs", "c-1"], testDocs);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCouncilDocs("c-1"), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(testDocs);
    });
  });

  it("disables query when communeId is empty", () => {
    const { result } = renderHook(() => useCouncilDocs(""), {
      wrapper: createWrapper(),
    });

    expect(result.current.status).toBe("pending");
  });
});
