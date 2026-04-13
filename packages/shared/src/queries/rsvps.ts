import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

type Client = SupabaseClient<Database>;

export type RsvpStatus = "going" | "maybe" | "not_going";

export async function getRsvps(client: Client, postId: string) {
  return client
    .from("rsvps")
    .select("*, profiles!user_id(display_name)")
    .eq("post_id", postId);
}

export async function setRsvp(client: Client, postId: string, userId: string, status: RsvpStatus) {
  return client
    .from("rsvps")
    .upsert({ post_id: postId, user_id: userId, status }, { onConflict: "post_id,user_id" })
    .select()
    .single();
}

export async function removeRsvp(client: Client, postId: string, userId: string) {
  return client.from("rsvps").delete().eq("post_id", postId).eq("user_id", userId);
}

export async function getRsvpCounts(client: Client, postId: string) {
  const { data } = await client
    .from("rsvps")
    .select("status")
    .eq("post_id", postId);

  const counts = { going: 0, maybe: 0, not_going: 0 };
  data?.forEach((r) => { counts[r.status as RsvpStatus]++; });
  return counts;
}
