import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@rural-community-platform/shared";
import { ThemeInjector } from "@/components/theme-injector";
import { EspaceContent } from "./espace-content";

export default async function MonEspacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await getProfile(supabase, user.id);
  if (!profile) redirect("/auth/signup");
  if (profile.status === "pending") redirect("/auth/pending");

  // My posts
  const { data: myPosts } = await supabase
    .from("posts")
    .select("id, title, type, created_at, is_pinned, comments(count)")
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  // Posts I commented on
  const { data: myComments } = await supabase
    .from("comments")
    .select("id, body, created_at, posts!post_id(id, title, type)")
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  // My RSVPs
  const { data: myRsvps } = await supabase
    .from("rsvps")
    .select("status, posts!post_id(id, title, type, event_date, event_location)")
    .eq("user_id", user.id);

  return (
    <div className="space-y-4">
      <ThemeInjector theme={profile.communes?.theme} customPrimaryColor={profile.communes?.custom_primary_color} />

      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Mon espace</h1>

      <EspaceContent
        myPosts={(myPosts ?? []).map((p) => ({
          id: p.id,
          title: p.title,
          type: p.type,
          created_at: p.created_at,
          is_pinned: p.is_pinned ?? false,
          comment_count: Array.isArray(p.comments) ? (p.comments[0]?.count ?? 0) : 0,
        }))}
        myComments={(myComments ?? []).map((c) => {
          const post = Array.isArray(c.posts) ? c.posts[0] : c.posts;
          return {
            id: c.id,
            body: c.body,
            created_at: c.created_at,
            post_id: post?.id ?? "",
            post_title: post?.title ?? "Publication supprimée",
            post_type: post?.type ?? "discussion",
          };
        })}
        myRsvps={(myRsvps ?? []).map((r) => {
          const post = Array.isArray(r.posts) ? r.posts[0] : r.posts;
          return {
            status: r.status,
            post_id: post?.id ?? "",
            post_title: post?.title ?? "Événement supprimé",
            post_type: post?.type ?? "evenement",
            event_date: post?.event_date ?? null,
            event_location: post?.event_location ?? null,
          };
        })}
      />
    </div>
  );
}
