import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@rural-community-platform/shared";
import type { Post } from "@rural-community-platform/shared";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CreatePostDialog } from "@/components/create-post-dialog";
import { ThemeInjector } from "@/components/theme-injector";
import { FeedFilters } from "@/components/feed-filters";
import { FeedContent } from "./feed-content";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; date?: string; types?: string }>;
}) {
  const params = await searchParams;
  const scope = params.scope === "epci" ? "epci" : "commune";
  const dateFilter = params.date ?? "";
  const typesParam = params.types ?? "";
  const selectedTypes = typesParam ? typesParam.split(",").filter(Boolean) : [];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await getProfile(supabase, user.id);
  if (!profile) redirect("/auth/signup");
  if (profile.status === "pending") redirect("/auth/pending");

  // Pinned posts (always shown at top, not paginated)
  let pinnedQuery = supabase
    .from("posts")
    .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status)")
    .eq("commune_id", profile.commune_id)
    .eq("is_hidden", false)
    .eq("is_pinned", true)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString());

  const { data: pinnedPosts } = await pinnedQuery;

  // First page of non-pinned posts
  let query = supabase
    .from("posts")
    .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status)")
    .eq("commune_id", profile.commune_id)
    .eq("is_hidden", false)
    .eq("is_pinned", false)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(20);

  // Type filter (multi-select)
  if (selectedTypes.length > 0) {
    query = query.in("type", selectedTypes);
  }

  // Date filter
  if (dateFilter === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    query = query.gte("created_at", d.toISOString());
  } else if (dateFilter === "week") {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    query = query.gte("created_at", d.toISOString());
  } else if (dateFilter === "month") {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    query = query.gte("created_at", d.toISOString());
  }

  const { data: posts } = await query;

  // Fetch producer count for banner
  const { count: producerCount } = await supabase
    .from("producers")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("commune_id", profile.commune_id);

  return (
    <div className="space-y-4">
      <ThemeInjector theme={profile.communes?.theme} customPrimaryColor={profile.communes?.custom_primary_color} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Fil de la commune</h1>
        <CreatePostDialog isAdmin={profile.role === "admin"} />
      </div>

      {/* Scope toggle */}
      <div className="flex gap-3 text-sm">
        <Link
          href="/app/feed"
          className={scope === "commune"
            ? "font-semibold text-[var(--theme-primary)] underline underline-offset-4"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}
        >
          Ma commune
        </Link>
        <Link
          href="/app/feed?scope=epci"
          className={scope === "epci"
            ? "font-semibold text-[var(--theme-primary)] underline underline-offset-4"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}
        >
          Intercommunalité
        </Link>
      </div>

      {/* Filters */}
      <FeedFilters types={selectedTypes} date={dateFilter} />

      {/* Producers banner */}
      {scope === "commune" && (producerCount ?? 0) > 0 && (
        <Link
          href="/app/producteurs"
          className="flex items-center justify-between rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 px-5 py-3.5 transition-shadow hover:shadow-md"
        >
          <div>
            <p className="text-sm font-bold text-green-800">🌿 Producteurs locaux</p>
            <p className="text-xs text-green-600">
              {producerCount} producteur{(producerCount ?? 0) !== 1 ? "s" : ""} · Circuit court
            </p>
          </div>
          <span className="text-lg text-green-700">→</span>
        </Link>
      )}

      {/* Posts with pagination */}
      <FeedContent
        initialPosts={(posts ?? []) as Post[]}
        pinnedPosts={(pinnedPosts ?? []) as Post[]}
        communeId={profile.commune_id}
        types={selectedTypes}
        dateFilter={dateFilter}
      />
    </div>
  );
}
