import { useQuery } from "@tanstack/react-query";
import { getMyComments, queryKeys } from "@rural-community-platform/shared";
import { createClient } from "@/lib/supabase/client";

export function useMyComments(userId: string) {
  return useQuery({
    queryKey: queryKeys.me.comments(userId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await getMyComments(supabase, userId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });
}
