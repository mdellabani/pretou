import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CreatePostInput } from "../types";

type Client = SupabaseClient<Database>;

export async function getPosts(client: Client, communeId: string) {
  return client
    .from("posts")
    .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status)")
    .eq("commune_id", communeId)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
}

export async function getPostById(client: Client, postId: string) {
  return client
    .from("posts")
    .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path)")
    .eq("id", postId)
    .single();
}

export async function createPost(client: Client, communeId: string, authorId: string, input: CreatePostInput) {
  return client
    .from("posts")
    .insert({ ...input, commune_id: communeId, author_id: authorId })
    .select()
    .single();
}

export async function deletePost(client: Client, postId: string) {
  return client.from("posts").delete().eq("id", postId);
}

export async function togglePinPost(client: Client, postId: string, isPinned: boolean) {
  return client.from("posts").update({ is_pinned: !isPinned }).eq("id", postId);
}

export async function getPostsByType(client: Client, communeId: string, type: string) {
  return client
    .from("posts")
    .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status)")
    .eq("commune_id", communeId)
    .eq("type", type)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("created_at", { ascending: false });
}
