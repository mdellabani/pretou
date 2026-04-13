import { createClient } from "@/lib/supabase/server";
import {
  getProfile,
  getPosts,
  getEpciPosts,
} from "@rural-community-platform/shared";
import type { Post } from "@rural-community-platform/shared";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PostCard } from "@/components/post-card";
import { CreatePostDialog } from "@/components/create-post-dialog";

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const { scope: scopeParam } = await searchParams;
  const scope = scopeParam === "epci" ? "epci" : "commune";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await getProfile(supabase, user.id);
  if (!profile) redirect("/auth/signup");
  if (profile.status === "pending") redirect("/auth/pending");

  const { data: posts } =
    scope === "epci" && profile.communes?.epci_id
      ? await getEpciPosts(supabase, profile.communes.epci_id)
      : await getPosts(supabase, profile.commune_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fil de la commune</h1>
        <CreatePostDialog isAdmin={profile.role === "admin"} />
      </div>
      <div className="flex gap-2 text-sm">
        <Link
          href="/app/feed"
          className={scope === "commune" ? "font-bold underline" : "text-muted-foreground hover:text-foreground"}
        >
          Ma commune
        </Link>
        <Link
          href="/app/feed?scope=epci"
          className={scope === "epci" ? "font-bold underline" : "text-muted-foreground hover:text-foreground"}
        >
          Intercommunalité
        </Link>
      </div>
      {posts && posts.length > 0 ? (
        <div className="space-y-3">
          {(posts as Post[]).map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">
          Aucune publication pour le moment.
        </p>
      )}
    </div>
  );
}
