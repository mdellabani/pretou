import { useQuery } from "@tanstack/react-query";
import { getCouncilDocsByCommune, queryKeys } from "@rural-community-platform/shared";
import { createClient } from "@/lib/supabase/client";

export function useCouncilDocs(communeId: string) {
  return useQuery({
    queryKey: queryKeys.councilDocs(communeId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await getCouncilDocsByCommune(supabase, communeId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!communeId,
    staleTime: 30 * 60_000,
  });
}
