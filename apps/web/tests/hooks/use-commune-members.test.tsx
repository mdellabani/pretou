import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, beforeEach, describe, it, expect } from "vitest";
import { useCommuneMembers } from "@/hooks/queries/use-commune-members";

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

describe("useCommuneMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates cached data from query client", async () => {
    const queryClient = new QueryClient();
    const testMembers = [{ id: "u-1", name: "Alice" }];

    queryClient.setQueryData(["admin", "members", "c-1"], testMembers);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCommuneMembers("c-1"), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(testMembers);
    });
  });

  it("disables query when communeId is empty", () => {
    const { result } = renderHook(() => useCommuneMembers(""), {
      wrapper: createWrapper(),
    });

    expect(result.current.status).toBe("pending");
  });
});
