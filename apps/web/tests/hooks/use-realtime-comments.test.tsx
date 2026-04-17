import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryKeys } from "@rural-community-platform/shared";
import { useRealtimeComments } from "@/hooks/use-realtime-comments";

type Handler = (payload: { eventType: string; new?: unknown; old?: unknown }) => void;
let capturedHandler: Handler | null = null;

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: (_event: string, _filter: unknown, h: Handler) => {
        capturedHandler = h;
        return { subscribe: () => ({}) };
      },
    }),
    removeChannel: () => undefined,
  }),
}));

function wrap(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("useRealtimeComments", () => {
  it("prepends on INSERT", () => {
    capturedHandler = null;
    const qc = new QueryClient();
    qc.setQueryData(queryKeys.comments("p1"), [{ id: "c0", body: "old" }]);
    renderHook(() => useRealtimeComments("p1"), { wrapper: wrap(qc) });
    act(() => {
      capturedHandler?.({ eventType: "INSERT", new: { id: "c1", body: "new" } });
    });
    expect(qc.getQueryData(queryKeys.comments("p1"))).toEqual([
      { id: "c1", body: "new" },
      { id: "c0", body: "old" },
    ]);
  });

  it("removes on DELETE", () => {
    capturedHandler = null;
    const qc = new QueryClient();
    qc.setQueryData(queryKeys.comments("p1"), [{ id: "c0" }, { id: "c1" }]);
    renderHook(() => useRealtimeComments("p1"), { wrapper: wrap(qc) });
    act(() => {
      capturedHandler?.({ eventType: "DELETE", old: { id: "c0" } });
    });
    expect(qc.getQueryData(queryKeys.comments("p1"))).toEqual([{ id: "c1" }]);
  });

  it("updates on UPDATE", () => {
    capturedHandler = null;
    const qc = new QueryClient();
    qc.setQueryData(queryKeys.comments("p1"), [{ id: "c0", body: "old" }, { id: "c1", body: "another" }]);
    renderHook(() => useRealtimeComments("p1"), { wrapper: wrap(qc) });
    act(() => {
      capturedHandler?.({ eventType: "UPDATE", new: { id: "c0", body: "updated" } });
    });
    expect(qc.getQueryData(queryKeys.comments("p1"))).toEqual([
      { id: "c0", body: "updated" },
      { id: "c1", body: "another" },
    ]);
  });
});
