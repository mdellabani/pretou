import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getProfile,
  getPendingUsers,
} from "@rural-community-platform/shared";
import { PendingUsers } from "@/components/admin/pending-users";
import { PostManagement } from "@/components/admin/post-management";
import type { PostType } from "@rural-community-platform/shared";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await getProfile(supabase, user.id);
  if (!profile || profile.role !== "admin") redirect("/app/feed");

  const { data: pendingUsers } = await getPendingUsers(supabase, profile.commune_id);

  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, type, is_pinned, created_at, profiles!author_id(display_name)")
    .eq("commune_id", profile.commune_id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Administration</h1>
      <PendingUsers users={pendingUsers ?? []} />
      <PostManagement
        posts={
          (posts ?? []).map((p) => ({
            id: p.id,
            title: p.title,
            type: p.type as PostType,
            is_pinned: p.is_pinned ?? false,
            created_at: p.created_at,
            profiles: Array.isArray(p.profiles) ? p.profiles[0] ?? null : p.profiles,
          }))
        }
      />
    </div>
  );
}
