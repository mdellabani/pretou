"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@rural-community-platform/shared";

export async function restorePostAction(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  // Get post to find commune_id
  const { data: post } = await supabase
    .from("posts")
    .select("commune_id")
    .eq("id", postId)
    .single();

  if (!post) return { error: "Post non trouvé" };

  // Unhide post
  await supabase.from("posts").update({ is_hidden: false }).eq("id", postId);

  // Mark all pending reports as dismissed
  await supabase
    .from("reports")
    .update({
      status: "dismissed",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("post_id", postId)
    .eq("status", "pending");

  // Log audit action
  await logAction(
    supabase,
    post.commune_id,
    user.id,
    "post_restored",
    "post",
    postId,
    "Signalements rejetés"
  );

  revalidatePath("/moderation/dashboard");
  return { error: null };
}

export async function deleteReportedPostAction(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  // Get post to find commune_id
  const { data: post } = await supabase
    .from("posts")
    .select("commune_id")
    .eq("id", postId)
    .single();

  if (!post) return { error: "Post non trouvé" };

  // Mark all pending reports as actioned
  await supabase
    .from("reports")
    .update({
      status: "actioned",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("post_id", postId)
    .eq("status", "pending");

  // Delete post
  await supabase.from("posts").delete().eq("id", postId);

  // Log audit action
  await logAction(
    supabase,
    post.commune_id,
    user.id,
    "post_deleted",
    "post",
    postId,
    "Supprimé suite à signalement"
  );

  revalidatePath("/moderation/dashboard");
  return { error: null };
}
