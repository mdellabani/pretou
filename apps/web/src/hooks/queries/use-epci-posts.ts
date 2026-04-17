import { useInfiniteQuery } from "@tanstack/react-query";
import { getEpciPosts, queryKeys } from "@rural-community-platform/shared";
import type { Post } from "@rural-community-platform/shared";
import { createClient } from "@/lib/supabase/client";

export function useEpciPosts(epciId: string, communeIds?: string[]) {
  return useInfiniteQuery({
    queryKey: queryKeys.posts.epci(epciId, communeIds),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await getEpciPosts(supabase, epciId, communeIds);
      if (error) throw error;
      return (data ?? []) as Post[];
    },
    initialPageParam: null as string | null,
    getNextPageParam: () => undefined,
    enabled: !!epciId,
  });
}
