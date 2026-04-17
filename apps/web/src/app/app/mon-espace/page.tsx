import { HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getProfile,
  getMyPosts,
  getMyComments,
  getMyRsvps,
  queryKeys,
} from "@rural-community-platform/shared";
import { prefetchAndDehydrate } from "@/lib/query/prefetch";
import { ThemeInjector } from "@/components/theme-injector";
import { EspaceClient } from "./espace-client";

export default async function MonEspacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await getProfile(supabase, user.id);
  if (!profile) redirect("/auth/signup");
  if (profile.status === "pending") redirect("/auth/pending");

  const dehydratedState = await prefetchAndDehydrate(async (qc) => {
    qc.setQueryData(queryKeys.profile(user.id), profile);

    await qc.prefetchQuery({
      queryKey: queryKeys.me.posts(user.id),
      queryFn: async () => {
        const { data } = await getMyPosts(supabase, user.id);
        return data ?? [];
      },
    });
    await qc.prefetchQuery({
      queryKey: queryKeys.me.comments(user.id),
      queryFn: async () => {
        const { data } = await getMyComments(supabase, user.id);
        return data ?? [];
      },
    });
    await qc.prefetchQuery({
      queryKey: queryKeys.me.rsvps(user.id),
      queryFn: async () => {
        const { data } = await getMyRsvps(supabase, user.id);
        return data ?? [];
      },
    });
  });

  return (
    <HydrationBoundary state={dehydratedState}>
      <ThemeInjector
        theme={profile.communes?.theme}
        customPrimaryColor={profile.communes?.custom_primary_color}
      />
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Mon espace</h1>
      <div className="mt-4">
        <EspaceClient userId={user.id} />
      </div>
    </HydrationBoundary>
  );
}
