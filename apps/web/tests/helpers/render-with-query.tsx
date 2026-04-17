import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

type SeededQuery = { key: readonly unknown[]; data: unknown };

export type RenderWithQueryOptions = RenderOptions & {
  cache?: SeededQuery[];
};

export function renderWithQuery(ui: ReactElement, options: RenderWithQueryOptions = {}) {
  const { cache = [], ...renderOptions } = options;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  for (const { key, data } of cache) {
    client.setQueryData(key, data);
  }
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>, renderOptions);
}
