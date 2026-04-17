import { QueryClient, dehydrate, type DehydratedState } from "@tanstack/react-query";

export async function prefetchAndDehydrate(
  prefetchFn: (qc: QueryClient) => Promise<void>,
): Promise<DehydratedState> {
  const qc = new QueryClient();
  await prefetchFn(qc);
  return dehydrate(qc);
}
