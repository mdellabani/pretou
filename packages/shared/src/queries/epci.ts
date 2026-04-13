import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

type Client = SupabaseClient<Database>;

export async function getEpciPosts(client: Client, epciId: string) {
  const { data: communes } = await client
    .from("communes")
    .select("id")
    .eq("epci_id", epciId);

  if (!communes || communes.length === 0) return { data: [], error: null };

  const communeIds = communes.map((c) => c.id);

  return client
    .from("posts")
    .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status), communes!commune_id(name)")
    .in("commune_id", communeIds)
    .eq("epci_visible", true)
    .order("created_at", { ascending: false });
}
