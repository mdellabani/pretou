import { HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/super-admin";
import {
  getProfile,
  getPinnedPosts,
  getPostsPaginated,
  getEpciPosts,
  getCommunesByEpci,
  queryKeys,
} from "@rural-community-platform/shared";
import type { Post, PostListFilters } from "@rural-community-platform/shared";
import { prefetchAndDehydrate } from "@/lib/query/prefetch";
import { ThemeInjector } from "@/components/theme-injector";
import { FeedClient } from "./feed-client";

const PAGE_SIZE = 20;

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").filter(Boolean);
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; date?: string; types?: string; communes?: string }>;
}) {
  const params = await searchParams;
  const scope = params.scope === "epci" ? "epci" : "commune";
  const filters: PostListFilters = {
    types: parseCsv(params.types),
    dateFilter: (params.date ?? "") as PostListFilters["dateFilter"],
  };
  const selectedCommuneIds = parseCsv(params.communes);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await getProfile(supabase, user.id);
  if (!profile) {
    if (isSuperAdmin(user.email)) redirect("/super-admin");
    redirect("/auth/signup");
  }
  if (profile.status === "pending") redirect("/auth/pending");

  const dehydratedState = await prefetchAndDehydrate(async (qc) => {
    qc.setQueryData(queryKeys.profile(user.id), profile);

    await qc.prefetchQuery({
      queryKey: ["producer-count", profile.commune_id],
      queryFn: async () => {
        const { count } = await supabase
          .from("producers")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .eq("commune_id", profile.commune_id);
        return count ?? 0;
      },
    });

    if (scope === "epci" && profile.communes?.epci_id) {
      const epciId = profile.communes.epci_id;
      await qc.prefetchQuery({
        queryKey: ["epci-communes", epciId],
        queryFn: async () => {
          const { data } = await getCommunesByEpci(supabase, epciId);
          return (data ?? []).map((c) => ({ id: c.id, name: c.name }));
        },
      });
      await qc.prefetchInfiniteQuery({
        queryKey: queryKeys.posts.epci(
          epciId,
          selectedCommuneIds.length > 0 ? selectedCommuneIds : undefined,
        ),
        queryFn: async () => {
          const { data } = await getEpciPosts(
            supabase,
            epciId,
            selectedCommuneIds.length > 0 ? selectedCommuneIds : undefined,
          );
          return (data ?? []) as Post[];
        },
        initialPageParam: null as string | null,
      });
    } else {
      await qc.prefetchQuery({
        queryKey: queryKeys.posts.pinned(profile.commune_id),
        queryFn: async () => {
          const { data } = await getPinnedPosts(supabase, profile.commune_id);
          return (data ?? []) as Post[];
        },
      });
      await qc.prefetchInfiniteQuery({
        queryKey: queryKeys.posts.list(profile.commune_id, filters),
        queryFn: async () => {
          const { data } = await getPostsPaginated(
            supabase,
            profile.commune_id,
            null,
            PAGE_SIZE,
            filters,
          );
          return (data ?? []) as Post[];
        },
        initialPageParam: null as string | null,
      });
    }
  });

  return (
    <HydrationBoundary state={dehydratedState}>
      <ThemeInjector
        theme={profile.communes?.theme}
        customPrimaryColor={profile.communes?.custom_primary_color}
      />
      <FeedClient userId={user.id} />
    </HydrationBoundary>
  );
}
