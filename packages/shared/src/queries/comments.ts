import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

type Client = SupabaseClient<Database>;

export async function getComments(client: Client, postId: string) {
  return client
    .from("comments")
    .select("*, profiles!author_id(display_name, avatar_url)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
}

export async function createComment(client: Client, postId: string, authorId: string, body: string) {
  return client
    .from("comments")
    .insert({ post_id: postId, author_id: authorId, body })
    .select("*, profiles!author_id(display_name, avatar_url)")
    .single();
}

export async function deleteComment(client: Client, commentId: string) {
  return client.from("comments").delete().eq("id", commentId);
}
